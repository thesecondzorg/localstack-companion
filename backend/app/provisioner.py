import logging
import json
from typing import Dict, Any, List, Optional
import boto3
from botocore.config import Config
from app.config import settings
from app.models import (
    AppConfig, S3BucketSpec, SQSQueueSpec, SNSTopicSpec,
    DynamoDBTableSpec, SecretSpec, SSMParameterSpec, KMSKeySpec
)

logger = logging.getLogger("provisioner")

class LocalStackProvisioner:
    def __init__(self, region: Optional[str] = None):
        self.endpoint_url = settings.localstack_url
        self.region = region or settings.aws_region
        self._init_session()

    def _init_session(self):
        self.boto_config = Config(
            region_name=self.region,
            retries={"max_attempts": 2, "mode": "standard"}
        )
        self.session = boto3.Session(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=self.region
        )

    def set_region(self, region: str):
        if region and region != self.region:
            self.region = region
            self._init_session()

    def _get_client(self, service_name: str, region: Optional[str] = None):
        if region and region != self.region:
            cfg = Config(region_name=region, retries={"max_attempts": 2, "mode": "standard"})
            return self.session.client(service_name, endpoint_url=self.endpoint_url, config=cfg)
        return self.session.client(
            service_name,
            endpoint_url=self.endpoint_url,
            config=self.boto_config
        )

    def check_health(self) -> Dict[str, Any]:
        """Check if LocalStack is reachable and return health status."""
        try:
            import httpx
            resp = httpx.get(f"{self.endpoint_url}/_localstack/health", timeout=3.0)
            if resp.status_code == 200:
                return {"status": "UP", "details": resp.json()}
            return {"status": "UP", "details": {"statusCode": resp.status_code}}
        except Exception as e:
            # Fallback to S3 list buckets test
            try:
                s3 = self._get_client("s3")
                s3.list_buckets()
                return {"status": "UP", "details": "S3 responsive"}
            except Exception as boto_err:
                return {"status": "DOWN", "error": str(e), "boto_error": str(boto_err)}

    # --- S3 Provisioning & Status ---
    def provision_s3_bucket(self, spec: S3BucketSpec) -> Dict[str, Any]:
        s3 = self._get_client("s3")
        try:
            # For us-east-1 CreateBucketConfiguration shouldn't be passed
            if self.region == "us-east-1":
                s3.create_bucket(Bucket=spec.name)
            else:
                s3.create_bucket(
                    Bucket=spec.name,
                    CreateBucketConfiguration={"LocationConstraint": self.region}
                )
            logger.info(f"Created S3 bucket: {spec.name}")
            return {"status": "SUCCESS", "name": spec.name}
        except s3.exceptions.BucketAlreadyOwnedByYou:
            logger.info(f"S3 bucket {spec.name} already exists.")
            return {"status": "EXISTS", "name": spec.name}
        except Exception as e:
            logger.error(f"Failed to create S3 bucket {spec.name}: {e}")
            return {"status": "ERROR", "name": spec.name, "error": str(e)}

    def list_s3_buckets(self) -> List[Dict[str, Any]]:
        s3 = self._get_client("s3")
        try:
            res = s3.list_buckets()
            buckets = []
            for b in res.get("Buckets", []):
                name = b["Name"]
                # Try listing object count
                try:
                    objs = s3.list_objects_v2(Bucket=name, MaxKeys=5)
                    count = objs.get("KeyCount", 0)
                except Exception:
                    count = 0
                buckets.append({
                    "name": name,
                    "creationDate": str(b.get("CreationDate")),
                    "objectCount": count
                })
            return buckets
        except Exception as e:
            logger.warning(f"Error listing S3 buckets: {e}")
            return []

    # --- SQS Provisioning & Status ---
    def provision_sqs_queue(self, spec: SQSQueueSpec) -> Dict[str, Any]:
        sqs = self._get_client("sqs")
        try:
            res = sqs.create_queue(
                QueueName=spec.name,
                Attributes=spec.attributes or {}
            )
            logger.info(f"Created SQS queue: {spec.name}")
            return {"status": "SUCCESS", "name": spec.name, "url": res.get("QueueUrl")}
        except Exception as e:
            logger.error(f"Failed to create SQS queue {spec.name}: {e}")
            return {"status": "ERROR", "name": spec.name, "error": str(e)}

    def list_sqs_queues(self) -> List[Dict[str, Any]]:
        sqs = self._get_client("sqs")
        try:
            res = sqs.list_queues()
            queues = []
            for url in res.get("QueueUrls", []):
                name = url.split("/")[-1]
                try:
                    attrs = sqs.get_queue_attributes(
                        QueueUrl=url,
                        AttributeNames=["ApproximateNumberOfMessages", "VisibilityTimeout", "CreatedTimestamp"]
                    ).get("Attributes", {})
                except Exception:
                    attrs = {}
                queues.append({
                    "name": name,
                    "url": url,
                    "messages": attrs.get("ApproximateNumberOfMessages", "0"),
                    "visibilityTimeout": attrs.get("VisibilityTimeout", "30"),
                    "created": attrs.get("CreatedTimestamp")
                })
            return queues
        except Exception as e:
            logger.warning(f"Error listing SQS queues: {e}")
            return []

    # --- SNS Provisioning & Status ---
    def provision_sns_topic(self, spec: SNSTopicSpec) -> Dict[str, Any]:
        sns = self._get_client("sns")
        try:
            res = sns.create_topic(Name=spec.name)
            topic_arn = res.get("TopicArn")
            logger.info(f"Created SNS topic: {spec.name} ({topic_arn})")

            # Handle subscriptions (e.g. to SQS)
            for sub in spec.subscriptions or []:
                endpoint = sub.endpoint
                if sub.protocol == "sqs" and not endpoint.startswith("arn:aws:"):
                    # Resolve queue arn
                    try:
                        sqs = self._get_client("sqs")
                        q_url = sqs.get_queue_url(QueueName=endpoint).get("QueueUrl")
                        endpoint = sqs.get_queue_attributes(QueueUrl=q_url, AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
                    except Exception as sqs_err:
                        logger.warning(f"Could not resolve SQS ARN for {endpoint}: {sqs_err}")
                sns.subscribe(TopicArn=topic_arn, Protocol=sub.protocol, Endpoint=endpoint)
                logger.info(f"Subscribed {sub.protocol}:{endpoint} to {spec.name}")

            return {"status": "SUCCESS", "name": spec.name, "arn": topic_arn}
        except Exception as e:
            logger.error(f"Failed to create SNS topic {spec.name}: {e}")
            return {"status": "ERROR", "name": spec.name, "error": str(e)}

    def list_sns_topics(self) -> List[Dict[str, Any]]:
        sns = self._get_client("sns")
        try:
            res = sns.list_topics()
            topics = []
            for t in res.get("Topics", []):
                arn = t["TopicArn"]
                name = arn.split(":")[-1]
                try:
                    subs = sns.list_subscriptions_by_topic(TopicArn=arn).get("Subscriptions", [])
                    sub_count = len(subs)
                except Exception:
                    sub_count = 0
                topics.append({
                    "name": name,
                    "arn": arn,
                    "subscriptionsCount": sub_count
                })
            return topics
        except Exception as e:
            logger.warning(f"Error listing SNS topics: {e}")
            return []

    # --- DynamoDB Provisioning & Status ---
    def provision_dynamodb_table(self, spec: DynamoDBTableSpec) -> Dict[str, Any]:
        dynamodb = self._get_client("dynamodb")
        try:
            key_schema = [{"AttributeName": spec.partitionKey.name, "KeyType": "HASH"}]
            attr_defs = [{"AttributeName": spec.partitionKey.name, "AttributeType": spec.partitionKey.type}]
            
            if spec.sortKey:
                key_schema.append({"AttributeName": spec.sortKey.name, "KeyType": "RANGE"})
                attr_defs.append({"AttributeName": spec.sortKey.name, "AttributeType": spec.sortKey.type})
                
            create_params = {
                "TableName": spec.tableName,
                "KeySchema": key_schema,
                "AttributeDefinitions": attr_defs,
                "BillingMode": spec.billingMode or "PAY_PER_REQUEST"
            }
            dynamodb.create_table(**create_params)
            logger.info(f"Created DynamoDB table: {spec.tableName}")
            return {"status": "SUCCESS", "tableName": spec.tableName}
        except dynamodb.exceptions.ResourceInUseException:
            logger.info(f"DynamoDB table {spec.tableName} already exists.")
            return {"status": "EXISTS", "tableName": spec.tableName}
        except Exception as e:
            logger.error(f"Failed to create DynamoDB table {spec.tableName}: {e}")
            return {"status": "ERROR", "tableName": spec.tableName, "error": str(e)}

    def list_dynamodb_tables(self) -> List[Dict[str, Any]]:
        dynamodb = self._get_client("dynamodb")
        try:
            res = dynamodb.list_tables()
            tables = []
            for name in res.get("TableNames", []):
                try:
                    desc = dynamodb.describe_table(TableName=name).get("Table", {})
                    item_count = desc.get("ItemCount", 0)
                    status = desc.get("TableStatus", "ACTIVE")
                    keys = [k["AttributeName"] for k in desc.get("KeySchema", [])]
                except Exception:
                    item_count = 0
                    status = "UNKNOWN"
                    keys = []
                tables.append({
                    "tableName": name,
                    "status": status,
                    "itemCount": item_count,
                    "keys": keys
                })
            return tables
        except Exception as e:
            logger.warning(f"Error listing DynamoDB tables: {e}")
            return []

    # --- Secrets Manager ---
    def provision_secret(self, spec: SecretSpec) -> Dict[str, Any]:
        client = self._get_client("secretsmanager")
        try:
            params = {"Name": spec.name, "SecretString": spec.value or ""}
            if spec.description:
                params["Description"] = spec.description
            client.create_secret(**params)
            logger.info(f"Created Secret: {spec.name}")
            return {"status": "SUCCESS", "name": spec.name}
        except client.exceptions.ResourceExistsException:
            logger.info(f"Secret {spec.name} already exists.")
            return {"status": "EXISTS", "name": spec.name}
        except Exception as e:
            logger.error(f"Failed to create secret {spec.name}: {e}")
            return {"status": "ERROR", "name": spec.name, "error": str(e)}

    def list_secrets(self) -> List[Dict[str, Any]]:
        client = self._get_client("secretsmanager")
        try:
            res = client.list_secrets()
            return [{"name": s.get("Name"), "description": s.get("Description", "")} for s in res.get("SecretList", [])]
        except Exception as e:
            logger.warning(f"Error listing secrets: {e}")
            return []

    # --- SSM Parameter Store ---
    def provision_ssm_parameter(self, spec: SSMParameterSpec) -> Dict[str, Any]:
        ssm = self._get_client("ssm")
        try:
            params = {
                "Name": spec.name,
                "Value": spec.value,
                "Type": spec.type,
                "Overwrite": True
            }
            if spec.description:
                params["Description"] = spec.description
            ssm.put_parameter(**params)
            logger.info(f"Created SSM parameter: {spec.name}")
            return {"status": "SUCCESS", "name": spec.name}
        except Exception as e:
            logger.error(f"Failed to put SSM parameter {spec.name}: {e}")
            return {"status": "ERROR", "name": spec.name, "error": str(e)}

    def list_ssm_parameters(self) -> List[Dict[str, Any]]:
        ssm = self._get_client("ssm")
        try:
            res = ssm.describe_parameters()
            return [{"name": p.get("Name"), "type": p.get("Type"), "description": p.get("Description", "")} for p in res.get("Parameters", [])]
        except Exception as e:
            logger.warning(f"Error listing SSM parameters: {e}")
            return []

    # --- KMS Keys ---
    def provision_kms_key(self, spec: KMSKeySpec) -> Dict[str, Any]:
        kms = self._get_client("kms")
        try:
            res = kms.create_key(Description=spec.description or "LocalStack Key")
            key_id = res["KeyMetadata"]["KeyId"]
            if spec.alias:
                alias = spec.alias if spec.alias.startswith("alias/") else f"alias/{spec.alias}"
                kms.create_alias(AliasName=alias, TargetKeyId=key_id)
            logger.info(f"Created KMS key: {key_id} with alias {spec.alias}")
            return {"status": "SUCCESS", "keyId": key_id, "alias": spec.alias}
        except Exception as e:
            logger.error(f"Failed to create KMS key: {e}")
            return {"status": "ERROR", "alias": spec.alias, "error": str(e)}

    def list_kms_keys(self) -> List[Dict[str, Any]]:
        kms = self._get_client("kms")
        try:
            res = kms.list_aliases()
            return [{"alias": a.get("AliasName"), "targetKeyId": a.get("TargetKeyId")} for a in res.get("Aliases", [])]
        except Exception as e:
            logger.warning(f"Error listing KMS aliases: {e}")
            return []

    # --- Full Reconcile / Sync ---
    def reconcile_all(self, config: AppConfig) -> Dict[str, Any]:
        """Syncs all resources defined in config into LocalStack."""
        if config.region:
            self.set_region(config.region)
        results = {
            "s3": [],
            "sqs": [],
            "sns": [],
            "dynamodb": [],
            "secretsmanager": [],
            "ssm": [],
            "kms": []
        }

        # 1. S3
        if config.services.s3 and "buckets" in config.services.s3:
            for b in config.services.s3["buckets"]:
                results["s3"].append(self.provision_s3_bucket(b))

        # 2. SQS
        if config.services.sqs and "queues" in config.services.sqs:
            for q in config.services.sqs["queues"]:
                results["sqs"].append(self.provision_sqs_queue(q))

        # 3. SNS
        if config.services.sns and "topics" in config.services.sns:
            for t in config.services.sns["topics"]:
                results["sns"].append(self.provision_sns_topic(t))

        # 4. DynamoDB
        if config.services.dynamodb and "tables" in config.services.dynamodb:
            for tbl in config.services.dynamodb["tables"]:
                results["dynamodb"].append(self.provision_dynamodb_table(tbl))

        # 5. Secrets Manager
        if config.services.secretsmanager and "secrets" in config.services.secretsmanager:
            for s in config.services.secretsmanager["secrets"]:
                results["secretsmanager"].append(self.provision_secret(s))

        # 6. SSM
        if config.services.ssm and "parameters" in config.services.ssm:
            for p in config.services.ssm["parameters"]:
                results["ssm"].append(self.provision_ssm_parameter(p))

        # 7. KMS
        if config.services.kms and "keys" in config.services.kms:
            for k in config.services.kms["keys"]:
                results["kms"].append(self.provision_kms_key(k))

        return results

    def get_all_active_resources(self) -> Dict[str, Any]:
        return {
            "s3": self.list_s3_buckets(),
            "sqs": self.list_sqs_queues(),
            "sns": self.list_sns_topics(),
            "dynamodb": self.list_dynamodb_tables(),
            "secretsmanager": self.list_secrets(),
            "ssm": self.list_ssm_parameters(),
            "kms": self.list_kms_keys()
        }

    # =========================================================================
    # INTERACTIVE RESOURCE ACTIONS (Send msgs, upload files, edit secrets, etc.)
    # =========================================================================

    # --- SQS Interactive ---
    def sqs_send_message(self, queue_name: str, message_body: str, attributes: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        sqs = self._get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        params = {
            "QueueUrl": q_url,
            "MessageBody": message_body
        }
        if attributes:
            msg_attrs = {}
            for k, v in attributes.items():
                msg_attrs[k] = {"DataType": "String", "StringValue": str(v)}
            params["MessageAttributes"] = msg_attrs
        res = sqs.send_message(**params)
        return {"status": "SUCCESS", "messageId": res.get("MessageId"), "queue": queue_name}

    def sqs_receive_messages(self, queue_name: str, max_messages: int = 10) -> List[Dict[str, Any]]:
        sqs = self._get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        res = sqs.receive_message(
            QueueUrl=q_url,
            MaxNumberOfMessages=max_messages,
            VisibilityTimeout=10,
            AttributeNames=["All"],
            MessageAttributeNames=["All"]
        )
        messages = []
        for m in res.get("Messages", []):
            messages.append({
                "messageId": m.get("MessageId"),
                "body": m.get("Body"),
                "receiptHandle": m.get("ReceiptHandle"),
                "attributes": m.get("Attributes", {}),
                "messageAttributes": m.get("MessageAttributes", {})
            })
        return messages

    def sqs_purge_queue(self, queue_name: str) -> Dict[str, Any]:
        sqs = self._get_client("sqs")
        q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
        sqs.purge_queue(QueueUrl=q_url)
        return {"status": "SUCCESS", "queue": queue_name}

    # --- S3 Interactive ---
    def s3_list_objects(self, bucket_name: str) -> List[Dict[str, Any]]:
        s3 = self._get_client("s3")
        try:
            res = s3.list_objects_v2(Bucket=bucket_name)
            objects = []
            for obj in res.get("Contents", []):
                objects.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "lastModified": str(obj["LastModified"]),
                    "etag": obj.get("ETag", "").strip('"')
                })
            return objects
        except Exception as e:
            logger.warning(f"Error listing S3 objects in {bucket_name}: {e}")
            return []

    def s3_put_object(self, bucket_name: str, key: str, data: bytes, content_type: str = "text/plain") -> Dict[str, Any]:
        s3 = self._get_client("s3")
        s3.put_object(Bucket=bucket_name, Key=key, Body=data, ContentType=content_type)
        return {"status": "SUCCESS", "bucket": bucket_name, "key": key, "size": len(data)}

    def s3_get_object(self, bucket_name: str, key: str) -> Dict[str, Any]:
        s3 = self._get_client("s3")
        obj = s3.get_object(Bucket=bucket_name, Key=key)
        body_bytes = obj["Body"].read()
        return {
            "key": key,
            "content": body_bytes.decode("utf-8", errors="replace"),
            "contentType": obj.get("ContentType", "text/plain"),
            "size": len(body_bytes)
        }

    def s3_delete_object(self, bucket_name: str, key: str) -> Dict[str, Any]:
        s3 = self._get_client("s3")
        s3.delete_object(Bucket=bucket_name, Key=key)
        return {"status": "SUCCESS", "bucket": bucket_name, "key": key}

    # --- Secrets Manager Interactive ---
    def secret_get_value(self, name: str) -> Dict[str, Any]:
        client = self._get_client("secretsmanager")
        res = client.get_secret_value(SecretId=name)
        return {
            "name": name,
            "secretString": res.get("SecretString", ""),
            "versionId": res.get("VersionId")
        }

    def secret_put_value(self, name: str, value: str) -> Dict[str, Any]:
        client = self._get_client("secretsmanager")
        res = client.put_secret_value(SecretId=name, SecretString=value)
        return {"status": "SUCCESS", "name": name, "versionId": res.get("VersionId")}

    # --- DynamoDB Interactive ---
    def dynamodb_scan_items(self, table_name: str, limit: int = 50) -> List[Dict[str, Any]]:
        dynamodb = self._get_client("dynamodb")
        try:
            res = dynamodb.scan(TableName=table_name, Limit=limit)
            from boto3.dynamodb.types import TypeDeserializer
            deserializer = TypeDeserializer()
            items = []
            for raw_item in res.get("Items", []):
                py_item = {k: deserializer.deserialize(v) for k, v in raw_item.items()}
                items.append(py_item)
            return items
        except Exception as e:
            logger.warning(f"Error scanning DynamoDB table {table_name}: {e}")
            return []

    def dynamodb_put_item(self, table_name: str, item_dict: Dict[str, Any]) -> Dict[str, Any]:
        dynamodb = self._get_client("dynamodb")
        from boto3.dynamodb.types import TypeSerializer
        serializer = TypeSerializer()
        raw_item = {k: serializer.serialize(v) for k, v in item_dict.items()}
        dynamodb.put_item(TableName=table_name, Item=raw_item)
        return {"status": "SUCCESS", "table": table_name, "item": item_dict}

    def dynamodb_delete_item(self, table_name: str, key_dict: Dict[str, Any]) -> Dict[str, Any]:
        dynamodb = self._get_client("dynamodb")
        from boto3.dynamodb.types import TypeSerializer
        serializer = TypeSerializer()
        raw_key = {k: serializer.serialize(v) for k, v in key_dict.items()}
        dynamodb.delete_item(TableName=table_name, Key=raw_key)
        return {"status": "SUCCESS", "table": table_name, "key": key_dict}

    # --- SSM Interactive ---
    def ssm_get_value(self, name: str) -> Dict[str, Any]:
        ssm = self._get_client("ssm")
        res = ssm.get_parameter(Name=name, WithDecryption=True)
        param = res.get("Parameter", {})
        return {
            "name": name,
            "value": param.get("Value", ""),
            "type": param.get("Type", "String"),
            "version": param.get("Version")
        }

    def ssm_put_value(self, name: str, value: str, param_type: str = "String") -> Dict[str, Any]:
        ssm = self._get_client("ssm")
        ssm.put_parameter(Name=name, Value=value, Type=param_type, Overwrite=True)
        return {"status": "SUCCESS", "name": name, "value": value}

    # --- SNS Interactive ---
    def sns_publish(self, topic_name: str, message: str, subject: Optional[str] = None) -> Dict[str, Any]:
        sns = self._get_client("sns")
        # Resolve topic arn
        topics = sns.list_topics().get("Topics", [])
        topic_arn = None
        for t in topics:
            if t["TopicArn"].endswith(f":{topic_name}") or t["TopicArn"] == topic_name:
                topic_arn = t["TopicArn"]
                break
        if not topic_arn:
            topic_arn = f"arn:aws:sns:{self.region}:000000000000:{topic_name}"

        params = {"TopicArn": topic_arn, "Message": message}
        if subject:
            params["Subject"] = subject
        res = sns.publish(**params)
        return {"status": "SUCCESS", "topic": topic_name, "messageId": res.get("MessageId")}

    # =========================================================================
    # DELETE RESOURCE ACTIONS
    # =========================================================================
    def delete_s3_bucket(self, bucket_name: str, force: bool = True) -> Dict[str, Any]:
        s3 = self._get_client("s3")
        try:
            if force:
                # Delete all objects first
                try:
                    objs = s3.list_objects_v2(Bucket=bucket_name).get("Contents", [])
                    for obj in objs:
                        s3.delete_object(Bucket=bucket_name, Key=obj["Key"])
                except Exception:
                    pass
            s3.delete_bucket(Bucket=bucket_name)
            logger.info(f"Deleted S3 bucket: {bucket_name}")
            return {"status": "SUCCESS", "name": bucket_name}
        except Exception as e:
            logger.error(f"Failed to delete S3 bucket {bucket_name}: {e}")
            return {"status": "ERROR", "name": bucket_name, "error": str(e)}

    def delete_sqs_queue(self, queue_name: str) -> Dict[str, Any]:
        sqs = self._get_client("sqs")
        try:
            q_url = sqs.get_queue_url(QueueName=queue_name)["QueueUrl"]
            sqs.delete_queue(QueueUrl=q_url)
            logger.info(f"Deleted SQS queue: {queue_name}")
            return {"status": "SUCCESS", "name": queue_name}
        except Exception as e:
            logger.error(f"Failed to delete SQS queue {queue_name}: {e}")
            return {"status": "ERROR", "name": queue_name, "error": str(e)}

    def delete_sns_topic(self, topic_name: str) -> Dict[str, Any]:
        sns = self._get_client("sns")
        try:
            topics = sns.list_topics().get("Topics", [])
            topic_arn = None
            for t in topics:
                if t["TopicArn"].endswith(f":{topic_name}") or t["TopicArn"] == topic_name:
                    topic_arn = t["TopicArn"]
                    break
            if not topic_arn:
                topic_arn = f"arn:aws:sns:{self.region}:000000000000:{topic_name}"
            sns.delete_topic(TopicArn=topic_arn)
            logger.info(f"Deleted SNS topic: {topic_name}")
            return {"status": "SUCCESS", "name": topic_name}
        except Exception as e:
            logger.error(f"Failed to delete SNS topic {topic_name}: {e}")
            return {"status": "ERROR", "name": topic_name, "error": str(e)}

    def delete_dynamodb_table(self, table_name: str) -> Dict[str, Any]:
        dynamodb = self._get_client("dynamodb")
        try:
            dynamodb.delete_table(TableName=table_name)
            logger.info(f"Deleted DynamoDB table: {table_name}")
            return {"status": "SUCCESS", "name": table_name}
        except Exception as e:
            logger.error(f"Failed to delete DynamoDB table {table_name}: {e}")
            return {"status": "ERROR", "name": table_name, "error": str(e)}

    def delete_secret(self, secret_name: str) -> Dict[str, Any]:
        client = self._get_client("secretsmanager")
        try:
            client.delete_secret(SecretId=secret_name, ForceDeleteWithoutRecovery=True)
            logger.info(f"Deleted Secret: {secret_name}")
            return {"status": "SUCCESS", "name": secret_name}
        except Exception as e:
            logger.error(f"Failed to delete secret {secret_name}: {e}")
            return {"status": "ERROR", "name": secret_name, "error": str(e)}

    def delete_ssm_parameter(self, param_name: str) -> Dict[str, Any]:
        ssm = self._get_client("ssm")
        try:
            ssm.delete_parameter(Name=param_name)
            logger.info(f"Deleted SSM parameter: {param_name}")
            return {"status": "SUCCESS", "name": param_name}
        except Exception as e:
            logger.error(f"Failed to delete SSM parameter {param_name}: {e}")
            return {"status": "ERROR", "name": param_name, "error": str(e)}

    def delete_kms_key(self, alias: str) -> Dict[str, Any]:
        kms = self._get_client("kms")
        try:
            alias_name = alias if alias.startswith("alias/") else f"alias/{alias}"
            kms.delete_alias(AliasName=alias_name)
            logger.info(f"Deleted KMS alias: {alias_name}")
            return {"status": "SUCCESS", "alias": alias}
        except Exception as e:
            logger.error(f"Failed to delete KMS alias {alias}: {e}")
            return {"status": "ERROR", "alias": alias, "error": str(e)}

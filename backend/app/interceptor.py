import json
import re
import urllib.parse
from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger("interceptor")

class AwsRequestInspector:
    """Parses incoming AWS HTTP requests and identifies the target service, action, and resource."""

    @staticmethod
    def inspect_request(method: str, path: str, headers: Dict[str, str], body: bytes) -> Dict[str, Any]:
        info = {
            "service": "unknown",
            "action": "unknown",
            "resource_name": None,
            "resource_type": None,
            "raw_target": None
        }

        # Normalize headers to lowercase
        norm_headers = {k.lower(): v for k, v in headers.items()}
        target = norm_headers.get("x-amz-target", "")
        auth = norm_headers.get("authorization", "")
        host = norm_headers.get("host", "")
        content_type = norm_headers.get("content-type", "")

        # Try extracting service from Authorization header (AWS4-HMAC-SHA256 Credential=.../region/service/aws4_request)
        if "Credential=" in auth:
            try:
                cred_parts = auth.split("Credential=")[1].split("/")[2]
                info["service"] = cred_parts.lower()
            except Exception:
                pass

        # Check x-amz-target (DynamoDB, SecretsManager, SSM, KMS, SQS-JSON)
        if target:
            info["raw_target"] = target
            if "DynamoDB" in target:
                info["service"] = "dynamodb"
                info["action"] = target.split(".")[-1]
                info["resource_type"] = "tables"
                try:
                    payload = json.loads(body.decode("utf-8", errors="ignore"))
                    info["resource_name"] = payload.get("TableName")
                except Exception:
                    pass
            elif "secretsmanager" in target.lower():
                info["service"] = "secretsmanager"
                info["action"] = target.split(".")[-1]
                info["resource_type"] = "secrets"
                try:
                    payload = json.loads(body.decode("utf-8", errors="ignore"))
                    info["resource_name"] = payload.get("SecretId") or payload.get("Name")
                except Exception:
                    pass
            elif "AmazonSSM" in target or "ssm" in target.lower():
                info["service"] = "ssm"
                info["action"] = target.split(".")[-1]
                info["resource_type"] = "parameters"
                try:
                    payload = json.loads(body.decode("utf-8", errors="ignore"))
                    info["resource_name"] = payload.get("Name") or (payload.get("Names", [None])[0] if isinstance(payload.get("Names"), list) else None)
                except Exception:
                    pass
            elif "TrentService" in target or "kms" in target.lower():
                info["service"] = "kms"
                info["action"] = target.split(".")[-1]
                info["resource_type"] = "keys"
                try:
                    payload = json.loads(body.decode("utf-8", errors="ignore"))
                    info["resource_name"] = payload.get("KeyId") or payload.get("AliasName")
                except Exception:
                    pass
            elif "AmazonSQS" in target or "sqs" in target.lower():
                info["service"] = "sqs"
                info["action"] = target.split(".")[-1]
                info["resource_type"] = "queues"
                try:
                    payload = json.loads(body.decode("utf-8", errors="ignore"))
                    q_url = payload.get("QueueUrl", "")
                    if q_url:
                        info["resource_name"] = q_url.rstrip("/").split("/")[-1]
                    else:
                        info["resource_name"] = payload.get("QueueName")
                except Exception:
                    pass

        # Check S3 (Virtual host or path style)
        if info["service"] in ("unknown", "s3"):
            # Check host for bucket name e.g. bucket-name.localhost:4566 or bucket-name.s3.localhost:4566
            host_clean = host.split(":")[0]
            if host_clean and not host_clean.startswith("localhost") and not host_clean.startswith("127.0.0.1"):
                # Subdomain host style
                bucket_candidate = host_clean.split(".")[0]
                if bucket_candidate not in ("s3", "localstack"):
                    info["service"] = "s3"
                    info["resource_type"] = "buckets"
                    info["resource_name"] = bucket_candidate
            
            # Check path style /bucket-name/...
            if not info["resource_name"] and path and path != "/":
                parts = [p for p in path.strip("/").split("/") if p]
                if parts and not parts[0].startswith("_localstack") and not parts[0].startswith("000000000000"):
                    # Could be S3 bucket or SQS queue with standard root path
                    # Let's inspect query params or headers
                    if info["service"] == "s3" or "s3" in auth:
                        info["service"] = "s3"
                        info["resource_type"] = "buckets"
                        info["resource_name"] = parts[0]
                        info["action"] = method

        # Check SQS or SNS Form-Encoded / Query Protocol
        if "application/x-www-form-urlencoded" in content_type:
            try:
                form_data = urllib.parse.parse_qs(body.decode("utf-8", errors="ignore"))
                action = form_data.get("Action", [None])[0]
                if action:
                    info["action"] = action
                    if "Queue" in action or "Message" in action or form_data.get("QueueName") or form_data.get("QueueUrl"):
                        info["service"] = "sqs"
                        info["resource_type"] = "queues"
                        if form_data.get("QueueName"):
                            info["resource_name"] = form_data["QueueName"][0]
                        elif form_data.get("QueueUrl"):
                            info["resource_name"] = form_data["QueueUrl"][0].rstrip("/").split("/")[-1]
                    elif "Topic" in action or "Publish" in action or "Subscribe" in action or form_data.get("TopicArn") or form_data.get("Name"):
                        info["service"] = "sns"
                        info["resource_type"] = "topics"
                        if form_data.get("Name"):
                            info["resource_name"] = form_data["Name"][0]
                        elif form_data.get("TopicArn"):
                            info["resource_name"] = form_data["TopicArn"][0].split(":")[-1]
            except Exception:
                pass

        # Check path for SQS account/queue: /000000000000/{queueName}
        if path.startswith("/000000000000/"):
            q_name = path.replace("/000000000000/", "").split("/")[0].split("?")[0]
            if q_name:
                info["service"] = "sqs"
                info["resource_type"] = "queues"
                info["resource_name"] = q_name

        return info


class MissingResourceDetector:
    """Detects when LocalStack returns a 404 / ResourceNotFound error and extracts the missing resource info."""

    @staticmethod
    def detect(req_info: Dict[str, Any], status_code: int, resp_body: bytes) -> Optional[Dict[str, Any]]:
        if status_code < 400:
            return None

        body_str = resp_body.decode("utf-8", errors="ignore")
        service = req_info.get("service")
        action = req_info.get("action")
        resource_name = req_info.get("resource_name")
        resource_type = req_info.get("resource_type")
        error_code = None
        error_msg = None

        # 1. SQS missing queue errors
        if (
            "AWS.SimpleQueueService.NonExistentQueue" in body_str
            or "QueueDoesNotExist" in body_str
            or "The specified queue does not exist" in body_str
        ):
            error_code = "QueueDoesNotExist"
            error_msg = "The specified queue does not exist."
            if not resource_name:
                # Try regex extract from body
                m = re.search(r"The specified queue does not exist for this wsdl version\.?:?\s*([a-zA-Z0-9_-]+)", body_str)
                if m:
                    resource_name = m.group(1)
            
            return {
                "service": "sqs",
                "resource_type": "queues",
                "resource_name": resource_name or "unknown-queue",
                "operation": action or "SQS_REQUEST",
                "error_code": error_code,
                "error_message": error_msg,
                "suggested_spec": {
                    "name": resource_name or "unknown-queue",
                    "attributes": {
                        "VisibilityTimeout": "30"
                    }
                }
            }

        # 2. S3 missing bucket errors
        if (
            "NoSuchBucket" in body_str
            or (service == "s3" and (status_code == 404 and "<Code>NoSuchBucket</Code>" in body_str))
            or (service == "s3" and status_code == 404 and "Bucket" in body_str)
        ):
            error_code = "NoSuchBucket"
            error_msg = "The specified bucket does not exist."
            if not resource_name:
                m = re.search(r"<BucketName>([^<]+)</BucketName>", body_str)
                if m:
                    resource_name = m.group(1)

            return {
                "service": "s3",
                "resource_type": "buckets",
                "resource_name": resource_name or "unknown-bucket",
                "operation": action or "S3_REQUEST",
                "error_code": error_code,
                "error_message": error_msg,
                "suggested_spec": {
                    "name": resource_name or "unknown-bucket",
                    "acl": "private"
                }
            }

        # 3. DynamoDB missing table errors
        if (
            "ResourceNotFoundException" in body_str
            and (service == "dynamodb" or "Cannot do operations on a non-existent table" in body_str or "Table" in body_str)
        ):
            error_code = "ResourceNotFoundException"
            error_msg = "Cannot do operations on a non-existent table."
            return {
                "service": "dynamodb",
                "resource_type": "tables",
                "resource_name": resource_name or "unknown-table",
                "operation": action or "DynamoDB_REQUEST",
                "error_code": error_code,
                "error_message": error_msg,
                "suggested_spec": {
                    "tableName": resource_name or "unknown-table",
                    "partitionKey": {"name": "id", "type": "S"},
                    "billingMode": "PAY_PER_REQUEST"
                }
            }

        # 4. SNS missing topic errors
        if (
            ("NotFound" in body_str or "Topic does not exist" in body_str)
            and (service == "sns" or "Topic" in body_str)
        ):
            error_code = "NotFound"
            error_msg = "Topic does not exist."
            return {
                "service": "sns",
                "resource_type": "topics",
                "resource_name": resource_name or "unknown-topic",
                "operation": action or "SNS_REQUEST",
                "error_code": error_code,
                "error_message": error_msg,
                "suggested_spec": {
                    "name": resource_name or "unknown-topic",
                    "subscriptions": []
                }
            }

        # 5. Secrets Manager missing secret errors
        if (
            "ResourceNotFoundException" in body_str
            and service == "secretsmanager"
        ):
            error_code = "ResourceNotFoundException"
            error_msg = "Secret not found."
            return {
                "service": "secretsmanager",
                "resource_type": "secrets",
                "resource_name": resource_name or "unknown-secret",
                "operation": action or "SecretsManager_REQUEST",
                "error_code": error_code,
                "error_message": error_msg,
                "suggested_spec": {
                    "name": resource_name or "/app/secret",
                    "value": "{}",
                    "description": "Auto-created secret"
                }
            }

        # 6. SSM Parameter Store missing parameter
        if (
            "ParameterNotFound" in body_str
            or (service == "ssm" and "ParameterNotFound" in body_str)
        ):
            error_code = "ParameterNotFound"
            error_msg = "Parameter not found."
            return {
                "service": "ssm",
                "resource_type": "parameters",
                "resource_name": resource_name or "unknown-param",
                "operation": action or "SSM_REQUEST",
                "error_code": error_code,
                "error_message": error_msg,
                "suggested_spec": {
                    "name": resource_name or "/config/param",
                    "type": "String",
                    "value": "default_value"
                }
            }

        return None

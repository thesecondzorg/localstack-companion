import os
import logging
from typing import Dict, Any, List, Optional
from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq
from app.models import (
    AppConfig, S3BucketSpec, SQSQueueSpec, SNSTopicSpec,
    DynamoDBTableSpec, SecretSpec, SSMParameterSpec, KMSKeySpec
)

logger = logging.getLogger("config_manager")

class ConfigManager:
    def __init__(self, config_path: str = "resources.yaml"):
        self.config_path = config_path
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)
        self._raw_data = None

    def load_config(self) -> AppConfig:
        if not os.path.exists(self.config_path):
            logger.warning(f"Config file {self.config_path} does not exist. Initializing empty config.")
            return AppConfig()
        
        try:
            with open(self.config_path, "r") as f:
                self._raw_data = self.yaml.load(f) or {}
                
            # Parse raw data into AppConfig
            services = self._raw_data.get("services", {}) or {}
            
            s3_data = {"buckets": [S3BucketSpec(**b) for b in services.get("s3", {}).get("buckets", []) or []]}
            sqs_data = {"queues": [SQSQueueSpec(**q) for q in services.get("sqs", {}).get("queues", []) or []]}
            sns_data = {"topics": [SNSTopicSpec(**t) for t in services.get("sns", {}).get("topics", []) or []]}
            dynamo_data = {"tables": [DynamoDBTableSpec(**tbl) for tbl in services.get("dynamodb", {}).get("tables", []) or []]}
            secrets_data = {"secrets": [SecretSpec(**s) for s in services.get("secretsmanager", {}).get("secrets", []) or []]}
            ssm_data = {"parameters": [SSMParameterSpec(**p) for p in services.get("ssm", {}).get("parameters", []) or []]}
            kms_data = {"keys": [KMSKeySpec(**k) for k in services.get("kms", {}).get("keys", []) or []]}
            
            return AppConfig(
                version=str(self._raw_data.get("version", "1.0")),
                region=str(self._raw_data.get("region", "eu-west-1")),
                services={
                    "s3": s3_data,
                    "sqs": sqs_data,
                    "sns": sns_data,
                    "dynamodb": dynamo_data,
                    "secretsmanager": secrets_data,
                    "ssm": ssm_data,
                    "kms": kms_data
                }
            )
        except Exception as e:
            logger.error(f"Failed to load config from {self.config_path}: {e}")
            return AppConfig()

    def get_raw_yaml(self) -> str:
        if not os.path.exists(self.config_path):
            return ""
        with open(self.config_path, "r") as f:
            return f.read()

    def save_raw_yaml(self, content: str):
        with open(self.config_path, "w") as f:
            f.write(content)
        self.load_config()

    def add_resource(self, service: str, resource_type: str, spec: Dict[str, Any]) -> bool:
        """Add a resource to the YAML file while preserving existing comments and structure."""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    data = self.yaml.load(f) or CommentedMap()
            else:
                data = CommentedMap()

            if "version" not in data:
                data["version"] = "1.0"
            if "services" not in data or data["services"] is None:
                data["services"] = CommentedMap()
            if service not in data["services"] or data["services"][service] is None:
                data["services"][service] = CommentedMap()
            if resource_type not in data["services"][service] or data["services"][service][resource_type] is None:
                data["services"][service][resource_type] = CommentedSeq()

            # Check if resource already exists
            items = data["services"][service][resource_type]
            identifier_key = "name"
            if service == "dynamodb" and resource_type == "tables":
                identifier_key = "tableName"
            elif service == "kms" and resource_type == "keys":
                identifier_key = "alias"

            target_id = spec.get(identifier_key)
            for item in items:
                if item.get(identifier_key) == target_id:
                    logger.info(f"Resource {service}.{resource_type} '{target_id}' already exists in config.")
                    return True

            items.append(spec)

            with open(self.config_path, "w") as f:
                self.yaml.dump(data, f)

            logger.info(f"Successfully added resource {service}.{resource_type} '{target_id}' to {self.config_path}")
            return True
        except Exception as e:
            logger.error(f"Error adding resource to config: {e}")
            return False

    def update_resource_field(self, service: str, resource_type: str, identifier_val: str, field_name: str, new_val: Any) -> bool:
        """Update a specific field (like value) in resources.yaml for a resource."""
        try:
            if not os.path.exists(self.config_path):
                return False
            with open(self.config_path, "r") as f:
                data = self.yaml.load(f) or CommentedMap()

            items = data.get("services", {}).get(service, {}).get(resource_type, [])
            id_key = "name"
            if service == "dynamodb": id_key = "tableName"
            elif service == "kms": id_key = "alias"

            for item in items:
                if item.get(id_key) == identifier_val:
                    item[field_name] = new_val
                    with open(self.config_path, "w") as f:
                        self.yaml.dump(data, f)
                    logger.info(f"Updated {field_name} for {identifier_val} in {self.config_path}")
                    return True
            return False
        except Exception as e:
            logger.error(f"Error updating resource field: {e}")
            return False

    def remove_resource(self, service: str, resource_type: str, identifier_val: str) -> bool:
        """Remove a resource from resources.yaml."""
        try:
            if not os.path.exists(self.config_path):
                return False
            with open(self.config_path, "r") as f:
                data = self.yaml.load(f) or CommentedMap()

            items = data.get("services", {}).get(service, {}).get(resource_type, [])
            id_key = "name"
            if service == "dynamodb": id_key = "tableName"
            elif service == "kms": id_key = "alias"

            target_idx = None
            for idx, item in enumerate(items):
                if item.get(id_key) == identifier_val:
                    target_idx = idx
                    break

            if target_idx is not None:
                del items[target_idx]
                with open(self.config_path, "w") as f:
                    self.yaml.dump(data, f)
                logger.info(f"Removed {service}.{resource_type} '{identifier_val}' from {self.config_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error removing resource from config: {e}")
            return False

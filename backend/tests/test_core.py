import pytest
import os
from app.interceptor import AwsRequestInspector, MissingResourceDetector
from app.config_manager import ConfigManager
from app.models import SQSQueueSpec, S3BucketSpec

def test_inspect_sqs_json_request():
    headers = {
        "x-amz-target": "AmazonSQS.SendMessage",
        "Content-Type": "application/x-amz-json-1.0"
    }
    body = b'{"QueueUrl": "http://localhost:4566/000000000000/order-events-queue", "MessageBody": "test"}'
    info = AwsRequestInspector.inspect_request("POST", "/", headers, body)
    
    assert info["service"] == "sqs"
    assert info["action"] == "SendMessage"
    assert info["resource_name"] == "order-events-queue"
    assert info["resource_type"] == "queues"

def test_inspect_dynamodb_request():
    headers = {
        "x-amz-target": "DynamoDB_20120810.PutItem",
        "Content-Type": "application/x-amz-json-1.0"
    }
    body = b'{"TableName": "users", "Item": {"userId": {"S": "u123"}}}'
    info = AwsRequestInspector.inspect_request("POST", "/", headers, body)
    
    assert info["service"] == "dynamodb"
    assert info["action"] == "PutItem"
    assert info["resource_name"] == "users"

def test_detect_missing_sqs_queue():
    req_info = {
        "service": "sqs",
        "action": "SendMessage",
        "resource_name": "missing-orders-queue",
        "resource_type": "queues"
    }
    error_body = b'{"__type": "com.amazonaws.sqs#QueueDoesNotExist", "message": "The specified queue does not exist"}'
    missing = MissingResourceDetector.detect(req_info, 400, error_body)
    
    assert missing is not None
    assert missing["service"] == "sqs"
    assert missing["resource_name"] == "missing-orders-queue"
    assert missing["error_code"] == "QueueDoesNotExist"
    assert "suggested_spec" in missing

def test_detect_missing_s3_bucket():
    req_info = {
        "service": "s3",
        "action": "PUT",
        "resource_name": "user-avatars-bucket",
        "resource_type": "buckets"
    }
    error_body = b'<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message><BucketName>user-avatars-bucket</BucketName></Error>'
    missing = MissingResourceDetector.detect(req_info, 404, error_body)
    
    assert missing is not None
    assert missing["service"] == "s3"
    assert missing["resource_name"] == "user-avatars-bucket"
    assert missing["suggested_spec"]["name"] == "user-avatars-bucket"

def test_config_manager_load_and_add(tmp_path):
    test_yaml_path = tmp_path / "test_resources.yaml"
    test_yaml_path.write_text("""# Initial config
version: "1.0"
services:
  s3:
    buckets:
      - name: initial-bucket
""")

    cm = ConfigManager(config_path=str(test_yaml_path))
    cfg = cm.load_config()
    assert len(cfg.services.s3["buckets"]) == 1
    assert cfg.services.s3["buckets"][0].name == "initial-bucket"

    # Add new SQS queue
    success = cm.add_resource("sqs", "queues", {"name": "dynamic-queue", "attributes": {"VisibilityTimeout": "60"}})
    assert success is True

    # Reload and verify
    cfg_updated = cm.load_config()
    assert len(cfg_updated.services.sqs["queues"]) == 1
    assert cfg_updated.services.sqs["queues"][0].name == "dynamic-queue"
    assert cfg_updated.services.s3["buckets"][0].name == "initial-bucket"

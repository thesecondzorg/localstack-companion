from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class S3BucketSpec(BaseModel):
    name: str
    acl: Optional[str] = "private"
    cors: Optional[Dict[str, Any]] = None

class SQSQueueSpec(BaseModel):
    name: str
    attributes: Optional[Dict[str, str]] = Field(default_factory=dict)

class SNSSubscriptionSpec(BaseModel):
    protocol: str  # e.g., 'sqs', 'http', 'email'
    endpoint: str  # e.g., queue name or arn

class SNSTopicSpec(BaseModel):
    name: str
    subscriptions: Optional[List[SNSSubscriptionSpec]] = Field(default_factory=list)

class DynamoDBKeySpec(BaseModel):
    name: str
    type: str = "S"  # S, N, B

class DynamoDBTableSpec(BaseModel):
    tableName: str
    partitionKey: DynamoDBKeySpec
    sortKey: Optional[DynamoDBKeySpec] = None
    billingMode: Optional[str] = "PAY_PER_REQUEST"

class SecretSpec(BaseModel):
    name: str
    value: Optional[str] = ""
    description: Optional[str] = None

class SSMParameterSpec(BaseModel):
    name: str
    type: str = "String"
    value: str
    description: Optional[str] = None

class KMSKeySpec(BaseModel):
    alias: Optional[str] = None
    description: Optional[str] = None

class ServicesConfig(BaseModel):
    s3: Optional[Dict[str, List[S3BucketSpec]]] = Field(default_factory=lambda: {"buckets": []})
    sqs: Optional[Dict[str, List[SQSQueueSpec]]] = Field(default_factory=lambda: {"queues": []})
    sns: Optional[Dict[str, List[SNSTopicSpec]]] = Field(default_factory=lambda: {"topics": []})
    dynamodb: Optional[Dict[str, List[DynamoDBTableSpec]]] = Field(default_factory=lambda: {"tables": []})
    secretsmanager: Optional[Dict[str, List[SecretSpec]]] = Field(default_factory=lambda: {"secrets": []})
    ssm: Optional[Dict[str, List[SSMParameterSpec]]] = Field(default_factory=lambda: {"parameters": []})
    kms: Optional[Dict[str, List[KMSKeySpec]]] = Field(default_factory=lambda: {"keys": []})

class AppConfig(BaseModel):
    version: Optional[str] = "1.0"
    region: Optional[str] = "eu-west-1"
    services: ServicesConfig = Field(default_factory=ServicesConfig)

class MissingResourceEvent(BaseModel):
    id: str
    timestamp: str
    service: str
    resource_type: str
    resource_name: str
    operation: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    suggested_spec: Dict[str, Any] = Field(default_factory=dict)
    status: str = "PENDING"  # PENDING, CREATED, DISMISSED
    client_info: Optional[Dict[str, Any]] = None

class TrafficLog(BaseModel):
    id: str
    timestamp: str
    method: str
    path: str
    service: str
    action: str
    status_code: int
    duration_ms: float
    is_error: bool
    missing_resource: Optional[str] = None

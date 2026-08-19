import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.config_manager import ConfigManager
from app.provisioner import LocalStackProvisioner
from app.proxy import ProxyService
from app.websocket_manager import ws_manager
from app.models import (
    S3BucketSpec, SQSQueueSpec, SNSTopicSpec,
    DynamoDBTableSpec, SecretSpec, SSMParameterSpec, KMSKeySpec
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("companion")

# Singletons
config_manager = ConfigManager(config_path=settings.config_path)
provisioner = LocalStackProvisioner()
proxy_service = ProxyService(provisioner=provisioner, config_manager=config_manager)

import asyncio

async def reconcile_when_ready():
    """Wait for LocalStack to be available, then reconcile resources and broadcast."""
    logger.info("Waiting for LocalStack to become healthy...")
    for attempt in range(1, 31):
        health = provisioner.check_health()
        if health.get("status") == "UP":
            logger.info(f"LocalStack is UP! (Attempt {attempt}). Reconciling baseline AWS resources...")
            cfg = config_manager.load_config()
            results = provisioner.reconcile_all(cfg)
            logger.info(f"Startup provisioning completed: {results}")
            active = provisioner.get_all_active_resources()
            await ws_manager.broadcast("RESOURCES_UPDATED", active)
            await ws_manager.broadcast("HEALTH_CHANGED", {"status": "UP", "localstack": health})
            return
        await asyncio.sleep(2)
    logger.warning("LocalStack did not become healthy within 60s. Will reconcile on demand.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing LocalStack Companion...")
    logger.info(f"Target LocalStack: {settings.localstack_url}")
    logger.info(f"Config path: {settings.config_path}")
    
    # Launch async startup reconciliation task
    asyncio.create_task(reconcile_when_ready())
    
    yield
    logger.info("Shutting down LocalStack Companion.")

app = FastAPI(title="LocalStack Resource Companion", lifespan=lifespan)

# Allow CORS for Web UI development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WebSocket for Real-Time Updates ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot
        active = provisioner.get_all_active_resources()
        cfg = config_manager.load_config()
        health = provisioner.check_health()
        await websocket.send_json({
            "type": "INITIAL_STATE",
            "data": {
                "activeResources": active,
                "config": cfg.model_dump(),
                "pendingRequests": list(proxy_service.pending_requests.values()),
                "trafficHistory": proxy_service.traffic_history,
                "health": health,
                "settings": {
                    "autoCreate": settings.auto_create_missing,
                    "localstackUrl": settings.localstack_url,
                    "configPath": settings.config_path
                }
            }
        })
        while True:
            data = await websocket.receive_text()
            # Can handle incoming client commands if needed
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

# --- REST APIs for Companion UI ---
@app.get("/api/health")
def get_health():
    return {
        "status": "UP",
        "localstack": provisioner.check_health(),
        "configPath": settings.config_path
    }

@app.get("/api/resources")
def get_resources():
    return {
        "active": provisioner.get_all_active_resources(),
        "configured": config_manager.load_config().model_dump()
    }

@app.post("/api/resources/sync")
async def sync_resources():
    cfg = config_manager.load_config()
    results = provisioner.reconcile_all(cfg)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return {"status": "SUCCESS", "results": results, "active": active}

@app.get("/api/config/yaml")
def get_config_yaml():
    return {"yaml": config_manager.get_raw_yaml()}

@app.post("/api/config/yaml")
async def update_config_yaml(payload: Dict[str, str]):
    new_yaml = payload.get("yaml", "")
    config_manager.save_raw_yaml(new_yaml)
    # Sync new resources
    cfg = config_manager.load_config()
    provisioner.reconcile_all(cfg)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return {"status": "SUCCESS", "active": active}

@app.get("/api/pending-requests")
def get_pending_requests():
    return list(proxy_service.pending_requests.values())

@app.post("/api/pending-requests/{event_id}/approve")
async def approve_pending_request(event_id: str, custom_spec: Optional[Dict[str, Any]] = None):
    if event_id not in proxy_service.pending_requests:
        raise HTTPException(status_code=404, detail="Pending request not found")
    
    event = proxy_service.pending_requests[event_id]
    spec = custom_spec or event.suggested_spec
    service = event.service
    res_type = event.resource_type

    # 1. Provision in LocalStack
    prov_result = None
    if service == "s3":
        prov_result = provisioner.provision_s3_bucket(S3BucketSpec(**spec))
    elif service == "sqs":
        prov_result = provisioner.provision_sqs_queue(SQSQueueSpec(**spec))
    elif service == "sns":
        prov_result = provisioner.provision_sns_topic(SNSTopicSpec(**spec))
    elif service == "dynamodb":
        prov_result = provisioner.provision_dynamodb_table(DynamoDBTableSpec(**spec))
    elif service == "secretsmanager":
        prov_result = provisioner.provision_secret(SecretSpec(**spec))
    elif service == "ssm":
        prov_result = provisioner.provision_ssm_parameter(SSMParameterSpec(**spec))
    elif service == "kms":
        prov_result = provisioner.provision_kms_key(KMSKeySpec(**spec))

    # 2. Save into YAML config
    config_manager.add_resource(service, res_type, spec)

    # 3. Mark approved & remove from pending
    event.status = "CREATED"
    del proxy_service.pending_requests[event_id]

    # 4. Broadcast updates
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCE_APPROVED", {"eventId": event_id, "resource": spec})
    await ws_manager.broadcast("RESOURCES_UPDATED", active)

    return {"status": "SUCCESS", "provisionResult": prov_result, "active": active}

@app.post("/api/pending-requests/{event_id}/dismiss")
async def dismiss_pending_request(event_id: str):
    if event_id in proxy_service.pending_requests:
        del proxy_service.pending_requests[event_id]
    await ws_manager.broadcast("RESOURCE_DISMISSED", {"eventId": event_id})
    return {"status": "SUCCESS"}

@app.post("/api/resources/create")
async def create_manual_resource(payload: Dict[str, Any]):
    service = payload.get("service")
    res_type = payload.get("resource_type")
    spec = payload.get("spec", {})
    add_to_config = payload.get("add_to_config", True)

    prov_result = None
    if service == "s3":
        prov_result = provisioner.provision_s3_bucket(S3BucketSpec(**spec))
    elif service == "sqs":
        prov_result = provisioner.provision_sqs_queue(SQSQueueSpec(**spec))
    elif service == "sns":
        prov_result = provisioner.provision_sns_topic(SNSTopicSpec(**spec))
    elif service == "dynamodb":
        prov_result = provisioner.provision_dynamodb_table(DynamoDBTableSpec(**spec))
    elif service == "secretsmanager":
        prov_result = provisioner.provision_secret(SecretSpec(**spec))
    elif service == "ssm":
        prov_result = provisioner.provision_ssm_parameter(SSMParameterSpec(**spec))
    elif service == "kms":
        prov_result = provisioner.provision_kms_key(KMSKeySpec(**spec))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported service: {service}")

    if add_to_config:
        config_manager.add_resource(service, res_type, spec)

    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)

    return {"status": "SUCCESS", "provisionResult": prov_result, "active": active}

@app.delete("/api/resources/{service}/{resource_name:path}")
async def delete_resource_endpoint(service: str, resource_name: str, remove_from_config: bool = True):
    del_result = None
    res_type = "queues"
    
    if service == "s3":
        res_type = "buckets"
        del_result = provisioner.delete_s3_bucket(resource_name)
    elif service == "sqs":
        res_type = "queues"
        del_result = provisioner.delete_sqs_queue(resource_name)
    elif service == "sns":
        res_type = "topics"
        del_result = provisioner.delete_sns_topic(resource_name)
    elif service == "dynamodb":
        res_type = "tables"
        del_result = provisioner.delete_dynamodb_table(resource_name)
    elif service == "secretsmanager":
        res_type = "secrets"
        del_result = provisioner.delete_secret(resource_name)
    elif service == "ssm":
        res_type = "parameters"
        del_result = provisioner.delete_ssm_parameter(resource_name)
    elif service == "kms":
        res_type = "keys"
        del_result = provisioner.delete_kms_key(resource_name)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported service: {service}")

    if remove_from_config:
        config_manager.remove_resource(service, res_type, resource_name)

    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return {"status": "SUCCESS", "deleteResult": del_result, "active": active}

@app.post("/api/settings/auto-create")
async def toggle_auto_create(payload: Dict[str, bool]):
    enabled = payload.get("enabled", False)
    settings.auto_create_missing = enabled
    await ws_manager.broadcast("SETTINGS_CHANGED", {"autoCreate": settings.auto_create_missing})
    return {"status": "SUCCESS", "autoCreate": settings.auto_create_missing}

@app.get("/api/traffic")
def get_traffic_logs():
    return proxy_service.traffic_history

# =========================================================================
# INTERACTIVE RESOURCE DATA APIS (Send SQS, Upload S3, Edit Secrets/DynamoDB)
# =========================================================================

# --- SQS Operations ---
@app.post("/api/sqs/{queue_name}/send")
async def sqs_send_message_endpoint(queue_name: str, payload: Dict[str, Any]):
    message_body = payload.get("message", "")
    attributes = payload.get("attributes", {})
    res = provisioner.sqs_send_message(queue_name, message_body, attributes)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

@app.get("/api/sqs/{queue_name}/messages")
def sqs_get_messages_endpoint(queue_name: str, max_messages: int = 10):
    return provisioner.sqs_receive_messages(queue_name, max_messages)

@app.post("/api/sqs/{queue_name}/purge")
async def sqs_purge_endpoint(queue_name: str):
    res = provisioner.sqs_purge_queue(queue_name)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

# --- S3 Operations ---
@app.get("/api/s3/{bucket_name}/objects")
def s3_list_objects_endpoint(bucket_name: str):
    return provisioner.s3_list_objects(bucket_name)

@app.post("/api/s3/{bucket_name}/upload")
async def s3_upload_endpoint(bucket_name: str, payload: Dict[str, Any]):
    key = payload.get("key", "sample.txt")
    content = payload.get("content", "")
    content_type = payload.get("contentType", "text/plain")
    data = content.encode("utf-8") if isinstance(content, str) else content
    res = provisioner.s3_put_object(bucket_name, key, data, content_type)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

@app.get("/api/s3/{bucket_name}/objects/{key:path}")
def s3_get_object_endpoint(bucket_name: str, key: str):
    return provisioner.s3_get_object(bucket_name, key)

@app.delete("/api/s3/{bucket_name}/objects/{key:path}")
async def s3_delete_object_endpoint(bucket_name: str, key: str):
    res = provisioner.s3_delete_object(bucket_name, key)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

# --- Secrets Manager Operations ---
@app.get("/api/secrets/{secret_name:path}/value")
def secret_get_value_endpoint(secret_name: str):
    return provisioner.secret_get_value(secret_name)

@app.put("/api/secrets/{secret_name:path}/value")
async def secret_put_value_endpoint(secret_name: str, payload: Dict[str, Any]):
    value = payload.get("value", "")
    update_config = payload.get("updateConfig", True)
    res = provisioner.secret_put_value(secret_name, value)
    if update_config:
        config_manager.update_resource_field("secretsmanager", "secrets", secret_name, "value", value)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

# --- DynamoDB Operations ---
@app.get("/api/dynamodb/{table_name}/items")
def dynamodb_scan_endpoint(table_name: str, limit: int = 50):
    return provisioner.dynamodb_scan_items(table_name, limit)

@app.post("/api/dynamodb/{table_name}/items")
async def dynamodb_put_item_endpoint(table_name: str, payload: Dict[str, Any]):
    item = payload.get("item", {})
    res = provisioner.dynamodb_put_item(table_name, item)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

@app.delete("/api/dynamodb/{table_name}/items")
async def dynamodb_delete_item_endpoint(table_name: str, payload: Dict[str, Any]):
    key = payload.get("key", {})
    res = provisioner.dynamodb_delete_item(table_name, key)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

# --- SSM Parameter Store Operations ---
@app.get("/api/ssm/{param_name:path}/value")
def ssm_get_value_endpoint(param_name: str):
    return provisioner.ssm_get_value(param_name)

@app.put("/api/ssm/{param_name:path}/value")
async def ssm_put_value_endpoint(param_name: str, payload: Dict[str, Any]):
    value = payload.get("value", "")
    param_type = payload.get("type", "String")
    update_config = payload.get("updateConfig", True)
    res = provisioner.ssm_put_value(param_name, value, param_type)
    if update_config:
        config_manager.update_resource_field("ssm", "parameters", param_name, "value", value)
    active = provisioner.get_all_active_resources()
    await ws_manager.broadcast("RESOURCES_UPDATED", active)
    return res

# --- SNS Operations ---
@app.post("/api/sns/{topic_name}/publish")
async def sns_publish_endpoint(topic_name: str, payload: Dict[str, Any]):
    message = payload.get("message", "")
    subject = payload.get("subject")
    return provisioner.sns_publish(topic_name, message, subject)

# --- Static Frontend Serving ---
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    
    @app.get("/ui")
    @app.get("/ui/{full_path:path}")
    def serve_ui(full_path: str = ""):
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse({"message": "Frontend not built yet. Run npm run build in frontend directory."}, status_code=404)

# --- Transparent Reverse Proxy Catch-all for AWS Requests ---
# Any path not matched by /api, /ws, or /ui is handled as an AWS API call forwarded to LocalStack
@app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"])
async def aws_proxy_handler(request: Request, path_name: str):
    # If root request with accept text/html and browser, redirect to /ui if static exists
    if path_name == "" and "text/html" in request.headers.get("accept", ""):
        if os.path.exists(os.path.join(static_dir, "index.html")):
            return FileResponse(os.path.join(static_dir, "index.html"))
    return await proxy_service.forward_request(request)

import time
import uuid
import re
from datetime import datetime
from typing import Dict, Any, Optional
import httpx
from fastapi import Request, Response
from starlette.responses import StreamingResponse
import logging

from app.config import settings
from app.interceptor import AwsRequestInspector, MissingResourceDetector
from app.websocket_manager import ws_manager
from app.models import MissingResourceEvent, TrafficLog

logger = logging.getLogger("proxy")

class ProxyService:
    def __init__(self, provisioner, config_manager):
        self.provisioner = provisioner
        self.config_manager = config_manager
        self.pending_requests: Dict[str, MissingResourceEvent] = {}
        self.traffic_history = []
        self.max_traffic_history = 100

    async def forward_request(self, request: Request) -> Response:
        start_time = time.time()
        
        # Read body
        body = await request.body()
        
        # Forward headers but set Host to localhost:4566 so LocalStack routes correctly
        headers = dict(request.headers)
        client_host = request.headers.get("host", "localhost:4566")
        headers["host"] = "localhost:4566"
        headers.pop("content-length", None)
        
        target_url = f"{settings.localstack_url}{request.url.path}"
        if request.url.query:
            target_url += f"?{request.url.query}"

        # Inspect AWS metadata
        req_info = AwsRequestInspector.inspect_request(
            method=request.method,
            path=request.url.path,
            headers=dict(request.headers),
            body=body
        )

        log_id = str(uuid.uuid4())[:8]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=headers,
                    content=body,
                    follow_redirects=True
                )
                
                resp_body = resp.content
                duration_ms = round((time.time() - start_time) * 1000, 2)
                
                # Check for missing resource
                missing = MissingResourceDetector.detect(req_info, resp.status_code, resp_body)
                missing_name = None

                # Verify if resource actually exists before alerting
                if missing:
                    service = missing["service"]
                    res_name = missing["resource_name"]
                    already_exists = False
                    try:
                        active = self.provisioner.get_all_active_resources()
                        if service == "sqs":
                            already_exists = any(q["name"] == res_name for q in active.get("sqs", []))
                        elif service == "s3":
                            already_exists = any(b["name"] == res_name for b in active.get("s3", []))
                        elif service == "dynamodb":
                            already_exists = any(t["tableName"] == res_name for t in active.get("dynamodb", []))
                    except Exception:
                        pass

                    if not already_exists:
                        missing_name = f"{missing['service']}:{missing['resource_name']}"
                        event_id = f"{missing['service']}_{missing['resource_name']}_{int(time.time())}"
                        event = MissingResourceEvent(
                            id=event_id,
                            timestamp=datetime.now().strftime("%H:%M:%S"),
                            service=missing["service"],
                            resource_type=missing["resource_type"],
                            resource_name=missing["resource_name"],
                            operation=missing["operation"],
                            error_code=missing["error_code"],
                            error_message=missing["error_message"],
                            suggested_spec=missing["suggested_spec"],
                            client_info={
                                "client_host": request.client.host if request.client else "unknown",
                                "method": request.method,
                                "path": request.url.path
                            }
                        )
                        
                        # Store in pending requests
                        self.pending_requests[event_id] = event
                        
                        # Broadcast to Web UI
                        await ws_manager.broadcast("MISSING_RESOURCE", event.model_dump())
                        logger.warning(f"Detected missing resource request: {missing_name} (Op: {missing['operation']})")

                        # If auto_create_missing is active, provision immediately and retry!
                        if settings.auto_create_missing:
                            logger.info(f"Auto-create mode enabled: Provisioning {missing_name} immediately...")
                            await self.handle_auto_create(missing)
                            # Retry request to LocalStack!
                            retry_resp = await client.request(
                                method=request.method,
                                url=target_url,
                                headers=headers,
                                content=body,
                                follow_redirects=True
                            )
                            resp = retry_resp
                            resp_body = retry_resp.content

                # Rewrite URLs in response body (e.g. QueueUrl) to point back to the proxy port :4566
                if resp_body and (b"http://" in resp_body or b"https://" in resp_body):
                    try:
                        text = resp_body.decode("utf-8")
                        # Replace internal localstack URLs with client accessible host
                        text = re.sub(r"http://(localstack|localhost:4567|sqs\.[a-z0-9-]+\.localhost\.localstack\.cloud:4566|localhost\.localstack\.cloud:4566)", f"http://{client_host}", text)
                        resp_body = text.encode("utf-8")
                    except Exception:
                        pass

                # Log traffic
                traffic_item = TrafficLog(
                    id=log_id,
                    timestamp=datetime.now().strftime("%H:%M:%S"),
                    method=request.method,
                    path=request.url.path,
                    service=req_info.get("service", "other"),
                    action=req_info.get("action", request.method),
                    status_code=resp.status_code,
                    duration_ms=duration_ms,
                    is_error=resp.status_code >= 400,
                    missing_resource=missing_name
                )
                self.traffic_history.insert(0, traffic_item.model_dump())
                if len(self.traffic_history) > self.max_traffic_history:
                    self.traffic_history.pop()

                # Stream log to UI
                await ws_manager.broadcast("TRAFFIC_LOG", traffic_item.model_dump())

                # Build response headers
                response_headers = dict(resp.headers)
                response_headers.pop("content-encoding", None)
                response_headers.pop("content-length", None)
                response_headers.pop("transfer-encoding", None)

                return Response(
                    content=resp_body,
                    status_code=resp.status_code,
                    headers=response_headers,
                    media_type=resp.headers.get("content-type")
                )

        except Exception as e:
            logger.error(f"Proxy forwarding error for {target_url}: {e}")
            return Response(
                content=f'{{"error": "Companion Proxy failed to connect to LocalStack at {settings.localstack_url}", "details": "{str(e)}"}}',
                status_code=502,
                media_type="application/json"
            )

    async def handle_auto_create(self, missing: Dict[str, Any]):
        service = missing["service"]
        res_type = missing["resource_type"]
        spec = missing["suggested_spec"]
        
        # 1. Provision in LocalStack
        if service == "s3":
            from app.models import S3BucketSpec
            self.provisioner.provision_s3_bucket(S3BucketSpec(**spec))
        elif service == "sqs":
            from app.models import SQSQueueSpec
            self.provisioner.provision_sqs_queue(SQSQueueSpec(**spec))
        elif service == "sns":
            from app.models import SNSTopicSpec
            self.provisioner.provision_sns_topic(SNSTopicSpec(**spec))
        elif service == "dynamodb":
            from app.models import DynamoDBTableSpec
            self.provisioner.provision_dynamodb_table(DynamoDBTableSpec(**spec))
        elif service == "secretsmanager":
            from app.models import SecretSpec
            self.provisioner.provision_secret(SecretSpec(**spec))
        elif service == "ssm":
            from app.models import SSMParameterSpec
            self.provisioner.provision_ssm_parameter(SSMParameterSpec(**spec))
            
        # 2. Add to YAML
        self.config_manager.add_resource(service, res_type, spec)
        
        # 3. Broadcast updated resources
        active = self.provisioner.get_all_active_resources()
        await ws_manager.broadcast("RESOURCES_UPDATED", active)

import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("websocket_manager")

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: any):
        if not self.active_connections:
            return
        payload = json.dumps({"type": event_type, "data": data})
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Error sending websocket message: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

ws_manager = WebSocketManager()

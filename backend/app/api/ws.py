import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, redis_client
from app.models.models import Message

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps session_id to a list of (participant_id, WebSocket)
        self.active_connections: dict[str, list[tuple[str, WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, session_id: str, participant_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append((participant_id, websocket))
        
        # Add to Redis presence
        await redis_client.hset(f"session:{session_id}:participants", participant_id, "connected")

    async def disconnect(self, websocket: WebSocket, session_id: str, participant_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id] = [
                conn for conn in self.active_connections[session_id] if conn[0] != participant_id
            ]
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                
        # Remove from Redis presence
        await redis_client.hdel(f"session:{session_id}:participants", participant_id)

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for _, connection in self.active_connections[session_id]:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

@router.websocket("/{session_id}/{participant_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, participant_id: str, db: AsyncSession = Depends(get_db)):
    await manager.connect(websocket, session_id, participant_id)
    await manager.broadcast(session_id, {
        "type": "participant_connected",
        "participant_id": participant_id
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("type") == "chat_message":
                text = payload.get("text")
                # Save to DB
                new_msg = Message(
                    session_id=uuid.UUID(session_id),
                    sender_id=uuid.UUID(participant_id),
                    content=text
                )
                db.add(new_msg)
                await db.commit()
                
                await manager.broadcast(session_id, {
                    "type": "chat_message",
                    "participant_id": participant_id,
                    "text": text
                })
            
            elif payload.get("type") in ["mute_changed", "camera_changed"]:
                await manager.broadcast(session_id, {
                    "type": payload.get("type"),
                    "participant_id": participant_id,
                    "state": payload.get("state")
                })
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, session_id, participant_id)
        await manager.broadcast(session_id, {
            "type": "participant_disconnected",
            "participant_id": participant_id
        })

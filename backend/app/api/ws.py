import json
import uuid
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, redis_client
from app.models.models import Message, Participant
from sqlalchemy.future import select

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps session_id to a list of (participant_id, WebSocket)
        self.active_connections: dict[str, list[tuple[str, WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, session_id: str, participant_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        
        # Remove old connection if it exists
        self.active_connections[session_id] = [conn for conn in self.active_connections[session_id] if conn[0] != participant_id]
        self.active_connections[session_id].append((participant_id, websocket))
        
        # Add to Redis presence
        await redis_client.hset(f"session:{session_id}:participants", participant_id, "connected")
        
        # Broadcast connected status instead of pure connected to support reconnect
        await self.broadcast(session_id, {
            "type": "participant_status",
            "participant_id": participant_id,
            "status": "CONNECTED"
        })
        
        # Inform the newly connected participant about already connected participants
        for existing_participant, _ in self.active_connections[session_id]:
            if existing_participant != participant_id:
                await websocket.send_text(json.dumps({
                    "type": "participant_status",
                    "participant_id": existing_participant,
                    "status": "CONNECTED"
                }))

    async def disconnect(self, websocket: WebSocket, session_id: str, participant_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id] = [
                conn for conn in self.active_connections[session_id] if conn[1] != websocket
            ]
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                
        # Update Redis presence
        await redis_client.hset(f"session:{session_id}:participants", participant_id, "disconnected")
        
        # Broadcast DISCONNECTED status
        await self.broadcast(session_id, {
            "type": "participant_status",
            "participant_id": participant_id,
            "status": "DISCONNECTED"
        })
        
        # Start grace period
        asyncio.create_task(self.handle_disconnect_grace_period(session_id, participant_id))

    async def handle_disconnect_grace_period(self, session_id: str, participant_id: str):
        await asyncio.sleep(30) # 30 seconds grace period
        status = await redis_client.hget(f"session:{session_id}:participants", participant_id)
        if status == "disconnected":
            await redis_client.hdel(f"session:{session_id}:participants", participant_id)
            await self.broadcast(session_id, {
                "type": "participant_status",
                "participant_id": participant_id,
                "status": "LEFT"
            })

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for _, connection in self.active_connections[session_id]:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

@router.websocket("/{session_id}/{participant_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, participant_id: str, secret: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Participant).where(
        Participant.id == participant_id, 
        Participant.session_id == session_id, 
        Participant.secret_token == secret
    ))
    participant = result.scalars().first()
    if not participant:
        await websocket.accept()
        await websocket.close(code=1008, reason="Invalid participant secret")
        return

    try:
        await manager.connect(websocket, session_id, participant_id)
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
                    "state": payload.get("state"),
                    "start_time": payload.get("start_time")
                })
                
    except Exception:
        await manager.disconnect(websocket, session_id, participant_id)

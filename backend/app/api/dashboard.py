import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.core.config import settings
from app.core.database import get_db, redis_client
from app.models.models import Session, Participant, Message, SessionEvent, SessionStatus, ParticipantRole

router = APIRouter()

async def verify_dashboard_secret(x_dashboard_secret: str = Header(None)):
    if x_dashboard_secret != settings.DASHBOARD_ACCESS_CODE:
        raise HTTPException(status_code=403, detail="Invalid Dashboard Access Code")
    return x_dashboard_secret

@router.get("/overview")
async def get_dashboard_overview(db: AsyncSession = Depends(get_db), auth: str = Depends(verify_dashboard_secret)) -> Dict[str, Any]:
    # Total sessions
    total_result = await db.execute(select(func.count(Session.id)))
    total_sessions = total_result.scalar_one()

    # Active sessions
    active_result = await db.execute(select(func.count(Session.id)).where(Session.status == SessionStatus.ACTIVE))
    active_sessions = active_result.scalar_one()

    # We can get connected participants either from DB active sessions or Redis.
    # Let's count from Redis for real-time accuracy.
    connected_participants = 0
    
    # Alternatively count all participants from active sessions as an approximation
    # since this is for hackathon
    active_session_ids_result = await db.execute(select(Session.id).where(Session.status == SessionStatus.ACTIVE))
    active_session_ids = active_session_ids_result.scalars().all()
    for sid in active_session_ids:
        parts = await redis_client.hkeys(f"session:{sid}:participants")
        connected_participants += len(parts)

    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "connected_participants": connected_participants
    }

@router.get("/sessions")
async def get_dashboard_sessions(db: AsyncSession = Depends(get_db), auth: str = Depends(verify_dashboard_secret)) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.participants))
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()
    
    output = []
    for s in sessions:
        agent = next((p.display_name for p in s.participants if p.role == "AGENT"), "Unknown")
        customer = next((p.display_name for p in s.participants if p.role == "CUSTOMER"), "Waiting...")
        
        # Calculate duration if ended, else from created_at to now
        ended_event_result = await db.execute(
            select(SessionEvent).where(SessionEvent.session_id == s.id, SessionEvent.event_type == "session_ended")
        )
        ended_event = ended_event_result.scalars().first()
        ended_at = ended_event.created_at if ended_event else None
        
        duration = 0
        if ended_at:
            duration = int((ended_at - s.created_at).total_seconds())
        elif s.status == SessionStatus.ACTIVE:
            # We don't have a reliable end time, just use None or 0 and let frontend calculate live duration
            duration = 0
            
        output.append({
            "id": str(s.id),
            "invite_code": s.short_code or s.invite_token[:6],
            "created_at": s.created_at.isoformat(),
            "ended_at": ended_at.isoformat() if ended_at else None,
            "duration": duration,
            "agent": agent,
            "customer": customer,
            "status": s.status.value,
            "participant_count": len(s.participants),
            "agent_secret": next((p.secret_token for p in s.participants if p.role == ParticipantRole.AGENT), None)
        })
        
    return output

@router.get("/sessions/{session_id}")
async def get_dashboard_session_details(session_id: uuid.UUID, db: AsyncSession = Depends(get_db), auth: str = Depends(verify_dashboard_secret)) -> Dict[str, Any]:
    result = await db.execute(
        select(Session)
        .options(
            selectinload(Session.participants),
            selectinload(Session.messages).selectinload(Message.sender),
            selectinload(Session.files)
        )
        .where(Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    events_result = await db.execute(
        select(SessionEvent).where(SessionEvent.session_id == session_id).order_by(SessionEvent.created_at.asc())
    )
    events = events_result.scalars().all()

    ended_event = next((e for e in events if e.event_type == "session_ended"), None)
    ended_at = ended_event.created_at if ended_event else None
    duration = int((ended_at - session.created_at).total_seconds()) if ended_at else 0

    return {
        "id": str(session.id),
        "invite_code": session.short_code or session.invite_token[:6],
        "status": session.status.value,
        "created_at": session.created_at.isoformat(),
        "ended_at": ended_at.isoformat() if ended_at else None,
        "duration": duration,
        "agent_secret": next((p.secret_token for p in session.participants if p.role == ParticipantRole.AGENT), None),
        "participants": [
            {
                "id": str(p.id),
                "display_name": p.display_name,
                "role": p.role.value,
                "joined_at": p.joined_at.isoformat()
            } for p in session.participants
        ],
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "payload": e.payload,
                "created_at": e.created_at.isoformat()
            } for e in events
        ],
        "messages": [
            {
                "id": str(m.id),
                "sender_name": m.sender.display_name,
                "sender_role": m.sender.role.value,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            } for m in sorted(session.messages, key=lambda msg: msg.created_at)
        ],
        "files": [
            {
                "filename": f.filename,
                "uploader": f.uploader,
                "file_size": f.file_size,
                "uploaded_at": f.uploaded_at.isoformat()
            } for f in session.files
        ]
    }

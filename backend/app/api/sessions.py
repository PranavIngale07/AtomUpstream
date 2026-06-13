import uuid
import secrets
import random
import string
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from loguru import logger

from app.core.database import get_db, redis_client
from app.models.models import Session, Participant, SessionStatus, ParticipantRole, SessionEvent, Message
from app.schemas.schemas import SessionCreateResponse, SessionResponse, ParticipantJoinRequest, ParticipantPrivateResponse, ParticipantPublicResponse, IdentityRequest
from app.api.ws import manager

router = APIRouter()

@router.post("/identity", response_model=ParticipantPrivateResponse)
async def create_identity(req: IdentityRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Creating global identity for role: {req.role}")
    participant = Participant(role=req.role, display_name=req.role.value.capitalize())
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return participant

@router.post("/", response_model=SessionCreateResponse)
async def create_session(x_participant_secret: str = Header(...), db: AsyncSession = Depends(get_db)):
    # Verify participant is an AGENT
    result = await db.execute(select(Participant).where(Participant.secret_token == x_participant_secret))
    participant = result.scalars().first()
    if not participant or participant.role != ParticipantRole.AGENT:
        logger.warning("Unauthorized session creation attempt")
        raise HTTPException(status_code=403, detail="Only agents can create sessions")

    logger.info("Creating new support session")
    invite_token = secrets.token_urlsafe(16)
    short_code = ''.join(random.choices(string.digits, k=6))
    new_session = Session(invite_token=invite_token, short_code=short_code, status=SessionStatus.CREATED)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    participant.session_id = new_session.id
    await db.commit()
    
    await redis_client.set(f"session:{str(new_session.id)}:active", "true")
    
    logger.success(f"Session created with ID: {new_session.id}")
    return SessionCreateResponse(
        id=new_session.id,
        invite_token=new_session.invite_token,
        short_code=new_session.short_code,
        status=new_session.status,
        agent_id=participant.id,
        agent_secret=participant.secret_token
    )

@router.get("/{invite_token}", response_model=SessionResponse)
async def get_session_by_invite(invite_token: str, db: AsyncSession = Depends(get_db)):
    logger.info(f"Fetching session for invite: {invite_token}")
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.participants))
        .where((Session.invite_token == invite_token) | (Session.short_code == invite_token))
    )
    session = result.scalars().first()
    
    if not session:
        logger.warning(f"Session not found for invite: {invite_token}")
        raise HTTPException(status_code=404, detail="Session not found or invalid invite link")
    
    return session

@router.post("/{invite_token}/join", response_model=ParticipantPrivateResponse)
async def join_session(invite_token: str, data: ParticipantJoinRequest, x_participant_secret: str = Header(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Participant).where(Participant.secret_token == x_participant_secret))
    participant = result.scalars().first()
    if not participant or participant.role != ParticipantRole.CUSTOMER:
        logger.warning("Unauthorized session join attempt")
        raise HTTPException(status_code=403, detail="Only customers can join via invite")

    logger.info(f"Participant '{data.display_name}' joining via invite/code: {invite_token}")
    result = await db.execute(
        select(Session)
        .where((Session.invite_token == invite_token) | (Session.short_code == invite_token))
    )
    session = result.scalars().first()
    
    if not session:
        logger.warning(f"Invalid invite link used: {invite_token}")
        raise HTTPException(status_code=404, detail="Invalid invite link")
    if session.status == SessionStatus.ENDED:
        logger.warning(f"Attempt to join ended session: {session.id}")
        raise HTTPException(status_code=400, detail="Session already ended")
    
    if session.status == SessionStatus.CREATED:
        session.status = SessionStatus.ACTIVE
        logger.info(f"Session {session.id} status changed to ACTIVE")
    
    participant.session_id = session.id
    participant.display_name = data.display_name
    
    event = SessionEvent(session_id=session.id, event_type="participant_joined", payload=f'{{"participant": "{data.display_name}"}}')
    db.add(event)
    
    await db.commit()
    await db.refresh(participant)
    
    logger.success(f"Participant '{data.display_name}' joined session {session.id}")
    return participant

@router.get("/{session_id}/participant/{participant_id}", response_model=ParticipantPublicResponse)
async def get_participant(session_id: uuid.UUID, participant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Participant).where(Participant.id == participant_id, Participant.session_id == session_id))
    participant = result.scalars().first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    return participant

async def _validate_participant_secret(session_id: uuid.UUID, x_participant_secret: str, db: AsyncSession):
    if not x_participant_secret:
        raise HTTPException(status_code=401, detail="Missing participant secret")
    result = await db.execute(select(Participant).where(Participant.secret_token == x_participant_secret, Participant.session_id == session_id))
    participant = result.scalars().first()
    if not participant:
        raise HTTPException(status_code=403, detail="Invalid participant secret for this session")
    return participant

@router.get("/{session_id}/chat")
async def get_chat_history(session_id: uuid.UUID, x_participant_secret: str = Header(...), db: AsyncSession = Depends(get_db)):
    participant = await _validate_participant_secret(session_id, x_participant_secret, db)
    
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [{
        "id": m.id,
        "text": m.content,
        "timestamp": m.created_at,
        "sender": m.sender.display_name,
        "sender_role": m.sender.role,
        "participant_id": m.sender_id
    } for m in messages]

@router.get("/{session_id}/history")
async def get_session_history(session_id: uuid.UUID, x_participant_secret: str = Header(...), db: AsyncSession = Depends(get_db)):
    participant = await _validate_participant_secret(session_id, x_participant_secret, db)
    
    result = await db.execute(select(Session).options(selectinload(Session.participants)).where(Session.id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    events_res = await db.execute(select(SessionEvent).where(SessionEvent.session_id == session_id).order_by(SessionEvent.created_at.asc()))
    events = events_res.scalars().all()
    
    msg_count_res = await db.execute(select(func.count(Message.id)).where(Message.session_id == session_id))
    msg_count = msg_count_res.scalar()
    
    return {
        "id": session.id,
        "status": session.status,
        "created_at": session.created_at,
        "participants": [{"id": p.id, "role": p.role, "display_name": p.display_name, "joined_at": p.joined_at} for p in session.participants],
        "events": [{"type": e.event_type, "payload": e.payload, "timestamp": e.created_at} for e in events],
        "message_count": msg_count
    }

@router.post("/{session_id}/end")
async def end_session(session_id: uuid.UUID, x_participant_secret: str = Header(...), db: AsyncSession = Depends(get_db)):
    participant = await _validate_participant_secret(session_id, x_participant_secret, db)
    logger.info(f"Ending session: {session_id} requested by {participant.id}")
    
    # Verify participant is an AGENT
    if participant.role != ParticipantRole.AGENT:
        logger.warning(f"Unauthorized end session attempt by {participant.id}")
        raise HTTPException(status_code=403, detail="Only agents can end the session")

    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalars().first()
    
    if not session:
        logger.warning(f"End requested for non-existent session: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.status = SessionStatus.ENDED
    event = SessionEvent(session_id=session.id, event_type="session_ended", payload='{}')
    db.add(event)
    await db.commit()
    
    await redis_client.delete(f"session:{str(session_id)}:active")
    
    # Broadcast session end to all connected WebSockets
    await manager.broadcast(str(session_id), {"type": "session_ended"})
    
    logger.success(f"Session {session_id} ended successfully")
    return {"status": "ended"}

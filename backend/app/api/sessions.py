import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from loguru import logger

from app.core.database import get_db, redis_client
from app.models.models import Session, Participant, SessionStatus, ParticipantRole, SessionEvent
from app.schemas.schemas import SessionCreateResponse, SessionResponse, ParticipantJoinRequest, ParticipantResponse

router = APIRouter()

@router.post("/", response_model=SessionCreateResponse)
async def create_session(db: AsyncSession = Depends(get_db)):
    logger.info("Creating new support session")
    invite_token = secrets.token_urlsafe(16)
    new_session = Session(invite_token=invite_token, status=SessionStatus.CREATED)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    agent = Participant(session_id=new_session.id, role=ParticipantRole.AGENT, display_name="Agent")
    db.add(agent)
    await db.commit()
    
    await redis_client.set(f"session:{str(new_session.id)}:active", "true")
    
    logger.success(f"Session created with ID: {new_session.id}")
    return SessionCreateResponse(
        id=new_session.id,
        invite_token=new_session.invite_token,
        status=new_session.status
    )

@router.get("/{invite_token}", response_model=SessionResponse)
async def get_session_by_invite(invite_token: str, db: AsyncSession = Depends(get_db)):
    logger.info(f"Fetching session for invite: {invite_token}")
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.participants))
        .where(Session.invite_token == invite_token)
    )
    session = result.scalars().first()
    
    if not session:
        logger.warning(f"Session not found for invite: {invite_token}")
        raise HTTPException(status_code=404, detail="Session not found or invalid invite link")
    
    return session

@router.post("/{invite_token}/join", response_model=ParticipantResponse)
async def join_session(invite_token: str, data: ParticipantJoinRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f"Participant '{data.display_name}' joining via invite: {invite_token}")
    result = await db.execute(select(Session).where(Session.invite_token == invite_token))
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
    
    participant = Participant(session_id=session.id, role=ParticipantRole.CUSTOMER, display_name=data.display_name)
    db.add(participant)
    
    event = SessionEvent(session_id=session.id, event_type="participant_joined", payload=f'{{"participant": "{data.display_name}"}}')
    db.add(event)
    
    await db.commit()
    await db.refresh(participant)
    
    logger.success(f"Participant '{data.display_name}' joined session {session.id}")
    return participant

@router.post("/{session_id}/end")
async def end_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    logger.info(f"Ending session: {session_id}")
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
    
    logger.success(f"Session {session_id} ended successfully")
    return {"status": "ended"}

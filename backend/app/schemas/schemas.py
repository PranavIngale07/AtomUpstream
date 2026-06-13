from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.models import SessionStatus, ParticipantRole

class SessionCreateResponse(BaseModel):
    id: UUID
    invite_token: str
    short_code: str
    status: SessionStatus
    agent_id: UUID
    agent_secret: str

class IdentityRequest(BaseModel):
    role: ParticipantRole
    access_code: Optional[str] = None

class ParticipantJoinRequest(BaseModel):
    display_name: str

class ParticipantPublicResponse(BaseModel):
    id: UUID
    session_id: Optional[UUID] = None
    role: ParticipantRole
    display_name: str
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ParticipantPrivateResponse(BaseModel):
    id: UUID
    session_id: Optional[UUID] = None
    role: ParticipantRole
    display_name: str
    joined_at: datetime
    secret_token: str
    
    model_config = ConfigDict(from_attributes=True)

class SessionResponse(BaseModel):
    id: UUID
    invite_token: str
    short_code: str
    status: SessionStatus
    participants: List[ParticipantPublicResponse]

    model_config = ConfigDict(from_attributes=True)

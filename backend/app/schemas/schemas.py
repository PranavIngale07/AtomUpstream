from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.models import SessionStatus, ParticipantRole

class SessionCreateResponse(BaseModel):
    id: UUID
    invite_token: str
    status: SessionStatus

class ParticipantJoinRequest(BaseModel):
    display_name: str

class ParticipantResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: ParticipantRole
    display_name: str
    joined_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class SessionResponse(BaseModel):
    id: UUID
    invite_token: str
    status: SessionStatus
    participants: List[ParticipantResponse]

    model_config = ConfigDict(from_attributes=True)

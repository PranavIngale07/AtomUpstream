import uuid
from datetime import datetime
from sqlalchemy import Column, String, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import enum
import secrets

class SessionStatus(str, enum.Enum):
    CREATED = "CREATED"
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"

class ParticipantRole(str, enum.Enum):
    AGENT = "AGENT"
    CUSTOMER = "CUSTOMER"

class Session(Base):
    __tablename__ = "sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invite_token = Column(String, unique=True, index=True)
    short_code = Column(String, unique=True, index=True, nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.CREATED)
    created_at = Column(DateTime, default=datetime.utcnow)

    participants = relationship("Participant", back_populates="session")
    messages = relationship("Message", back_populates="session")
    files = relationship("SessionFile", back_populates="session")

class Participant(Base):
    __tablename__ = "participants"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    secret_token = Column(String, default=lambda: secrets.token_urlsafe(32))
    role = Column(Enum(ParticipantRole))
    display_name = Column(String)
    joined_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="participants")
    messages = relationship("Message", back_populates="sender")

class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    sender_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"))
    content = Column(Text)
    message_type = Column(String, default="TEXT") # TEXT or FILE
    file_url = Column(String, nullable=True)
    file_size = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="messages")
    sender = relationship("Participant", back_populates="messages")

class SessionEvent(Base):
    __tablename__ = "session_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    event_type = Column(String)
    payload = Column(Text) # Stored as JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

class SessionFile(Base):
    __tablename__ = "session_files"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    uploader = Column(String)
    filename = Column(String)
    file_size = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="files")

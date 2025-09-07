from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, Integer, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

# Pydantic Models (API)
class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"

class ServiceType(str, Enum):
    X = "x"
    LINKEDIN = "linkedin"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    TWITTER = "twitter"
    REDDIT = "reddit"

class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None

class ErrorResponse(BaseResponse):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None

class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole = UserRole.USER
    created_at: datetime
    updated_at: Optional[datetime] = None

class CreateUserRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    full_name: Optional[str] = Field(None, description="User full name")

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseResponse):
    user: Optional[UserProfile] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

# Reply Models
class ReplyCreate(BaseModel):
    original_post: str = Field(..., description="Original post content")
    generated_reply: str = Field(..., description="AI generated reply")
    service_type: str = Field(..., description="Social media platform")
    post_url: Optional[str] = Field(None, description="URL of the original post")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class ReplyResponse(BaseModel):
    id: str
    user_id: str
    original_post: str
    generated_reply: str
    service_type: str
    post_url: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime]

class DashboardStats(BaseModel):
    total_replies: int
    today_replies: int
    week_replies: int
    month_replies: int
    daily_activity: List[Dict[str, Any]]
    top_services: List[Dict[str, Any]]

class RecentActivity(BaseModel):
    replies: List[ReplyResponse]
    total_count: int

# External Service URL Models
class ExternalServiceUrlResponse(BaseModel):
    service_name: str
    url: str
    is_active: bool
    last_checked: datetime
    cache_expires_at: Optional[datetime]

class ServiceUrlsResponse(BaseModel):
    pollinations_url: str
    cache_expires_at: Optional[datetime]
    last_updated: datetime

class GenerateReplyRequest(BaseModel):
    context: str = Field(..., description="The original post content to reply to")
    platform: str = Field(default="x", description="Social media platform")
    tone: str = Field(default="helpful", description="Tone of the reply")
    length: str = Field(default="medium", description="Length preference")

class GenerateReplyResponse(BaseModel):
    generated_prompt: str
    generated_response: Optional[str] = None
    remaining_replies: Optional[int] = None
    is_limit_reached: bool = False
    service_used: str = "pollinations"

# Tone Models
class ToneResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    is_preset: bool = True
    is_active: bool = True
    sort_order: int = 0
    user_id: Optional[str] = None

class ToneCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Tone identifier (lowercase, no spaces)")
    display_name: str = Field(..., min_length=1, max_length=100, description="Display name for the tone")
    description: Optional[str] = Field(None, max_length=500, description="Optional description of the tone")

class TonesListResponse(BaseModel):
    tones: List[ToneResponse]

# SQLAlchemy Models (Database)
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_user_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    replies = relationship("Reply", back_populates="user", cascade="all, delete-orphan")

class Reply(Base):
    __tablename__ = "replies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    original_post = Column(Text, nullable=False)
    generated_reply = Column(Text, nullable=False)
    service_type = Column(String, nullable=False, index=True)
    post_url = Column(String, nullable=True)
    reply_metadata = Column(Text, nullable=True)  # JSON stored as text
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="replies")

class ExternalServiceUrl(Base):
    __tablename__ = "external_service_urls"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_name = Column(String, nullable=False, unique=True, index=True)  # e.g., "pollinations"
    url = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    last_checked = Column(DateTime, default=datetime.utcnow)
    cache_expires_at = Column(DateTime, nullable=True)
    service_metadata = Column(Text, nullable=True)  # JSON for additional service info
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Tone(Base):
    __tablename__ = "tones"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)  # e.g., "neutral", "joke"
    display_name = Column(String, nullable=False)  # e.g., "👍 Neutral", "😂 Joke"
    description = Column(String, nullable=True)  # Optional description
    is_preset = Column(Boolean, default=True)  # True for system presets, False for user custom
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)  # For ordering in UI
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # NULL for presets, user ID for custom tones
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="custom_tones")
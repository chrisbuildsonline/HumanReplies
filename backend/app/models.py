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

# Reply Models - Privacy-First Analytics Only
class ReplyCreate(BaseModel):
    service_type: str = Field(..., description="Social media platform key (e.g., 'x', 'facebook', 'linkedin')")
    tone_type: Optional[str] = Field(None, description="Tone used for the reply")

class ReplyResponse(BaseModel):
    id: str
    user_id: Optional[str] = None  # Only included if user was logged in
    service_type: str
    tone_type: Optional[str] = None  # Tone used for the reply
    created_at: datetime

class DashboardStats(BaseModel):
    total_replies: int
    today_replies: int
    week_replies: int
    month_replies: int
    daily_activity: List[Dict[str, Any]]  # [{"date": "2025-01-01", "count": 5}]
    top_services: List[Dict[str, Any]]    # [{"service": "x", "count": 10, "percentage": 50.0}]

class RecentActivity(BaseModel):
    replies: List[ReplyResponse]  # Only contains: id, service_type, created_at (no sensitive data)
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

# User Settings Models
class UserSettingsResponse(BaseModel):
    id: str
    user_id: str
    writing_style: Optional[str] = None
    guardian_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class UserSettingsCreateRequest(BaseModel):
    writing_style: Optional[str] = Field(None, description="Instructions on writing style")
    guardian_text: Optional[str] = Field(None, description="Instructions on what NOT to add")

class UserSettingsUpdateRequest(BaseModel):
    writing_style: Optional[str] = Field(None, description="Instructions on writing style")
    guardian_text: Optional[str] = Field(None, description="Instructions on what NOT to add")

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
    user_settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    custom_tones = relationship("Tone", back_populates="user", cascade="all, delete-orphan")

class Reply(Base):
    __tablename__ = "replies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # NULL if user not logged in
    service_type = Column(String, nullable=False, index=True)  # e.g., "x", "facebook", "linkedin"
    tone_type = Column(String, nullable=True, index=True)  # The tone used: preset name or "custom" for user tones
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
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
    user = relationship("User", back_populates="custom_tones")

class UserSettings(Base):
    __tablename__ = "user_settings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    writing_style = Column(Text, nullable=True)  # Instructions on writing style
    guardian_text = Column(Text, nullable=True)  # Instructions on what NOT to add
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="user_settings")
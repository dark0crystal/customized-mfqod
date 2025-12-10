from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
import re

class LoginRequest(BaseModel):
    email_or_username: str = Field(..., description="Email address or username")
    password: str = Field(..., description="User password")

class LoginResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="Refresh token for token renewal")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: "UserInfo" = Field(..., description="User information")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_info: dict

class UserInfo(BaseModel):
    id: str = Field(..., description="User unique identifier")
    email: str = Field(..., description="User email address")
    username: Optional[str] = Field(None, description="Username")
    first_name: str = Field(..., description="User first name")
    last_name: str = Field(..., description="User last name")
    user_type: str = Field(..., description="User type (internal/external)")
    role: Optional[str] = Field(None, description="User role")
    permissions: Optional[List[str]] = Field(default_factory=list, description="User permissions")
    last_login: Optional[str] = Field(None, description="Last login timestamp")
    name: Optional[str] = None
    display_name: Optional[str] = None

class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, description="Strong password")
    first_name: str = Field(..., min_length=1, max_length=50, description="First name")
    last_name: str = Field(..., min_length=1, max_length=50, description="Last name")
    username: Optional[str] = Field(None, min_length=3, max_length=30, description="Username (optional)")
    phone_number: Optional[str] = Field(None, description="Phone number (optional)")
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        return v
    
    @validator('username')
    def validate_username(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9_.-]+$', v):
            raise ValueError('Username can only contain letters, numbers, dots, hyphens, and underscores')
        return v

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    user_type: str
    active: bool
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    ad_sync_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, user):
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            phone_number=user.phone_number,
            user_type=user.user_type.value,
            active=user.active,
            role=user.role.name if user.role else None,
            last_login=user.last_login,
            created_at=user.created_at,
            updated_at=user.updated_at,
            ad_sync_date=user.ad_sync_date
        )

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Refresh token")

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    
    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        return v

class ResetPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address for password reset")

class UserProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    phone_number: Optional[str] = Field(None)
    email: Optional[EmailStr] = Field(None)

class SendOTPRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address to send OTP to")

class VerifyOTPRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")

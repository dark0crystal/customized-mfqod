from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from datetime import datetime

# ==========================================
# EXISTING USER SCHEMAS
# ==========================================

class UserLogin(BaseModel):
    identifier: str 
    password: str

class UserRegister(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1)
    middle_name: Optional[str] = None
    last_name: str = Field(min_length=1)
    phone_number: str = Field(min_length=8, max_length=15)
    status_name: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return value

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        if not re.fullmatch(r"^\+?\d{8,15}$", value):
            raise ValueError("Phone number must contain only digits and may start with '+'.")
        return value

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    first_name: Optional[str] = Field(None, min_length=1)
    middle_name: Optional[str] = None
    last_name: Optional[str] = Field(None, min_length=1)
    phone_number: Optional[str] = Field(None, min_length=8, max_length=15)
    status_name: Optional[str] = None
    role_name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if value is None:
            return value
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return value

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        if value is None:
            return value
        if not re.fullmatch(r"^\+?\d{8,15}$", value):
            raise ValueError("Phone number must contain only digits and may start with '+'.")
        return value

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    name: str
    phone_number: str
    role: Optional[str] = None
    role_id: Optional[str] = None
    status: Optional[str] = None
    status_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class UserSearchResponse(BaseModel):
    users: List[UserResponse]
    total_count: int
    page: int
    limit: int
    total_pages: int

class UserSearchParams(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=10, ge=1, le=100)

class UserStatusUpdate(BaseModel):
    status_name: str

class UserRoleUpdate(BaseModel):
    role_name: str

class BulkUserAction(BaseModel):
    user_ids: List[str]
    action: str  # 'activate', 'deactivate', 'delete'

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        allowed_actions = ['activate', 'deactivate', 'delete']
        if value not in allowed_actions:
            raise ValueError(f"Action must be one of: {', '.join(allowed_actions)}")
        return value

class UserListResponse(BaseModel):
    message: str
    data: UserSearchResponse

# ==========================================
# NEW TOKEN MANAGEMENT SCHEMAS
# ==========================================

class RefreshTokenRequest(BaseModel):
    """Schema for refresh token requests"""
    refresh_token: str = Field(min_length=1, description="Valid refresh token")

class TokenResponse(BaseModel):
    """Schema for token responses"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = Field(default="bearer")
    expires_in: int = Field(description="Token expiration time in seconds")

class TokenInfoResponse(BaseModel):
    """Schema for token information response"""
    expires_at: Optional[str] = Field(description="Token expiration timestamp in ISO format")
    seconds_remaining: int = Field(ge=0, description="Seconds until token expires")
    minutes_remaining: int = Field(ge=0, description="Minutes until token expires")
    is_expired: bool = Field(description="Whether the token has expired")
    needs_refresh: bool = Field(description="Whether the token should be refreshed soon")

class TokenVerificationResponse(BaseModel):
    """Schema for token verification response"""
    valid: bool = Field(description="Whether the token is valid")
    user: Dict[str, Any] = Field(description="User information from token")
    token_refreshed: bool = Field(description="Whether a new token was issued")
    new_token: Optional[str] = Field(default=None, description="New access token if refreshed")

class SessionInfo(BaseModel):
    """Schema for session information"""
    user_id: str
    email: str
    role: str
    session_start: datetime
    last_activity: datetime
    expires_at: datetime
    is_active: bool

class UserLoginResponse(BaseModel):
    """Enhanced login response with token information"""
    message: str
    access_token: str
    refresh_token: str
    token_type: str = Field(default="bearer")
    expires_in: int = Field(description="Access token expiration time in seconds")
    user: Dict[str, Any] = Field(description="User information")

class CurrentUserResponse(BaseModel):
    """Response for current user endpoint"""
    user: Dict[str, Any] = Field(description="Current user information")
    token_refreshed: bool = Field(description="Whether the token was refreshed")
    new_token: Optional[str] = Field(default=None, description="New access token if refreshed")

# ==========================================
# AUTHENTICATION & AUTHORIZATION SCHEMAS
# ==========================================

class LoginAttempt(BaseModel):
    """Schema for login attempt tracking"""
    identifier: str
    success: bool
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    attempted_at: datetime

class PasswordReset(BaseModel):
    """Schema for password reset requests"""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            raise ValueError("Password must contain at least one special character.")
        return value

class ChangePassword(BaseModel):
    """Schema for password change requests"""
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            raise ValueError("Password must contain at least one special character.")
        return value

# ==========================================
# BULK OPERATIONS SCHEMAS
# ==========================================

class BulkUserActionResult(BaseModel):
    """Schema for bulk action results"""
    user_id: str
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class BulkUserActionResponse(BaseModel):
    """Schema for bulk action response"""
    message: str
    successful: List[BulkUserActionResult]
    errors: List[BulkUserActionResult]
    total_processed: int
    successful_count: int
    error_count: int

class BulkStatusUpdate(BaseModel):
    """Schema for bulk status updates"""
    user_ids: List[str] = Field(min_length=1)
    status_name: str

class BulkRoleUpdate(BaseModel):
    """Schema for bulk role updates"""
    user_ids: List[str] = Field(min_length=1)
    role_name: str

# ==========================================
# STATISTICS & REPORTING SCHEMAS
# ==========================================

class UserStatistics(BaseModel):
    """Schema for user statistics"""
    total_users: int = Field(ge=0)
    users_by_role: Dict[str, int] = Field(description="Count of users per role")
    users_by_status: Dict[str, int] = Field(description="Count of users per status")
    recent_registrations: int = Field(ge=0, description="New registrations in last 30 days")
    active_sessions: Optional[int] = Field(default=None, ge=0, description="Currently active sessions")
    statistics_generated_at: str = Field(description="Timestamp when statistics were generated")

class UserActivityLog(BaseModel):
    """Schema for user activity logging"""
    user_id: str
    action: str
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime

# ==========================================
# API RESPONSE WRAPPERS
# ==========================================

class ApiResponse(BaseModel):
    """Generic API response wrapper"""
    success: bool
    message: str
    data: Optional[Any] = None
    errors: Optional[List[str]] = None

class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper"""
    success: bool
    message: str
    data: List[Any]
    pagination: Dict[str, Any] = Field(description="Pagination metadata")

# ==========================================
# VALIDATION HELPERS
# ==========================================

class EmailValidation(BaseModel):
    """Schema for email validation"""
    email: EmailStr
    is_available: bool
    suggestions: Optional[List[str]] = None

class UsernameValidation(BaseModel):
    """Schema for username validation"""
    username: str
    is_available: bool
    suggestions: Optional[List[str]] = None
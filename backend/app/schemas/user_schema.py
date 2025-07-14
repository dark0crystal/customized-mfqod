from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from datetime import datetime

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
    role_name: str

    @field_validator("password")
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
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
            raise ValueError("Password must contain at least one special character.")
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

class UserListResponse(BaseModel):
    message: str
    data: UserSearchResponse
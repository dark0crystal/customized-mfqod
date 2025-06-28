from pydantic import BaseModel
from enum import Enum


# 1. Status Enum to restrict values
class StatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    pending = "pending"
    suspended = "suspended"


# 2. Model for user login or auth-related operations
class UserCreate(BaseModel):
    user_id: str
    email: str  
    password: str
    first_name: str
    last_name: str
    role: str


# 3. Model for new user registration (outside uni)
class UserRegister(BaseModel):
    id: str
    email: str
    password: str
    first_name: str
    middle_name: str
    last_name: str
    phone_number: str
    status: StatusEnum

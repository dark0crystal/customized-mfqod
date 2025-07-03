from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1)
    middle_name: str = Field(min_length=1)
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

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CreateUserStatusRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Status name (e.g., student, employee)")
    description: Optional[str] = Field(None, description="Optional status description")

class UpdateUserStatusRequest(BaseModel):
    name: Optional[str] = Field(None, description="Updated name")
    description: Optional[str] = Field(None, description="Updated description")

class UserStatusResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

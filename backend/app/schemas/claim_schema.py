"""
Claim Schema Definitions
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ClaimBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=2000)


class ClaimCreate(ClaimBase):
    item_id: str = Field(..., description="ID of the item being claimed")
    

class ClaimUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    approval: Optional[bool] = None  # Kept for backward compatibility
    status: Optional[str] = Field(None, description="Claim status: pending, approved, or rejected")


class ClaimResponse(ClaimBase):
    id: str
    approval: bool  # Kept for backward compatibility
    status: str  # Claim status: pending, approved, or rejected
    user_id: Optional[str]
    item_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_assigned: Optional[bool] = False  # Whether this claim is assigned as the correct claim for the item
    item_status: Optional[str] = None  # Status of the item this claim is for
    
    class Config:
        from_attributes = True


class ClaimWithDetails(ClaimResponse):
    """Claim response with user and item details"""
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    item_title: Optional[str] = None
    item_description: Optional[str] = None
    item_status: Optional[str] = None
    images: Optional[List[dict]] = []  # List of image objects with id and url
    item_type: Optional[dict] = None  # Item type with name_ar, name_en, etc.


class ClaimWithImages(ClaimResponse):
    """Claim response with associated images"""
    images: Optional[List[str]] = []


class ClaimStatusUpdate(BaseModel):
    """Schema for updating claim status with custom message"""
    custom_title: Optional[str] = Field(None, max_length=255, description="Custom title for the status update email")
    custom_description: Optional[str] = Field(None, max_length=1000, description="Custom description for the status update email")


class VisitNotificationRequest(BaseModel):
    """Schema for sending visit notification to claim user"""
    branch_id: Optional[str] = Field(None, description="ID of the branch/office to visit")
    note: Optional[str] = Field(None, max_length=1000, description="Additional note to include in the email")
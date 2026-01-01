from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re


# Branch Schemas
class BranchBase(BaseModel):
    branch_name_ar: Optional[str] = Field(None, max_length=255)
    branch_name_en: Optional[str] = Field(None, max_length=255)
    description_ar: Optional[str] = Field(None, max_length=1000)
    description_en: Optional[str] = Field(None, max_length=1000)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    phone1: Optional[str] = Field(None, max_length=8)
    phone2: Optional[str] = Field(None, max_length=8)
    organization_id: str = Field(..., min_length=1)
    
    @field_validator('phone1', 'phone2')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Remove any whitespace
        v = v.strip()
        # Treat empty strings as None (optional field)
        if not v:
            return None
        # Check if it's exactly 8 digits
        if not re.match(r'^\d{8}$', v):
            raise ValueError('Phone number must be exactly 8 digits')
        return v

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    branch_name_ar: Optional[str] = Field(None, max_length=255)
    branch_name_en: Optional[str] = Field(None, max_length=255)
    description_ar: Optional[str] = Field(None, max_length=1000)
    description_en: Optional[str] = Field(None, max_length=1000)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    phone1: Optional[str] = Field(None, max_length=8)
    phone2: Optional[str] = Field(None, max_length=8)
    organization_id: Optional[str] = Field(None, min_length=1)
    
    @field_validator('phone1', 'phone2')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Remove any whitespace
        v = v.strip()
        # Treat empty strings as None (optional field)
        if not v:
            return None
        # Check if it's exactly 8 digits
        if not re.match(r'^\d{8}$', v):
            raise ValueError('Phone number must be exactly 8 digits')
        return v

class BranchResponse(BranchBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BranchWithOrganization(BranchResponse):
    organization: Optional[dict] = None


# Address Schemas
class AddressBase(BaseModel):
    item_id: str = Field(..., min_length=1)
    branch_id: str = Field(..., min_length=1)
    is_current: bool = Field(default=True)

class AddressCreate(AddressBase):
    pass

class AddressUpdate(BaseModel):
    item_id: Optional[str] = Field(None, min_length=1)
    branch_id: Optional[str] = Field(None, min_length=1)
    is_current: Optional[bool] = None

class AddressResponse(AddressBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AddressWithDetails(AddressResponse):
    item: Optional[dict] = None
    branch: Optional[dict] = None

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    phone_number: Optional[str] = None
    active: bool
    status_id: Optional[str] = None
    role_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BranchManagerAssignment(BaseModel):
    user_id: str
    branch_id: str
    assigned_at: datetime
    
    class Config:
        from_attributes = True    
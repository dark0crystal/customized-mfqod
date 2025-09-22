from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# Branch Schemas
class BranchBase(BaseModel):
    branch_name: str = Field(..., min_length=1, max_length=255)
    organization_id: str = Field(..., min_length=1)

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    branch_name: Optional[str] = Field(None, min_length=1, max_length=255)
    organization_id: Optional[str] = Field(None, min_length=1)

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
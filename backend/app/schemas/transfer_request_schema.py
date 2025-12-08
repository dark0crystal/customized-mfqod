from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class TransferStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

class TransferRequestCreate(BaseModel):
    item_id: str = Field(..., description="ID of the item to transfer")
    to_branch_id: str = Field(..., description="ID of the destination branch")
    notes: Optional[str] = Field(None, description="Optional notes for the transfer request")

class TransferRequestUpdate(BaseModel):
    status: TransferStatusEnum = Field(..., description="New status of the transfer request")
    notes: Optional[str] = Field(None, description="Optional notes")

class TransferRequestResponse(BaseModel):
    id: str
    item_id: str
    from_branch_id: str
    to_branch_id: str
    requested_by: str
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    item: Optional[dict] = None
    from_branch: Optional[dict] = None
    to_branch: Optional[dict] = None
    requested_by_user: Optional[dict] = None
    
    class Config:
        from_attributes = True


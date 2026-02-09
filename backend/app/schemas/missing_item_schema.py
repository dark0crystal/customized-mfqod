# schemas/missing_item_schema.py

from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional, List

# =========================== 
# Enums
# ===========================

class MissingItemStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    cancelled = "cancelled"
    visit = "visit"

# =========================== 
# Request Schemas
# ===========================

class CreateMissingItemRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Missing item title")
    description: str = Field(..., min_length=1, description="Missing item description/content")
    user_id: str = Field(..., description="ID of the user reporting the missing item")
    item_type_id: Optional[str] = Field(None, description="ID of the item type")
    status: str = Field(default=MissingItemStatus.pending.value, description="Status of the missing item")
    approval: bool = Field(default=True, description="Whether the missing item is approved")
    temporary_deletion: bool = Field(default=False, description="Whether the missing item is marked for deletion")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Lost Wallet",
                "description": "Black leather wallet with credit cards",
                "user_id": "user-uuid-here",
                "item_type_id": "itemtype-uuid-here",
                "status": MissingItemStatus.pending.value,
                "approval": True,
                "temporary_deletion": False
            }
        }

class UpdateMissingItemRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Missing item title")
    description: Optional[str] = Field(None, min_length=1, description="Missing item description/content")
    item_type_id: Optional[str] = Field(None, description="ID of the item type")
    status: Optional[str] = Field(None, description="Status of the missing item")
    approval: Optional[bool] = Field(None, description="Whether the missing item is approved")
    temporary_deletion: Optional[bool] = Field(None, description="Whether the missing item is marked for deletion")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Updated Lost Wallet",
                "description": "Updated description",
                "status": "found"
            }
        }

class MissingItemFilterRequest(BaseModel):
    skip: int = Field(default=0, ge=0, description="Number of missing items to skip")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum number of missing items to return")
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    approved_only: bool = Field(default=False, description="Only return approved missing items")
    include_deleted: bool = Field(default=False, description="Include soft-deleted missing items")
    item_type_id: Optional[str] = Field(None, description="Filter by item type")
    status: Optional[str] = Field(None, description="Filter by status")

# =========================== 
# Response Schemas
# ===========================

class ItemTypeResponse(BaseModel):
    id: str
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class UserBasicResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True

class ImageResponse(BaseModel):
    id: str
    url: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class OrganizationBasicResponse(BaseModel):
    id: str
    name: str
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    
    class Config:
        from_attributes = True

class BranchBasicResponse(BaseModel):
    id: str
    branch_name: str
    branch_name_ar: Optional[str] = None
    branch_name_en: Optional[str] = None
    organization: Optional[OrganizationBasicResponse] = None
    
    class Config:
        from_attributes = True

class AddressResponse(BaseModel):
    id: str
    is_current: bool
    branch: Optional[BranchBasicResponse] = None
    full_location: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LocationResponse(BaseModel):
    organization_name: Optional[str] = None
    branch_name: Optional[str] = None
    full_location: Optional[str] = None


class AssignedFoundItemResponse(BaseModel):
    id: str
    item_id: str
    item_title: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    note: Optional[str] = None
    notified_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MissingItemResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    temporary_deletion: bool
    approval: bool
    item_type_id: Optional[str]
    user_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    location: Optional[LocationResponse] = None
    images: List[ImageResponse] = []
    
    class Config:
        from_attributes = True

class MissingItemDetailResponse(MissingItemResponse):
    item_type: Optional[ItemTypeResponse] = None
    user: Optional[UserBasicResponse] = None
    addresses: Optional[List[AddressResponse]] = None
    assigned_found_items: Optional[List[AssignedFoundItemResponse]] = None
    
    class Config:
        from_attributes = True

class MissingItemListResponse(BaseModel):
    missing_items: List[MissingItemResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

class DeleteMissingItemResponse(BaseModel):
    message: str
    missing_item_id: str
    permanent: bool

class BulkOperationResponse(BaseModel):
    message: str
    processed_items: int
    successful_items: int
    failed_items: int
    errors: List[str] = []

# =========================== 
# Bulk Operation Schemas
# ===========================

class BulkDeleteMissingItemRequest(BaseModel):
    missing_item_ids: List[str] = Field(..., min_items=1, max_items=100)
    permanent: bool = Field(default=False, description="Whether to permanently delete missing items")

class BulkUpdateMissingItemRequest(BaseModel):
    missing_item_ids: List[str] = Field(..., min_items=1, max_items=100)
    update_data: UpdateMissingItemRequest

class BulkApprovalMissingItemRequest(BaseModel):
    missing_item_ids: List[str] = Field(..., min_items=1, max_items=100)
    approval_status: bool = Field(..., description="Approval status to set for all missing items")


class AssignFoundItemsRequest(BaseModel):
    branch_id: str = Field(..., description="Branch where the found items are held")
    found_item_ids: List[str] = Field(..., min_items=1, description="IDs of found items to link")
    note: Optional[str] = Field(None, description="Note to include in notification")
    notify: bool = Field(default=True, description="Send notification email to reporter")
    set_status_to_visit: bool = Field(default=True, description="Automatically set status to visit after assignment")

class AssignPendingItemRequest(BaseModel):
    pending_item_id: str = Field(..., description="ID of the pending item to assign to this missing item")
    note: Optional[str] = Field(None, description="Note to include in notification")
    notify: bool = Field(default=True, description="Send notification email to reporter")
    set_status_to_approved: bool = Field(default=True, description="Automatically set status to approved after assignment")

# schemas/item_schemas.py

from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime
from typing import Optional, List

# =========================== 
# Enums
# ===========================

class ItemTypeEnum(str, Enum):
    note = "note"
    article = "article" 
    document = "document"

# =========================== 
# Request Schemas
# ===========================

class CreateItemRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Item title")
    description: str = Field(..., min_length=1, description="Item description/content")
    user_id: str = Field(..., description="ID of the user creating the item")
    item_type_id: Optional[str] = Field(None, description="ID of the item type")
    approval: bool = Field(default=True, description="Whether the item is approved")
    temporary_deletion: bool = Field(default=False, description="Whether the item is marked for deletion")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Sample Article",
                "description": "This is a sample article content",
                "user_id": "user-uuid-here",
                "item_type_id": "itemtype-uuid-here",
                "approval": True,
                "temporary_deletion": False
            }
        }

class UpdateItemRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Item title")
    description: Optional[str] = Field(None, min_length=1, description="Item description/content")
    item_type_id: Optional[str] = Field(None, description="ID of the item type")
    approval: Optional[bool] = Field(None, description="Whether the item is approved")
    temporary_deletion: Optional[bool] = Field(None, description="Whether the item is marked for deletion")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Updated Article Title",
                "description": "Updated article content",
                "approval": True
            }
        }

class ItemFilterRequest(BaseModel):
    skip: int = Field(default=0, ge=0, description="Number of items to skip")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum number of items to return")
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    approved_only: bool = Field(default=False, description="Only return approved items")
    include_deleted: bool = Field(default=False, description="Include soft-deleted items")
    item_type_id: Optional[str] = Field(None, description="Filter by item type")

# =========================== 
# Response Schemas
# ===========================

class ItemTypeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
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

class ItemResponse(BaseModel):
    id: str
    title: str
    description: str
    claims_count: int
    temporary_deletion: bool
    approval: bool
    item_type_id: Optional[str]
    user_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ItemDetailResponse(ItemResponse):
    item_type: Optional[ItemTypeResponse] = None
    user: Optional[UserBasicResponse] = None
    
    class Config:
        from_attributes = True

class ItemListResponse(BaseModel):
    items: List[ItemResponse]
    total: int
    skip: int
    limit: int
    has_more: bool

class DeleteItemResponse(BaseModel):
    message: str
    item_id: str
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

class BulkDeleteRequest(BaseModel):
    item_ids: List[str] = Field(..., min_items=1, max_items=100)
    permanent: bool = Field(default=False, description="Whether to permanently delete items")

class BulkUpdateRequest(BaseModel):
    item_ids: List[str] = Field(..., min_items=1, max_items=100)
    update_data: UpdateItemRequest

class BulkApprovalRequest(BaseModel):
    item_ids: List[str] = Field(..., min_items=1, max_items=100)
    approval_status: bool = Field(..., description="Approval status to set for all items")
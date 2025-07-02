# =========================== 
# Pydantic Schemas
# ===========================

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Enum


class ItemTypeEnum(str, Enum):
    note = "note"
    article = "article" 
    document = "document"

class CreateNewItem(BaseModel):
    title: str
    description: str  
    user_id: str     
    item_type_id: Optional[str] = None  
    approval: bool = True
    temporary_deletion: bool = False

class UpdateItem(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    item_type_id: Optional[str] = None
    approval: Optional[bool] = None
    temporary_deletion: Optional[bool] = None

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

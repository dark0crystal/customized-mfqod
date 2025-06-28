from pydantic import BaseModel, EmailStr
from enum import Enum
from datetime import datetime
from typing import Optional

# Define an Enum for type
class ItemType(str, Enum):
    note = "note"
    article = "article"
    document = "document"

# Define your schema
class CreateNewItem(BaseModel):
    title: str
    userId: str
    content: str
    type: ItemType  # Using Enum for 'type'
    claim_count: int = 0
    approval: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

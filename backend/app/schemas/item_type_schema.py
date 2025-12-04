from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class CreateItemTypeRequest(BaseModel):
    name_ar: Optional[str] = Field(None, max_length=100)
    name_en: Optional[str] = Field(None, max_length=100)
    description_ar: Optional[str] = Field(None, max_length=500)
    description_en: Optional[str] = Field(None, max_length=500)

class UpdateItemTypeRequest(BaseModel):
    name_ar: Optional[str] = Field(None, max_length=100)
    name_en: Optional[str] = Field(None, max_length=100)
    description_ar: Optional[str] = Field(None, max_length=500)
    description_en: Optional[str] = Field(None, max_length=500)

class ItemTypeResponse(BaseModel):
    id: str
    name_ar: Optional[str]
    name_en: Optional[str]
    description_ar: Optional[str]
    description_en: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

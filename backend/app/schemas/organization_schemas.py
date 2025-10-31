from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OrganizationBase(BaseModel):
    name_ar: Optional[str] = Field(None, max_length=255)
    name_en: Optional[str] = Field(None, max_length=255)
    description_ar: Optional[str] = Field(None, max_length=1000)
    description_en: Optional[str] = Field(None, max_length=1000)

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name_ar: Optional[str] = Field(None, max_length=255)
    name_en: Optional[str] = Field(None, max_length=255)
    description_ar: Optional[str] = Field(None, max_length=1000)
    description_en: Optional[str] = Field(None, max_length=1000)

class OrganizationResponse(OrganizationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class OrganizationWithBranches(OrganizationResponse):
    branches: Optional[List[dict]] = None

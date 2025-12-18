from pydantic import BaseModel, Field
from typing import Optional

class UploadImageRequest(BaseModel):
    url: str = Field(..., description="URL of the image")
    imageable_type: str = Field(..., description="Polymorphic type (e.g., 'item')")
    imageable_id: str = Field(..., description="ID of the related entity (e.g., item id)")
    is_hidden: Optional[bool] = Field(False, description="Whether the image should be hidden from regular users")

class ImageResponse(BaseModel):
    id: str
    url: str
    description: Optional[str] = None
    imageable_type: str
    imageable_id: str
    is_hidden: bool = False
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True 
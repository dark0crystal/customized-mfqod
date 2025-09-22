from pydantic import BaseModel, Field

class UploadImageRequest(BaseModel):
    url: str = Field(..., description="URL of the image")
    imageable_type: str = Field(..., description="Polymorphic type (e.g., 'item')")
    imageable_id: str = Field(..., description="ID of the related entity (e.g., item id)") 
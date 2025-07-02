from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RoleSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
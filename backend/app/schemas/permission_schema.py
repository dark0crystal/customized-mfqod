
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PermissionSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class PermissionRequestSchema(BaseModel):
    name: str
    description: Optional[str] = None
    
    class Config:
        orm_mode = True

class PermissionWithRolesSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    roles: List[str] = []  # List of role names that have this permission
    created_at: datetime
    updated_at: datetime

class AssignPermissionToRoleSchema(BaseModel):
    role_id: str
    permission_ids: List[str]

class RolePermissionSchema(BaseModel):
    role_id: str
    permission_id: str
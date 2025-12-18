from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class AuditActionTypeEnum(str, Enum):
    ITEM_STATUS_CHANGED = "item_status_changed"
    ITEM_DELETED = "item_deleted"
    ITEM_RESTORED = "item_restored"
    TRANSFER_APPROVED = "transfer_approved"
    TRANSFER_REJECTED = "transfer_rejected"

class AuditLogFilterRequest(BaseModel):
    """Filter request for audit logs"""
    skip: int = Field(default=0, ge=0, description="Number of logs to skip")
    limit: int = Field(default=50, ge=1, le=1000, description="Maximum number of logs to return")
    action_type: Optional[AuditActionTypeEnum] = Field(None, description="Filter by action type")
    entity_type: Optional[str] = Field(None, description="Filter by entity type")
    entity_id: Optional[str] = Field(None, description="Filter by entity ID")
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    date_from: Optional[datetime] = Field(None, description="Filter logs from this date")
    date_to: Optional[datetime] = Field(None, description="Filter logs until this date")
    search: Optional[str] = Field(None, description="Search across descriptions, user names, emails, entity IDs")

class UserBasicInfo(BaseModel):
    """Basic user information for audit log response"""
    id: str
    email: str
    first_name: str
    last_name: str
    
    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    """Audit log entry response"""
    id: str
    action_type: str
    entity_type: str
    entity_id: str
    user_id: str
    user: Optional[UserBasicInfo] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    metadata: Optional[str] = None  # Note: stored as metadata_json in database but exposed as metadata in API
    ip_address: str
    user_agent: Optional[str] = None
    created_at: datetime
    # Parsed device info
    browser_name: Optional[str] = None
    browser_version: Optional[str] = None
    os_name: Optional[str] = None
    connection_type: Optional[str] = None
    # Formatted description
    description: Optional[str] = None
    # Formatted changes
    formatted_changes: Optional[List[str]] = None
    
    class Config:
        from_attributes = True

class AuditLogListResponse(BaseModel):
    """Paginated list of audit logs"""
    logs: List[AuditLogResponse]
    total: int
    skip: int
    limit: int


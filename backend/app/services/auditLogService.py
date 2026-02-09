"""
Audit Log Service

Handles creation and retrieval of audit logs for tracking system activities.
"""

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import HTTPException, status
import json
import re
import logging

from app.models import AuditLog, AuditActionType, User
from app.schemas.audit_log_schema import AuditLogResponse, AuditLogFilterRequest, AuditLogListResponse, UserBasicInfo

logger = logging.getLogger(__name__)


class AuditLogService:
    def __init__(self, db: Session):
        self.db = db
    
    def parse_user_agent(self, user_agent: Optional[str]) -> Dict[str, Optional[str]]:
        """Parse user agent string to extract browser and OS information"""
        if not user_agent:
            return {
                "browser_name": None,
                "browser_version": None,
                "os_name": None,
                "connection_type": "Unknown"
            }
        
        result = {
            "browser_name": None,
            "browser_version": None,
            "os_name": None,
            "connection_type": "Unknown"
        }
        
        user_agent_lower = user_agent.lower()
        
        # Parse browser
        if "chrome" in user_agent_lower and "edg" not in user_agent_lower:
            result["browser_name"] = "Chrome"
            match = re.search(r'chrome/([\d.]+)', user_agent_lower)
            if match:
                result["browser_version"] = match.group(1)
        elif "firefox" in user_agent_lower:
            result["browser_name"] = "Firefox"
            match = re.search(r'firefox/([\d.]+)', user_agent_lower)
            if match:
                result["browser_version"] = match.group(1)
        elif "safari" in user_agent_lower and "chrome" not in user_agent_lower:
            result["browser_name"] = "Safari"
            match = re.search(r'version/([\d.]+)', user_agent_lower)
            if match:
                result["browser_version"] = match.group(1)
        elif "edg" in user_agent_lower:
            result["browser_name"] = "Edge"
            match = re.search(r'edg/([\d.]+)', user_agent_lower)
            if match:
                result["browser_version"] = match.group(1)
        elif "opera" in user_agent_lower:
            result["browser_name"] = "Opera"
            match = re.search(r'opr/([\d.]+)', user_agent_lower)
            if match:
                result["browser_version"] = match.group(1)
        
        # Parse OS
        if "windows" in user_agent_lower:
            result["os_name"] = "Windows"
        elif "mac" in user_agent_lower or "darwin" in user_agent_lower:
            result["os_name"] = "macOS"
        elif "linux" in user_agent_lower:
            result["os_name"] = "Linux"
        elif "android" in user_agent_lower:
            result["os_name"] = "Android"
        elif "ios" in user_agent_lower or "iphone" in user_agent_lower or "ipad" in user_agent_lower:
            result["os_name"] = "iOS"
        
        # Parse connection type (basic detection)
        if "mobile" in user_agent_lower or "android" in user_agent_lower or "iphone" in user_agent_lower:
            # Could be cellular or WiFi, default to Cellular for mobile devices
            result["connection_type"] = "Cellular"
        else:
            # Desktop devices are typically WiFi/Ethernet, default to WiFi
            result["connection_type"] = "WiFi"
        
        return result
    
    def format_changes(self, old_value: Optional[str], new_value: Optional[str], action_type: AuditActionType) -> tuple[List[str], str]:
        """Format old and new values into readable change descriptions"""
        changes = []
        description = ""
        
        try:
            old_data = json.loads(old_value) if old_value else {}
            new_data = json.loads(new_value) if new_value else {}
        except (json.JSONDecodeError, TypeError):
            old_data = {"value": old_value} if old_value else {}
            new_data = {"value": new_value} if new_value else {}
        
        if action_type == AuditActionType.ITEM_STATUS_CHANGED:
            old_status = old_data.get("status", "unknown")
            new_status = new_data.get("status", "unknown")
            changes.append(f"Status: {old_status} → {new_status}")
            description = f"Item status changed from {old_status} to {new_status}"
        elif action_type == AuditActionType.ITEM_DELETED:
            permanent = new_data.get("permanent", False)
            changes.append(f"Deleted: {'Permanent' if permanent else 'Soft delete'}")
            description = f"Item {'permanently deleted' if permanent else 'marked for deletion'}"
        elif action_type == AuditActionType.ITEM_RESTORED:
            changes.append("Restored: false → true")
            description = "Item restored from deletion"
        elif action_type == AuditActionType.TRANSFER_APPROVED:
            old_status = old_data.get("status", "pending")
            new_status = new_data.get("status", "approved")
            changes.append(f"Status: {old_status} → {new_status}")
            description = "Transfer request approved"
        elif action_type == AuditActionType.TRANSFER_REJECTED:
            old_status = old_data.get("status", "pending")
            new_status = new_data.get("status", "rejected")
            changes.append(f"Status: {old_status} → {new_status}")
            if new_data.get("notes"):
                description = f"Transfer request rejected: {new_data.get('notes')}"
            else:
                description = "Transfer request rejected"
        
        # Add any other field changes
        for key in set(list(old_data.keys()) + list(new_data.keys())):
            if key in ["status"]:  # Already handled
                continue
            old_val = old_data.get(key)
            new_val = new_data.get(key)
            if old_val != new_val:
                changes.append(f"{key.replace('_', ' ').title()}: {old_val} → {new_val}")
        
        return changes, description
    
    def create_audit_log(
        self,
        action_type: AuditActionType,
        entity_type: str,
        entity_id: str,
        user_id: str,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        ip_address: str = "",
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """Create a new audit log entry"""
        audit_log = AuditLog(
            action_type=action_type,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            old_value=json.dumps(old_value) if old_value else None,
            new_value=json.dumps(new_value) if new_value else None,
            metadata_json=json.dumps(metadata) if metadata else None,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.now(timezone.utc)
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log
    
    def create_item_status_change_log(
        self,
        item_id: str,
        old_status: str,
        new_status: str,
        user_id: str,
        ip_address: str = "",
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Helper method to create item status change log"""
        return self.create_audit_log(
            action_type=AuditActionType.ITEM_STATUS_CHANGED,
            entity_type="item",
            entity_id=item_id,
            user_id=user_id,
            old_value={"status": old_status},
            new_value={"status": new_status},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def create_item_deletion_log(
        self,
        item_id: str,
        permanent: bool,
        user_id: str,
        ip_address: str = "",
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Helper method to create item deletion log"""
        return self.create_audit_log(
            action_type=AuditActionType.ITEM_DELETED,
            entity_type="item",
            entity_id=item_id,
            user_id=user_id,
            old_value={"deleted": False},
            new_value={"deleted": True, "permanent": permanent},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def create_item_restoration_log(
        self,
        item_id: str,
        user_id: str,
        ip_address: str = "",
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Helper method to create item restoration log"""
        return self.create_audit_log(
            action_type=AuditActionType.ITEM_RESTORED,
            entity_type="item",
            entity_id=item_id,
            user_id=user_id,
            old_value={"deleted": True},
            new_value={"deleted": False},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def create_transfer_approval_log(
        self,
        transfer_request_id: str,
        user_id: str,
        ip_address: str = "",
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Helper method to create transfer approval log"""
        return self.create_audit_log(
            action_type=AuditActionType.TRANSFER_APPROVED,
            entity_type="transfer_request",
            entity_id=transfer_request_id,
            user_id=user_id,
            old_value={"status": "pending"},
            new_value={"status": "approved"},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def create_transfer_rejection_log(
        self,
        transfer_request_id: str,
        user_id: str,
        notes: Optional[str] = None,
        ip_address: str = "",
        user_agent: Optional[str] = None
    ) -> AuditLog:
        """Helper method to create transfer rejection log"""
        return self.create_audit_log(
            action_type=AuditActionType.TRANSFER_REJECTED,
            entity_type="transfer_request",
            entity_id=transfer_request_id,
            user_id=user_id,
            old_value={"status": "pending"},
            new_value={"status": "rejected", "notes": notes},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def get_audit_logs(
        self,
        skip: int = 0,
        limit: int = 50,
        action_type: Optional[AuditActionType] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        user_id: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        search: Optional[str] = None
    ) -> tuple[List[AuditLog], int]:
        """Get audit logs with filtering and pagination"""
        query = self.db.query(AuditLog).options(joinedload(AuditLog.user))
        
        # Apply filters
        if action_type:
            query = query.filter(AuditLog.action_type == action_type)
        
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        if date_from:
            query = query.filter(AuditLog.created_at >= date_from)
        
        if date_to:
            query = query.filter(AuditLog.created_at <= date_to)
        
        # Search functionality
        if search:
            search_term = f"%{search.lower()}%"
            query = query.join(User).filter(
                or_(
                    func.lower(User.email).like(search_term),
                    func.lower(User.first_name).like(search_term),
                    func.lower(User.last_name).like(search_term),
                    func.lower(AuditLog.entity_id).like(search_term),
                    func.lower(AuditLog.entity_type).like(search_term)
                )
            )
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination and ordering
        logs = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()
        
        return logs, total
    
    def get_audit_log_by_id(self, log_id: str) -> Optional[AuditLog]:
        """Get a specific audit log by ID"""
        return self.db.query(AuditLog).options(joinedload(AuditLog.user)).filter(AuditLog.id == log_id).first()
    
    def get_audit_logs_by_entity(self, entity_type: str, entity_id: str, limit: int = 50) -> List[AuditLog]:
        """Get audit logs for a specific entity"""
        return self.db.query(AuditLog).options(joinedload(AuditLog.user)).filter(
            and_(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id
            )
        ).order_by(desc(AuditLog.created_at)).limit(limit).all()
    
    def to_response(self, audit_log: AuditLog) -> AuditLogResponse:
        """Convert AuditLog model to AuditLogResponse schema"""
        # Parse user agent
        device_info = self.parse_user_agent(audit_log.user_agent)
        
        # Format changes
        changes, description = self.format_changes(
            audit_log.old_value,
            audit_log.new_value,
            audit_log.action_type
        )
        
        # Get user info
        user_info = None
        if audit_log.user:
            user_info = UserBasicInfo(
                id=audit_log.user.id,
                email=audit_log.user.email,
                first_name=audit_log.user.first_name,
                last_name=audit_log.user.last_name
            )
        
        return AuditLogResponse(
            id=audit_log.id,
            action_type=audit_log.action_type.value,
            entity_type=audit_log.entity_type,
            entity_id=audit_log.entity_id,
            user_id=audit_log.user_id,
            user=user_info,
            old_value=audit_log.old_value,
            new_value=audit_log.new_value,
            metadata=audit_log.metadata_json,
            ip_address=audit_log.ip_address,
            user_agent=audit_log.user_agent,
            created_at=audit_log.created_at,
            browser_name=device_info["browser_name"],
            browser_version=device_info["browser_version"],
            os_name=device_info["os_name"],
            connection_type=device_info["connection_type"],
            description=description,
            formatted_changes=changes
        )


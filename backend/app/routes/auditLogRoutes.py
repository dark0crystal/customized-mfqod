from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.db.database import get_session
from app.services.auditLogService import AuditLogService
from app.schemas.audit_log_schema import (
    AuditLogResponse,
    AuditLogFilterRequest,
    AuditLogListResponse,
    AuditActionTypeEnum
)
from app.middleware.auth_middleware import get_current_user_required
from app.models import User
from app.utils.permission_decorator import require_permission

router = APIRouter()

def get_audit_log_service(db: Session = Depends(get_session)) -> AuditLogService:
    return AuditLogService(db)

@router.get("/", response_model=AuditLogListResponse)
@require_permission("can_view_audit_logs")
async def get_audit_logs(
    request: Request,
    skip: int = Query(0, ge=0, description="Number of logs to skip"),
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of logs to return"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    date_from: Optional[datetime] = Query(None, description="Filter logs from this date"),
    date_to: Optional[datetime] = Query(None, description="Filter logs until this date"),
    search: Optional[str] = Query(None, description="Search across descriptions, user names, emails, entity IDs"),
    db: Session = Depends(get_session),
    audit_service: AuditLogService = Depends(get_audit_log_service),
    current_user: User = Depends(get_current_user_required)
):
    """Get audit logs with filtering and pagination
    
    Security: Requires can_view_audit_logs permission
    Used for compliance, security monitoring, and tracking system changes
    """
    try:
        # Validate and convert action_type string to enum
        action_type_enum = None
        if action_type:
            try:
                action_type_enum = AuditActionTypeEnum(action_type)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid action_type: {action_type}")
        
        logs, total = audit_service.get_audit_logs(
            skip=skip,
            limit=limit,
            action_type=action_type_enum,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            date_from=date_from,
            date_to=date_to,
            search=search
        )
        
        log_responses = [audit_service.to_response(log) for log in logs]
        
        return AuditLogListResponse(
            logs=log_responses,
            total=total,
            skip=skip,
            limit=limit
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving audit logs: {str(e)}")

@router.get("/{log_id}", response_model=AuditLogResponse)
@require_permission("can_view_audit_logs")
async def get_audit_log(
    log_id: str,
    request: Request,
    db: Session = Depends(get_session),
    audit_service: AuditLogService = Depends(get_audit_log_service),
    current_user: User = Depends(get_current_user_required)
):
    """Get a specific audit log by ID"""
    try:
        audit_log = audit_service.get_audit_log_by_id(log_id)
        if not audit_log:
            raise HTTPException(status_code=404, detail="Audit log not found")
        return audit_service.to_response(audit_log)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving audit log: {str(e)}")

@router.get("/entity/{entity_type}/{entity_id}", response_model=List[AuditLogResponse])
@require_permission("can_view_audit_logs")
async def get_audit_logs_by_entity(
    entity_type: str,
    entity_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of logs to return"),
    db: Session = Depends(get_session),
    audit_service: AuditLogService = Depends(get_audit_log_service),
    current_user: User = Depends(get_current_user_required)
):
    """Get audit logs for a specific entity (item, user, claim, etc.)
    
    Useful for tracking all changes related to a specific entity
    Returns chronological history of actions performed on the entity
    """
    try:
        logs = audit_service.get_audit_logs_by_entity(entity_type, entity_id, limit)
        return [audit_service.to_response(log) for log in logs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving audit logs: {str(e)}")


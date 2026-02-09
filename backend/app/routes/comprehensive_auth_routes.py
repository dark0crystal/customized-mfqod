from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import logging
import ldap

from app.db.database import get_session
from app.services.auth_service import AuthService
from app.services.enhanced_ad_service import EnhancedADService
from app.services.otp_service import otp_service
from app.services.notification_service import send_otp_email
from app.middleware.auth_middleware import (
    auth_middleware, 
    get_current_user_required, 
    get_current_user_optional
)
from app.schemas.auth_schemas import (
    LoginRequest, 
    LoginResponse, 
    RegisterRequest, 
    UserResponse,
    RefreshTokenRequest,
    ChangePasswordRequest,
    ResetPasswordRequest,
@router.post("/request-reset", summary="Request Password Reset")
async def request_password_reset(
    reset_request: ResetPasswordRequest,
    db: Session = Depends(get_session)
):
    """
    Request a password reset email. Always returns success to avoid email enumeration.
    Only external users can reset password; internal users must use Active Directory.
    """
    try:
        await auth_service.request_password_reset(reset_request.email, db)
        return {
            "message": "If an account exists with that email, you will receive a password reset link shortly."
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Password reset request error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )

@router.post("/reset-password", summary="Confirm Password Reset")
async def reset_password(
    reset_confirm: ResetPasswordConfirm,
    db: Session = Depends(get_session)
):
    """
    Confirm password reset using the token from the email link.
    """
    try:
        success = auth_service.confirm_password_reset(
            reset_confirm.token,
            reset_confirm.new_password,
            db
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token. Please request a new password reset."
            )
        return {"message": "Password has been reset successfully. You can now log in."}
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Password reset confirm error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )
@router.get("/sessions", summary="Get User Sessions")
async def get_user_sessions(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session)
):
    """
    Get list of active sessions for current user.
    """
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_active == True
    ).order_by(UserSession.created_at.desc()).all()
    
    session_list = []
    for session in sessions:
        session_list.append({
            "id": session.id,
            "ip_address": session.ip_address,
            "user_agent": session.user_agent,
            "created_at": session.created_at.isoformat(),
            "expires_at": session.expires_at.isoformat()
        })
    
    return {"sessions": session_list}

@router.delete("/sessions/{session_id}", summary="Revoke Session")
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session)
):
    """
    Revoke a specific user session.
    """
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    session.is_active = False
    db.commit()
    
    return {"message": "Session revoked successfully"}

# Admin endpoints
@router.get("/admin/users", dependencies=[Depends(auth_middleware.require_admin())])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    user_type: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_session)
):
    """
    Get all users (admin only).
    """
    query = db.query(User)
    
    if user_type:
        query = query.filter(User.user_type == user_type)
    
    if active_only:
        query = query.filter(User.active == True)
    
    users = query.offset(skip).limit(limit).all()
    total = query.count()
    
    return {
        "users": [UserResponse.from_orm(user) for user in users],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/login-attempts", dependencies=[Depends(auth_middleware.require_admin())])
async def get_login_attempts(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_session)
):
    """
    Get login attempts for security monitoring (admin only).
    """
    query = db.query(LoginAttempt)
    
    if status_filter:
        query = query.filter(LoginAttempt.status == status_filter)
    
    attempts = query.order_by(LoginAttempt.created_at.desc()).offset(skip).limit(limit).all()
    total = query.count()
    
    attempt_list = []
    for attempt in attempts:
        attempt_list.append({
            "id": attempt.id,
            "user_id": attempt.user_id,
            "email_or_username": attempt.email_or_username,
            "ip_address": attempt.ip_address,
            "status": attempt.status.value,
            "failure_reason": attempt.failure_reason,
            "created_at": attempt.created_at.isoformat()
        })
    
    return {
        "attempts": attempt_list,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.post("/admin/sync-ad", dependencies=[Depends(auth_middleware.require_admin())])
async def trigger_ad_sync(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session)
):
    """
    Trigger manual Active Directory sync (admin only).
    """
    # Add sync task to background
    background_tasks.add_task(ad_service.bulk_sync_users, db)
    
    return {"message": "AD sync triggered successfully"}

@router.get("/admin/ad-sync-logs", dependencies=[Depends(auth_middleware.require_admin())])
async def get_ad_sync_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_session)
):
    """
    Get Active Directory sync logs (admin only).
    """
    logs = db.query(ADSyncLog).order_by(
        ADSyncLog.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    total = db.query(ADSyncLog).count()
    
    log_list = []
    for log in logs:
        log_list.append({
            "id": log.id,
            "sync_type": log.sync_type,
            "status": log.status,
            "message": log.message,
            "users_processed": log.users_processed,
            "users_updated": log.users_updated,
            "users_deactivated": log.users_deactivated,
            "error_details": log.error_details,
            "started_at": log.started_at.isoformat() if log.started_at else None,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            "created_at": log.created_at.isoformat()
        })
    
    return {
        "logs": log_list,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/health", dependencies=[Depends(auth_middleware.require_admin())])
async def check_system_health(db: Session = Depends(get_session)):
    """
    Check system health including AD connectivity (admin only).
    """
    try:
        # Check AD health
        ad_health = await ad_service.health_check()
        
        # Check database connectivity
        db_health = {"status": "healthy", "timestamp": ""}
        try:
            db.execute("SELECT 1")
            db_health["status"] = "healthy"
        except Exception as e:
            db_health["status"] = "unhealthy"
            db_health["error"] = str(e)
        
        # Get basic stats
        total_users = db.query(User).count()
        active_users = db.query(User).filter(User.active == True).count()
        internal_users = db.query(User).filter(User.user_type == "internal").count()
        external_users = db.query(User).filter(User.user_type == "external").count()
        
        return {
            "status": "healthy" if ad_health["status"] == "healthy" and db_health["status"] == "healthy" else "unhealthy",
            "ad_service": ad_health,
            "database": db_health,
            "statistics": {
                "total_users": total_users,
                "active_users": active_users,
                "internal_users": internal_users,
                "external_users": external_users
            }
        }
        
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@router.post("/admin/diagnose-ad", dependencies=[Depends(auth_middleware.require_admin())])
async def diagnose_ad(
    request: ADDiagnosticRequest,
    db: Session = Depends(get_session)
):
    """
    Diagnostic endpoint to test AD connectivity and user lookup (admin only).
    Provides detailed diagnostic information for troubleshooting authentication issues.
    
    - **username**: Optional username to test lookup and authentication
    """
    diagnostics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "config": {
            "server": ad_service.config.SERVER,
            "port": ad_service.config.PORT,
            "use_ssl": ad_service.config.USE_SSL,
            "user_dn": ad_service.config.USER_DN,
            "bind_user": ad_service.config.BIND_USER,
            "search_filter": ad_service.config.USER_SEARCH_FILTER
        },
        "tests": {}
    }
    
    # Test 1: Connection
    diagnostics["tests"]["connection"] = {
        "status": "pending",
        "details": {}
    }
    try:
        conn = ad_service._get_ldap_connection()
        diagnostics["tests"]["connection"]["status"] = "success"
        diagnostics["tests"]["connection"]["details"]["message"] = "Connection established"
        conn.unbind_s()
    except Exception as e:
        diagnostics["tests"]["connection"]["status"] = "failed"
        diagnostics["tests"]["connection"]["details"]["error"] = str(e)
        diagnostics["tests"]["connection"]["details"]["message"] = "Failed to establish connection"
    
    # Test 2: Service Account Bind
    diagnostics["tests"]["service_bind"] = {
        "status": "pending",
        "details": {}
    }
    conn = None
    try:
        conn = ad_service._get_ldap_connection()
        conn.simple_bind_s(ad_service.config.BIND_USER, ad_service.config.BIND_PASSWORD)
        diagnostics["tests"]["service_bind"]["status"] = "success"
        diagnostics["tests"]["service_bind"]["details"]["message"] = "Service account bind successful"
    except ldap.INVALID_CREDENTIALS:
        diagnostics["tests"]["service_bind"]["status"] = "failed"
        diagnostics["tests"]["service_bind"]["details"]["error"] = "Invalid service account credentials"
    except Exception as e:
        diagnostics["tests"]["service_bind"]["status"] = "failed"
        diagnostics["tests"]["service_bind"]["details"]["error"] = str(e)
    finally:
        if conn:
            try:
                conn.unbind_s()
            except:
                pass
    
    # Test 3: User Search (if username provided)
    username = request.username
    if username:
        diagnostics["tests"]["user_search"] = {
            "status": "pending",
            "username": username,
            "details": {}
        }
        conn = None
        try:
            conn = ad_service._get_ldap_connection()
            conn.simple_bind_s(ad_service.config.BIND_USER, ad_service.config.BIND_PASSWORD)
            
            # Try multiple search filters
            search_filters = [
                ad_service.config.USER_SEARCH_FILTER.format(username=username),
                f"(&(objectClass=person)(uid={username}))",
                f"(&(objectClass=person)(cn={username}))",
            ]
            
            found = False
            for search_filter in search_filters:
                try:
                    result = conn.search_s(
                        ad_service.config.USER_DN,
                        ldap.SCOPE_SUBTREE,
                        search_filter,
                        ["sAMAccountName", "uid", "cn", "mail", "displayName", "userAccountControl"]
                    )
                    if result:
                        user_dn, user_attrs = result[0]
                        diagnostics["tests"]["user_search"]["status"] = "success"
                        diagnostics["tests"]["user_search"]["details"]["user_dn"] = user_dn
                        diagnostics["tests"]["user_search"]["details"]["used_filter"] = search_filter
                        
                        # Extract user info
                        def get_attr(attr_name):
                            values = user_attrs.get(attr_name, [])
                            if values:
                                if isinstance(values[0], bytes):
                                    return values[0].decode('utf-8')
                                return str(values[0])
                            return None
                        
                        diagnostics["tests"]["user_search"]["details"]["user_info"] = {
                            "sAMAccountName": get_attr("sAMAccountName"),
                            "uid": get_attr("uid"),
                            "cn": get_attr("cn"),
                            "mail": get_attr("mail"),
                            "displayName": get_attr("displayName"),
                            "userAccountControl": get_attr("userAccountControl")
                        }
                        
                        # Check account status
                        is_active = ad_service._is_account_active(user_attrs)
                        diagnostics["tests"]["user_search"]["details"]["account_active"] = is_active
                        
                        found = True
                        break
                except Exception as e:
                    diagnostics["tests"]["user_search"]["details"][f"filter_error_{search_filter}"] = str(e)
                    continue
            
            if not found:
                diagnostics["tests"]["user_search"]["status"] = "failed"
                diagnostics["tests"]["user_search"]["details"]["error"] = f"User '{username}' not found with any search filter"
                diagnostics["tests"]["user_search"]["details"]["tried_filters"] = search_filters
                
        except Exception as e:
            diagnostics["tests"]["user_search"]["status"] = "failed"
            diagnostics["tests"]["user_search"]["details"]["error"] = str(e)
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass
    
    # Test 4: Health Check
    try:
        health = await ad_service.health_check()
        diagnostics["tests"]["health_check"] = health
    except Exception as e:
        diagnostics["tests"]["health_check"] = {
            "status": "failed",
            "error": str(e)
        }
    
    return diagnostics

@router.put("/admin/users/{user_id}/toggle-active", dependencies=[Depends(auth_middleware.require_admin())])
async def toggle_user_active(
    user_id: str,
    db: Session = Depends(get_session)
):
    """
    Toggle user active status (admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.active = not user.active
    db.commit()
    
    action = "activated" if user.active else "deactivated"
    logger.info(f"User {user.email} {action} by admin")
    
    return {"message": f"User {action} successfully"}
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
import logging

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
    UserProfileUpdateRequest,
    SendOTPRequest,
    VerifyOTPRequest
)
from app.models import User, LoginAttempt, UserSession, ADSyncLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()
ad_service = EnhancedADService()
security = HTTPBearer()

@router.post("/login", response_model=LoginResponse, summary="User Login")
async def login(
    credentials: LoginRequest,
    request: Request,
    db: Session = Depends(get_session)
):
    """
    Authenticate user with email/username and password.
    Supports both internal university users (via Active Directory) and external users.
    
    - **email_or_username**: Email address or username
    - **password**: User password
    
    Returns access token, refresh token, and user information.
    """
    try:
        auth_response = await auth_service.authenticate_user(
            credentials.email_or_username,
            credentials.password,
            request,
            db
        )
        
        logger.info(f"Successful login for user: {credentials.email_or_username}")
        return LoginResponse(**auth_response)
        
    except HTTPException as e:
        logger.warning(f"Failed login attempt for {credentials.email_or_username}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

@router.post("/send-otp", summary="Send OTP for Email Verification")
async def send_otp(
    otp_request: SendOTPRequest,
    db: Session = Depends(get_session)
):
    """
    Send OTP code to email address for verification.
    Required before registration.
    
    - **email**: Email address to verify
    """
    try:
        # Check if email is already registered
        existing_user = db.query(User).filter(User.email == otp_request.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already registered"
            )
        
        # Generate and store OTP
        otp_code, expires_at = otp_service.store_otp(otp_request.email, db)
        
        # Send OTP email
        email_sent = await send_otp_email(otp_request.email, otp_code)
        
        if not email_sent:
            logger.warning(f"Failed to send OTP email to {otp_request.email}, but OTP was generated")
            # Still return success as OTP is stored (for testing/debugging)
        
        logger.info(f"OTP sent to email: {otp_request.email}")
        return {
            "message": "OTP sent successfully",
            "expires_at": expires_at.isoformat()
        }
        
    except ValueError as e:
        # Rate limit error
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Send OTP error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP"
        )

@router.post("/verify-otp", summary="Verify OTP Code")
async def verify_otp(
    verify_request: VerifyOTPRequest,
    db: Session = Depends(get_session)
):
    """
    Verify OTP code for email address.
    Required before registration.
    
    - **email**: Email address
    - **otp_code**: 6-digit OTP code
    """
    try:
        is_valid = otp_service.verify_otp(verify_request.email, verify_request.otp_code, db)
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP code"
            )
        
        logger.info(f"OTP verified successfully for email: {verify_request.email}")
        return {
            "message": "OTP verified successfully",
            "verified": True
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Verify OTP error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify OTP"
        )

@router.post("/register", response_model=UserResponse, summary="Register External User")
async def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_session)
):
    """
    Register a new external user account.
    Internal university users are automatically created via Active Directory sync.
    
    Requires email verification via OTP before registration.
    
    - **email**: Valid email address (must be verified via OTP)
    - **password**: Strong password meeting security requirements
    - **first_name**: User's first name
    - **last_name**: User's last name
    - **username**: Optional username (defaults to email if not provided)
    - **phone_number**: Optional phone number
    """
    try:
        # Check if email has been verified via OTP
        if not otp_service.is_email_verified(user_data.email, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address must be verified before registration. Please verify your email with the OTP code."
            )
        
        new_user = await auth_service.create_external_user(user_data.dict(), db)
        
        logger.info(f"New external user registered: {new_user.email}")
        return UserResponse.from_orm(new_user)
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/refresh", response_model=Dict[str, Any], summary="Refresh Access Token")
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    db: Session = Depends(get_session)
):
    """
    Refresh access token using refresh token.
    
    - **refresh_token**: Valid refresh token from login response
    """
    try:
        token_response = await auth_service.refresh_access_token(
            refresh_request.refresh_token, db
        )
        return token_response
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.post("/logout", summary="User Logout")
async def logout(
    refresh_request: RefreshTokenRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session)
):
    """
    Logout user by invalidating refresh token session.
    
    - **refresh_token**: Refresh token to invalidate
    """
    try:
        await auth_service.logout(refresh_request.refresh_token, db)
        logger.info(f"User logged out: {current_user.email}")
        return {"message": "Successfully logged out"}
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

@router.get("/me", response_model=UserResponse, summary="Get Current User")
async def get_current_user_info(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session)
):
    """
    Get current authenticated user information.
    Requires valid authentication token.
    """
    # Get user permissions
    permissions = auth_service._get_user_permissions(current_user, db)
    
    user_response = UserResponse.from_orm(current_user)
    user_response.permissions = permissions
    
    return user_response

@router.put("/me", response_model=UserResponse, summary="Update User Profile")
async def update_profile(
    profile_data: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session)
):
    """
    Update current user's profile information.
    Note: Internal users' basic info is synced from Active Directory.
    """
    try:
        # Update allowed fields
        if profile_data.first_name is not None:
            current_user.first_name = profile_data.first_name
        
        if profile_data.last_name is not None:
            current_user.last_name = profile_data.last_name
        
        if profile_data.phone_number is not None:
            current_user.phone_number = profile_data.phone_number
        
        # Email updates require special handling
        if profile_data.email and profile_data.email != current_user.email:
            # Check if email is already taken
            existing_user = db.query(User).filter(
                User.email == profile_data.email,
                User.id != current_user.id
            ).first()
            
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already in use"
                )
            
            # For internal users, warn about AD sync override
            if current_user.user_type.value == "internal":
                logger.warning(f"Email change for internal user {current_user.email} - may be overridden by AD sync")
            
            current_user.email = profile_data.email
        
        db.commit()
        db.refresh(current_user)
        
        logger.info(f"Profile updated for user: {current_user.email}")
        return UserResponse.from_orm(current_user)
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Profile update error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )

@router.post("/change-password", summary="Change Password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_session)
):
    """
    Change user password.
    Only available for external users - internal users must change password in Active Directory.
    """
    # Check if external user
    if current_user.user_type.value == "internal":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Internal users must change password through Active Directory"
        )
    
    try:
        # Verify current password
        if not current_user.password or not auth_service._verify_password(
            password_data.current_password, current_user.password
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Validate new password strength
        if not auth_service._is_password_strong(password_data.new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=auth_service._get_password_requirements()
            )
        
        # Hash and update password
        hashed_password = auth_service._hash_password(password_data.new_password)
        current_user.password = hashed_password
        
        db.commit()
        
        logger.info(f"Password changed for user: {current_user.email}")
        return {"message": "Password updated successfully"}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
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
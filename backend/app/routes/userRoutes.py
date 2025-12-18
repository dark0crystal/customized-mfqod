# Enhanced User Routes with Token Refresh Support

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Path, Header, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from app.schemas.user_schema import (
    UserUpdate, UserResponse, 
    UserSearchResponse, UserSearchParams, UserStatusUpdate, 
    UserRoleUpdate, BulkUserAction, UserListResponse, TokenInfoResponse
)
from app.services.userServices import (
    search_users,
    get_user_by_id,
    update_user,
    delete_user,
    get_all_users,
    get_user_by_email,
    get_users_by_role,
    get_users_by_status,
    activate_user,
    deactivate_user,
    # Enhanced functions for token refresh
    get_current_user_with_auto_refresh,
    validate_and_refresh_if_needed,
    get_token_expiry_info
)
from app.db.database import get_session
from app.utils.permission_decorator import require_permission
from app.models import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# =================== 
# Enhanced User Management with Auto-Refresh
# =================== 

async def get_current_user_with_refresh(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
):
    """Dependency to get current user with automatic token refresh"""
    token = credentials.credentials
    user_data, new_token = await validate_and_refresh_if_needed(token, session)
    return {"user": user_data, "new_token": new_token}

@router.get("/search", response_model=UserSearchResponse)
async def search_users_endpoint(
    response: Response,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh),
    email: Optional[str] = Query(None, description="Search by email (partial match)"),
    name: Optional[str] = Query(None, description="Search by name (partial match)"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Search users with various filters and pagination - requires authentication"""
    # Add new token to response header if refreshed
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await search_users(session, email, name, role, status, page, limit)

@router.get("/", response_model=UserSearchResponse)
async def get_users(
    response: Response,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Get all users with pagination"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await get_all_users(session, page, limit)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Get a specific user by ID"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await get_user_by_id(user_id, session)

@router.get("/email/{email}", response_model=UserResponse)
async def get_user_by_email_endpoint(
    response: Response,
    email: str = Path(..., description="User email"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Get user by exact email match"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await get_user_by_email(email, session)

@router.put("/{user_id}")
@require_permission("can_manage_users")
async def update_user_endpoint(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    user_update: UserUpdate = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Update user information - requires can_manage_users permission"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await update_user(user_id, user_update, session)

@router.delete("/{user_id}")
@require_permission("can_manage_users")
async def delete_user_endpoint(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Delete a user (soft delete by default) - requires can_manage_users permission"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await delete_user(user_id, session)

@router.delete("/{user_id}/permanent")
@require_permission("can_manage_users")
async def permanently_delete_user_endpoint(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """
    Permanently delete a user and anonymize their data.
    Requires can_manage_users permission (and ideally super_admin check inside service or here).
    """
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
        
    # Extra safety check: Ensure the requestor is an admin/super_admin
    # The require_permission decorator handles the basic check, but for hard delete
    # we might want to be extra careful. For now, we rely on the permission.
    
    from app.services.userServices import permanently_delete_user
    return await permanently_delete_user(user_id, session)

# =================== 
# Role Management with Auto-Refresh
# =================== 

@router.get("/role/{role_name}", response_model=UserSearchResponse)
async def get_users_by_role_endpoint(
    response: Response,
    role_name: str = Path(..., description="Role name"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Get users by role"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await get_users_by_role(role_name, session, page, limit)

@router.put("/{user_id}/role")
@require_permission("can_manage_users")
async def update_user_role(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    role_update: UserRoleUpdate = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Update user role - requires can_manage_users permission with role escalation prevention"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    current_user = current_user_data["user"]
    current_user_id = current_user.get("id")
    
    # Import permission services for full access check
    from app.services import permissionServices
    
    # Check if user has permission to manage roles
    if not permissionServices.check_user_permission(session, current_user_id, "can_manage_roles"):
        if not permissionServices.has_full_access(session, current_user_id):
            logger.warning(
                f"User {current_user_id} attempted to assign role without can_manage_roles permission"
            )
            raise HTTPException(
                status_code=403,
                detail="Permission 'can_manage_roles' is required to assign roles"
            )
    
    # Prevent role escalation: Only users with full access can assign roles with all permissions
    # Check if the role being assigned has all permissions (full access)
    if role_update.role_name:
        # Get the role to check its permissions
        from app.models import Role
        target_role = session.query(Role).filter(Role.name == role_update.role_name).first()
        
        if target_role:
            # Get all permissions in system
            all_permissions = permissionServices.get_all_permissions(session)
            role_permissions = {perm.name for perm in target_role.permissions}
            all_permission_names = {perm.name for perm in all_permissions}
            
            # Check if target role has all permissions (full access)
            has_all_permissions = role_permissions == all_permission_names and len(all_permission_names) > 0
            
            if has_all_permissions:
                # Only users with full access can assign roles with full access
                if not permissionServices.has_full_access(session, current_user_id):
                    logger.warning(
                        f"User {current_user_id} attempted to assign role with full access without full access privileges"
                    )
                    raise HTTPException(
                        status_code=403,
                        detail="Only users with full system access can assign roles with full access"
                    )
        
        # Prevent users from elevating their own role to one with full access
        if current_user_id == user_id and target_role:
            role_permissions = {perm.name for perm in target_role.permissions}
            all_permissions = permissionServices.get_all_permissions(session)
            all_permission_names = {perm.name for perm in all_permissions}
            has_all_permissions = role_permissions == all_permission_names and len(all_permission_names) > 0
            
            if has_all_permissions:
                logger.warning(
                    f"User {current_user_id} attempted to elevate their own role to one with full access"
                )
                raise HTTPException(
                    status_code=403,
                    detail="You cannot elevate your own role to one with full system access"
                )
    
    user_update = UserUpdate(role_name=role_update.role_name)
    return await update_user(user_id, user_update, session)

# =================== 
# Status Management with Auto-Refresh
# =================== 

@router.get("/status/{status_name}", response_model=UserSearchResponse)
async def get_users_by_status_endpoint(
    response: Response,
    status_name: str = Path(..., description="Status name"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Get users by status"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await get_users_by_status(status_name, session, page, limit)

@router.put("/{user_id}/status")
@require_permission("can_manage_users")
async def update_user_status(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    status_update: UserStatusUpdate = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Update user status - requires can_manage_users permission"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    user_update = UserUpdate(status_name=status_update.status_name)
    return await update_user(user_id, user_update, session)

@router.put("/{user_id}/activate")
@require_permission("can_manage_users")
async def activate_user_endpoint(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Activate a user account - requires can_manage_users permission"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await activate_user(user_id, session)

@router.put("/{user_id}/deactivate")
@require_permission("can_manage_users")
async def deactivate_user_endpoint(
    request: Request,
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Deactivate a user account - requires can_manage_users permission"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await deactivate_user(user_id, session)

# =================== 
# Session Management
# =================== 

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
):
    """Logout user (for token blacklisting if implemented)"""
    # Here you could implement token blacklisting in Redis or database
    # For now, just return success message
    return {"message": "Logged out successfully"}

@router.get("/token/info", response_model=TokenInfoResponse)
async def get_token_info(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Return token expiration info for the provided bearer token"""
    token = credentials.credentials
    return get_token_expiry_info(token)

@router.get("/me")
async def get_current_user(
    response: Response,
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Get current user information"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return {
        "user": current_user_data["user"],
        "token_refreshed": current_user_data["new_token"] is not None
    }

# =================== 
# Bulk Operations (keeping original functionality)
# =================== 

@router.post("/bulk-action")
@require_permission("can_manage_users")
async def bulk_user_action(
    request: Request,
    response: Response,
    bulk_action: BulkUserAction = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Perform bulk actions on multiple users - requires can_manage_users permission"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    results = []
    errors = []
    
    for user_id in bulk_action.user_ids:
        try:
            if bulk_action.action == "activate":
                result = await activate_user(user_id, session)
                results.append({"user_id": user_id, "result": result})
            elif bulk_action.action == "deactivate":
                result = await deactivate_user(user_id, session)
                results.append({"user_id": user_id, "result": result})
            elif bulk_action.action == "delete":
                result = await delete_user(user_id, session)
                results.append({"user_id": user_id, "result": result})
            else:
                errors.append({"user_id": user_id, "error": "Invalid action"})
        except Exception as e:
            errors.append({"user_id": user_id, "error": str(e)})
    
    return {
        "message": f"Bulk {bulk_action.action} completed",
        "successful": results,
        "errors": errors,
        "total_processed": len(bulk_action.user_ids),
        "successful_count": len(results),
        "error_count": len(errors)
    }

# =================== 
# Statistics (keeping original functionality)
# =================== 

@router.get("/stats")
async def get_user_statistics(
    response: Response,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Get user statistics"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    from sqlalchemy import func, select
    from models import User, Role, UserStatus
    
    # Total users
    total_users = session.execute(select(func.count(User.id))).scalar()
    
    # Users by role
    role_stats = session.execute(
        select(Role.name, func.count(User.id))
        .join(User, Role.id == User.role_id)
        .group_by(Role.name)
    ).all()
    
    # Users by status
    status_stats = session.execute(
        select(UserStatus.name, func.count(User.id))
        .join(User, UserStatus.id == User.status_id)
        .group_by(UserStatus.name)
    ).all()
    
    # Recent registrations (last 30 days)
    from datetime import datetime, timezone, timedelta
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_registrations = session.execute(
        select(func.count(User.id))
        .where(User.created_at >= thirty_days_ago)
    ).scalar()
    
    return {
        "total_users": total_users,
        "users_by_role": dict(role_stats),
        "users_by_status": dict(status_stats),
        "recent_registrations": recent_registrations,
        "statistics_generated_at": datetime.now(timezone.utc).isoformat()
    }
# Enhanced User Routes with Token Refresh Support

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Path, Header, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from schemas.user_schema import (
    UserLogin, UserRegister, UserUpdate, UserResponse, 
    UserSearchResponse, UserSearchParams, UserStatusUpdate, 
    UserRoleUpdate, BulkUserAction, UserListResponse,
    RefreshTokenRequest, TokenResponse  # Add these to your schemas
)
from services.userServices import (
    # Original functions
    register_user,
    authenticate_user,
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
    # New enhanced functions
    authenticate_user_with_refresh,
    refresh_access_token,
    get_current_user_with_auto_refresh,
    validate_and_refresh_if_needed,
    get_token_expiry_info
)
from db.database import get_session

router = APIRouter()
security = HTTPBearer()

# =================== 
# Enhanced Authentication with Token Refresh
# =================== 

@router.post("/login")
async def login(user: UserLogin, session: Session = Depends(get_session)):
    """Authenticate user and return JWT tokens (access + refresh)"""
    return await authenticate_user_with_refresh(user, session)

@router.post("/refresh")
async def refresh_token(
    refresh_token_request: RefreshTokenRequest,
    session: Session = Depends(get_session)
):
    """Refresh access token using refresh token"""
    return await refresh_access_token(refresh_token_request.refresh_token, session)

@router.post("/token/verify")
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
):
    """Verify token and return user info + new token if auto-refresh triggered"""
    token = credentials.credentials
    user_data, new_token = await validate_and_refresh_if_needed(token, session)
    
    response_data = {
        "valid": True,
        "user": user_data,
        "token_refreshed": new_token is not None
    }
    
    if new_token:
        response_data["new_token"] = new_token
    
    return response_data

@router.get("/token/info")
async def get_token_info(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get token expiration information"""
    token = credentials.credentials
    return get_token_expiry_info(token)

@router.post("/register")
async def register(user: UserRegister, session: Session = Depends(get_session)):
    """Register a new user"""
    return await register_user(user, session)

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

@router.get("/users/search", response_model=UserSearchResponse)
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
    """Search users with various filters and pagination"""
    # Add new token to response header if refreshed
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await search_users(session, email, name, role, status, page, limit)

@router.get("/users", response_model=UserSearchResponse)
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

@router.get("/users/{user_id}", response_model=UserResponse)
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

@router.get("/users/email/{email}", response_model=UserResponse)
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

@router.put("/users/{user_id}")
async def update_user_endpoint(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    user_update: UserUpdate = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Update user information"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await update_user(user_id, user_update, session)

@router.delete("/users/{user_id}")
async def delete_user_endpoint(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Delete a user (soft delete by default)"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await delete_user(user_id, session)

# =================== 
# Role Management with Auto-Refresh
# =================== 

@router.get("/users/role/{role_name}", response_model=UserSearchResponse)
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

@router.put("/users/{user_id}/role")
async def update_user_role(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    role_update: UserRoleUpdate = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Update user role"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    user_update = UserUpdate(role_name=role_update.role_name)
    return await update_user(user_id, user_update, session)

# =================== 
# Status Management with Auto-Refresh
# =================== 

@router.get("/users/status/{status_name}", response_model=UserSearchResponse)
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

@router.put("/users/{user_id}/status")
async def update_user_status(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    status_update: UserStatusUpdate = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Update user status"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    user_update = UserUpdate(status_name=status_update.status_name)
    return await update_user(user_id, user_update, session)

@router.put("/users/{user_id}/activate")
async def activate_user_endpoint(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Activate a user account"""
    if current_user_data["new_token"]:
        response.headers["X-New-Token"] = current_user_data["new_token"]
    
    return await activate_user(user_id, session)

@router.put("/users/{user_id}/deactivate")
async def deactivate_user_endpoint(
    response: Response,
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Deactivate a user account"""
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

@router.post("/users/bulk-action")
async def bulk_user_action(
    response: Response,
    bulk_action: BulkUserAction = ...,
    session: Session = Depends(get_session),
    current_user_data: dict = Depends(get_current_user_with_refresh)
):
    """Perform bulk actions on multiple users"""
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

@router.get("/users/stats")
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
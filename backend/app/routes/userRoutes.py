from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Path
from sqlmodel import Session
from schemas.user_schema import (
    UserLogin, UserRegister, UserUpdate, UserResponse, 
    UserSearchResponse, UserSearchParams, UserStatusUpdate, 
    UserRoleUpdate, BulkUserAction, UserListResponse
)
from services.userServices import (
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
    deactivate_user
)
from db.database import get_session

router = APIRouter()

# =================== 
# Authentication
# =================== 

@router.post("/login")
async def login(user: UserLogin, session: Session = Depends(get_session)):
    """Authenticate user and return JWT token"""
    return await authenticate_user(user, session)

@router.post("/register")
async def register(user: UserRegister, session: Session = Depends(get_session)):
    """Register a new user"""
    return await register_user(user, session)

# =================== 
# User Management
# =================== 

@router.get("/users/search", response_model=UserSearchResponse)
async def search_users_endpoint(
    session: Session = Depends(get_session),
    email: Optional[str] = Query(None, description="Search by email (partial match)"),
    name: Optional[str] = Query(None, description="Search by name (partial match)"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Search users with various filters and pagination"""
    return await search_users(session, email, name, role, status, page, limit)

@router.get("/users", response_model=UserSearchResponse)
async def get_users(
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Get all users with pagination"""
    return await get_all_users(session, page, limit)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session)
):
    """Get a specific user by ID"""
    return await get_user_by_id(user_id, session)

@router.get("/users/email/{email}", response_model=UserResponse)
async def get_user_by_email_endpoint(
    email: str = Path(..., description="User email"),
    session: Session = Depends(get_session)
):
    """Get user by exact email match"""
    return await get_user_by_email(email, session)

@router.put("/users/{user_id}")
async def update_user_endpoint(
    user_id: str = Path(..., description="User ID"),
    user_update: UserUpdate = ...,
    session: Session = Depends(get_session)
):
    """Update user information"""
    return await update_user(user_id, user_update, session)

@router.delete("/users/{user_id}")
async def delete_user_endpoint(
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session)
):
    """Delete a user (soft delete by default)"""
    return await delete_user(user_id, session)

# =================== 
# Role Management
# =================== 

@router.get("/users/role/{role_name}", response_model=UserSearchResponse)
async def get_users_by_role_endpoint(
    role_name: str = Path(..., description="Role name"),
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Get users by role"""
    return await get_users_by_role(role_name, session, page, limit)

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str = Path(..., description="User ID"),
    role_update: UserRoleUpdate = ...,
    session: Session = Depends(get_session)
):
    """Update user role"""
    user_update = UserUpdate(role_name=role_update.role_name)
    return await update_user(user_id, user_update, session)

# =================== 
# Status Management
# =================== 

@router.get("/users/status/{status_name}", response_model=UserSearchResponse)
async def get_users_by_status_endpoint(
    status_name: str = Path(..., description="Status name"),
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Number of users per page")
):
    """Get users by status"""
    return await get_users_by_status(status_name, session, page, limit)

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str = Path(..., description="User ID"),
    status_update: UserStatusUpdate = ...,
    session: Session = Depends(get_session)
):
    """Update user status"""
    user_update = UserUpdate(status_name=status_update.status_name)
    return await update_user(user_id, user_update, session)

@router.put("/users/{user_id}/activate")
async def activate_user_endpoint(
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session)
):
    """Activate a user account"""
    return await activate_user(user_id, session)

@router.put("/users/{user_id}/deactivate")
async def deactivate_user_endpoint(
    user_id: str = Path(..., description="User ID"),
    session: Session = Depends(get_session)
):
    """Deactivate a user account"""
    return await deactivate_user(user_id, session)

# =================== 
# Bulk Operations
# =================== 

@router.post("/users/bulk-action")
async def bulk_user_action(
    bulk_action: BulkUserAction = ...,
    session: Session = Depends(get_session)
):
    """Perform bulk actions on multiple users"""
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
# Statistics
# =================== 

@router.get("/users/stats")
async def get_user_statistics(session: Session = Depends(get_session)):
    """Get user statistics"""
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
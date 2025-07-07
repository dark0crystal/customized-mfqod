# utils/permission_decorator.py
from functools import wraps
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from db.database import get_session
from services import permissionServices
from typing import Callable, List

def require_permission(permission_name: str):
    """
    Decorator to protect routes with specific permissions.
    
    Usage:
    @require_permission("can_view_users")
    def get_users():
        pass
    
    Args:
        permission_name: The name of the permission required to access the route
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user_id from kwargs or current_user dependency
            # You'll need to implement get_current_user() function
            user_id = kwargs.get('current_user_id')  # Adjust based on your auth system
            session = kwargs.get('session')
            
            if not user_id:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            if not session:
                raise HTTPException(status_code=500, detail="Database session not available")
            
            # Check if user has the required permission
            has_permission = permissionServices.check_user_permission(session, user_id, permission_name)
            
            if not has_permission:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission '{permission_name}' is required to access this resource"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_any_permission(permission_names: List[str]):
    """
    Decorator to protect routes with any of the specified permissions.
    
    Usage:
    @require_any_permission(["can_view_users", "can_edit_users"])
    def get_users():
        pass
    
    Args:
        permission_names: List of permission names, user needs at least one
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user_id = kwargs.get('current_user_id')
            session = kwargs.get('session')
            
            if not user_id:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            if not session:
                raise HTTPException(status_code=500, detail="Database session not available")
            
            # Check if user has any of the required permissions
            has_any_permission = False
            for permission_name in permission_names:
                if permissionServices.check_user_permission(session, user_id, permission_name):
                    has_any_permission = True
                    break
            
            if not has_any_permission:
                raise HTTPException(
                    status_code=403, 
                    detail=f"One of these permissions is required: {', '.join(permission_names)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_all_permissions(permission_names: List[str]):
    """
    Decorator to protect routes requiring all specified permissions.
    
    Usage:
    @require_all_permissions(["can_view_users", "can_edit_users"])
    def update_user():
        pass
    
    Args:
        permission_names: List of permission names, user needs all of them
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user_id = kwargs.get('current_user_id')
            session = kwargs.get('session')
            
            if not user_id:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            if not session:
                raise HTTPException(status_code=500, detail="Database session not available")
            
            # Check if user has all required permissions
            missing_permissions = []
            for permission_name in permission_names:
                if not permissionServices.check_user_permission(session, user_id, permission_name):
                    missing_permissions.append(permission_name)
            
            if missing_permissions:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Missing required permissions: {', '.join(missing_permissions)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Example usage in your routes:
"""
from utils.permission_decorator import require_permission, require_any_permission

@router.get("/users")
@require_permission("can_view_users")
def get_users(current_user_id: str, session: Session = Depends(get_session)):
    # Your route logic here
    pass

@router.post("/users")
@require_any_permission(["can_create_users", "can_manage_users"])
def create_user(current_user_id: str, session: Session = Depends(get_session)):
    # Your route logic here
    pass

@router.put("/users/{user_id}")
@require_all_permissions(["can_edit_users", "can_view_users"])
def update_user(user_id: str, current_user_id: str, session: Session = Depends(get_session)):
    # Your route logic here
    pass
"""
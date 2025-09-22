# utils/permission_decorator.py
"""
Permission-based access control decorators for FastAPI routes.

This module provides decorators to protect API endpoints with role-based permissions.
The decorators integrate with your existing authentication system and permission service
to ensure users have the required permissions before accessing protected routes.

The decorators automatically extract user information from the request token,
eliminating the need to manually pass user_id parameters to route functions.

Dependencies:
- permissionServices: Service layer for checking user permissions
- Authentication system that provides JWT tokens or similar
- Database session for permission lookups
"""

from functools import wraps
from fastapi import HTTPException, Depends, Request
from sqlalchemy.orm import Session
from db.database import get_session
from services import permissionServices
from typing import Callable, List
import jwt  

import os
from dotenv import load_dotenv

load_dotenv()
# Configuration - adjust these based on your JWT setup
JWT_SECRET_KEY =  os.getenv("SECRET_KEY")
JWT_ALGORITHM = os.getenv("ALGORITHM")

def extract_user_from_token(request: Request) -> str:
    """
    Extract user ID from JWT token in the request.
    
    This function looks for the token in the Authorization header and extracts
    the user ID from it. Modify this function based on your token structure.
    
    Args:
        request (Request): FastAPI request object
        
    Returns:
        str: User ID extracted from token
        
    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    # Get Authorization header
    authorization = request.headers.get("Authorization")
    
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is missing"
        )
    
    # Check if it's a Bearer token
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Expected 'Bearer <token>'"
        )
    
    # Extract token from "Bearer <token>"
    token = authorization.split(" ")[1]
    
    try:
        # Decode JWT token
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # Extract user ID from payload
        # Adjust the key based on your token structure
        user_id = payload.get("user_id") or payload.get("sub") or payload.get("id")
        
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="User ID not found in token"
            )
            
        return str(user_id)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

def require_permission(permission_name: str):
    """
    Decorator to protect routes with a specific permission requirement.
    
    This decorator automatically extracts the user ID from the request token
    and checks if the user has the specified permission before allowing access.
    
    Usage:
    @require_permission("can_view_users")
    def get_users():
        pass
    
    Args:
        permission_name (str): The name of the permission required to access the route.
                              This should match a permission name in your database.
    
    Returns:
        Callable: The decorated function with permission checking logic.
    
    Raises:
        HTTPException: 
            - 401 if token is missing, invalid, or expired
            - 403 if user lacks the required permission
            - 500 if database session is not available
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request object from function arguments
            request = None
            session = None
            
            # Look for Request and Session objects in function arguments
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                elif isinstance(arg, Session):
                    session = arg
            
            # Also check in kwargs for dependency injection
            if not request:
                request = kwargs.get('request')
            if not session:
                session = kwargs.get('session') or kwargs.get('db')
            
            # Validate that request is available
            if not request:
                raise HTTPException(
                    status_code=500,
                    detail="Request object not available. Add 'request: Request' parameter to your route."
                )
            
            # Validate that database session is available
            if not session:
                raise HTTPException(
                    status_code=500, 
                    detail="Database session not available. Add 'db: Session = Depends(get_session)' to your route."
                )
            
            # Extract user ID from token
            user_id = extract_user_from_token(request)
            
            # Check if user has the required permission using the permission service
            has_permission = permissionServices.check_user_permission(
                session, user_id, permission_name
            )
            
            # Deny access if user lacks the required permission
            if not has_permission:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission '{permission_name}' is required to access this resource"
                )
            
            # Permission check passed, execute the original function
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_any_permission(permission_names: List[str]):
    """
    Decorator to protect routes requiring at least one of the specified permissions.
    
    This decorator automatically extracts the user ID from the request token
    and checks if the user has ANY of the specified permissions.
    
    Usage:
    @require_any_permission(["can_view_users", "can_edit_users"])
    def get_users():
        pass
    
    Args:
        permission_names (List[str]): List of permission names. User needs at least
                                     one of these permissions to access the route.
    
    Returns:
        Callable: The decorated function with permission checking logic.
    
    Raises:
        HTTPException: 
            - 401 if token is missing, invalid, or expired
            - 403 if user lacks all of the specified permissions
            - 500 if request or database session is not available
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request object and session from function arguments
            request = None
            session = None
            
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                elif isinstance(arg, Session):
                    session = arg
            
            if not request:
                request = kwargs.get('request')
            if not session:
                session = kwargs.get('session') or kwargs.get('db')
            
            # Validate request and session availability
            if not request:
                raise HTTPException(
                    status_code=500,
                    detail="Request object not available. Add 'request: Request' parameter to your route."
                )
            
            if not session:
                raise HTTPException(
                    status_code=500, 
                    detail="Database session not available. Add 'db: Session = Depends(get_session)' to your route."
                )
            
            # Extract user ID from token
            user_id = extract_user_from_token(request)
            
            # Check if user has any of the required permissions
            has_any_permission = False
            for permission_name in permission_names:
                if permissionServices.check_user_permission(session, user_id, permission_name):
                    has_any_permission = True
                    break  # Found a matching permission, no need to check others
            
            # Deny access if user has none of the required permissions
            if not has_any_permission:
                raise HTTPException(
                    status_code=403, 
                    detail=f"One of these permissions is required: {', '.join(permission_names)}"
                )
            
            # At least one permission matched, execute the original function
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_all_permissions(permission_names: List[str]):
    """
    Decorator to protect routes requiring ALL specified permissions.
    
    This decorator automatically extracts the user ID from the request token
    and checks if the user has ALL of the specified permissions.
    
    Usage:
    @require_all_permissions(["can_view_users", "can_edit_users"])
    def update_user():
        pass
    
    Args:
        permission_names (List[str]): List of permission names. User must have
                                     ALL of these permissions to access the route.
    
    Returns:
        Callable: The decorated function with permission checking logic.
    
    Raises:
        HTTPException: 
            - 401 if token is missing, invalid, or expired
            - 403 if user lacks any of the specified permissions
            - 500 if request or database session is not available
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request object and session from function arguments
            request = None
            session = None
            
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                elif isinstance(arg, Session):
                    session = arg
            
            if not request:
                request = kwargs.get('request')
            if not session:
                session = kwargs.get('session') or kwargs.get('db')
            
            # Validate request and session availability
            if not request:
                raise HTTPException(
                    status_code=500,
                    detail="Request object not available. Add 'request: Request' parameter to your route."
                )
            
            if not session:
                raise HTTPException(
                    status_code=500, 
                    detail="Database session not available. Add 'db: Session = Depends(get_session)' to your route."
                )
            
            # Extract user ID from token
            user_id = extract_user_from_token(request)
            
            # Check if user has all required permissions
            missing_permissions = []
            for permission_name in permission_names:
                if not permissionServices.check_user_permission(session, user_id, permission_name):
                    missing_permissions.append(permission_name)
            
            # Deny access if user is missing any required permissions
            if missing_permissions:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Missing required permissions: {', '.join(missing_permissions)}"
                )
            
            # All permissions verified, execute the original function
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Alternative: Create a dependency for getting current user
def get_current_user_from_token(request: Request) -> str:
    """
    FastAPI dependency to extract current user from token.
    
    This can be used as a Depends() dependency in your routes if you prefer
    the dependency injection approach over decorators.
    
    Usage:
    def my_route(current_user: str = Depends(get_current_user_from_token)):
        pass
    """
    return extract_user_from_token(request)

# Example usage in your routes:
"""
Updated Integration Examples with Token-Based Authentication:
-----------------------------------------------------------

from fastapi import Request
from utils.permission_decorator import require_permission, require_any_permission

# Basic usage - just add Request parameter
@router.get("/users")
@require_permission("can_view_users")
def get_users(request: Request, db: Session = Depends(get_session)):
    # Route logic here - user authentication handled automatically
    # No need to manually pass user_id anymore!
    pass

# Multiple permission options
@router.post("/users")
@require_any_permission(["can_create_users", "can_manage_users"])
def create_user(
    payload: CreateUserRequest,
    request: Request, 
    db: Session = Depends(get_session)
):
    # Route logic here - token is automatically processed
    pass

# Multiple permission requirements
@router.put("/users/{user_id}")
@require_all_permissions(["can_edit_users", "can_view_users"])
def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    request: Request, 
    db: Session = Depends(get_session)
):
    # Route logic here - all permissions checked automatically
    pass

Alternative: Using Dependencies Instead of Decorators:
----------------------------------------------------

# If you prefer dependency injection over decorators
@router.get("/users")
def get_users(
    current_user: str = Depends(get_current_user_from_token),
    db: Session = Depends(get_session)
):
    # Check permissions manually in route
    if not permissionServices.check_user_permission(db, current_user, "can_view_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Route logic here
    pass

Token Structure Expected:
------------------------

Your JWT token should contain user identification. Common structures:

Option 1 - Using 'user_id' claim:
{
    "user_id": "12345",
    "username": "john_doe",
    "exp": 1234567890
}

Option 2 - Using 'sub' (subject) claim:
{
    "sub": "12345",
    "username": "john_doe", 
    "exp": 1234567890
}

Option 3 - Using 'id' claim:
{
    "id": "12345",
    "username": "john_doe",
    "exp": 1234567890
}

Configuration Requirements:
--------------------------

1. Install PyJWT: pip install PyJWT
2. Set your JWT_SECRET_KEY (preferably from environment variables)
3. Adjust JWT_ALGORITHM if you use a different algorithm
4. Modify extract_user_from_token() if your token structure is different

Environment Variables Setup:
---------------------------

# .env file
JWT_SECRET_KEY=your-super-secret-key-here
JWT_ALGORITHM=HS256

# Then in your code:
import os
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

Client-Side Token Usage:
-----------------------

When making requests to your API, clients should include the token in the Authorization header:

Headers:
{
    "Authorization": "Bearer <your-jwt-token>",
    "Content-Type": "application/json"
}

Example with curl:
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     -H "Content-Type: application/json" \
     http://localhost:8000/users
"""
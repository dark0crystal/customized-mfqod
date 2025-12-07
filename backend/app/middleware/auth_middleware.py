from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Callable, Any
from functools import wraps
import logging

from app.db.database import get_session
from app.services.auth_service import AuthService
from app.models import User, Role, Permission

logger = logging.getLogger(__name__)

class AuthMiddleware:
    def __init__(self):
        self.auth_service = AuthService()
        self.security = HTTPBearer(auto_error=False)
    
    async def get_current_user(
        self, 
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
        db: Session = Depends(get_session)
    ) -> Optional[User]:
        """
        Dependency to get current authenticated user
        Returns None if no token or invalid token (for optional auth)
        """
        if not credentials:
            return None
        
        try:
            user = await self.auth_service.verify_token(credentials.credentials, db)
            return user
        except HTTPException:
            return None
    
    async def require_authentication(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
        db: Session = Depends(get_session)
    ) -> User:
        """
        Dependency that requires valid authentication
        Raises HTTPException if not authenticated
        """
        try:
            user = await self.auth_service.verify_token(credentials.credentials, db)
            return user
        except HTTPException as e:
            logger.warning(f"Authentication failed: {e.detail}")
            raise e
    
    def require_roles(self, required_roles: List[str]):
        """
        Dependency factory that requires specific roles
        Usage: @app.get("/admin", dependencies=[Depends(auth.require_roles(["admin"]))])
        """
        async def role_checker(
            current_user: User = Depends(self.require_authentication),
            db: Session = Depends(get_session)
        ) -> User:
            if not current_user.role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User has no assigned role"
                )
            
            # Super Admin bypass: If user has super_admin role, grant access to everything
            if current_user.role.name.lower() in ["super_admin", "admin"]:
                logger.info(f"Super admin user {current_user.email} granted access to roles: {required_roles}")
                return current_user
            
            if current_user.role.name not in required_roles:
                logger.warning(f"User {current_user.email} attempted to access resource requiring roles {required_roles} but has role {current_user.role.name}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Required roles: {', '.join(required_roles)}"
                )
            
            return current_user
        
        return role_checker
    
    def require_permissions(self, required_permissions: List[str]):
        """
        Dependency factory that requires specific permissions
        Usage: @app.get("/items", dependencies=[Depends(auth.require_permissions(["read_items"]))])
        """
        async def permission_checker(
            current_user: User = Depends(self.require_authentication),
            db: Session = Depends(get_session)
        ) -> User:
            # Super Admin bypass: If user has super_admin or admin role, grant access to everything
            if current_user.role and current_user.role.name.lower() in ["super_admin", "admin"]:
                logger.info(f"Super admin user {current_user.email} granted access to all permissions")
                return current_user
            
            user_permissions = self._get_user_permissions(current_user, db)
            
            missing_permissions = [perm for perm in required_permissions if perm not in user_permissions]
            
            if missing_permissions:
                logger.warning(f"User {current_user.email} missing permissions: {missing_permissions}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Missing permissions: {', '.join(missing_permissions)}"
                )
            
            return current_user
        
        return permission_checker
    
    def require_internal_user(self):
        """
        Dependency that requires internal (AD) user
        """
        async def internal_user_checker(
            current_user: User = Depends(self.require_authentication)
        ) -> User:
            if current_user.user_type.value != "internal":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This endpoint requires internal university authentication"
                )
            return current_user
        
        return internal_user_checker
    
    def require_admin(self):
        """
        Convenience dependency for admin-only access (includes super_admin)
        """
        return self.require_roles(["super_admin", "admin"])
    
    def require_staff(self):
        """
        Convenience dependency for staff-level access (includes super_admin)
        """
        return self.require_roles(["super_admin", "admin", "staff"])
    
    def require_user_or_admin(self, user_id_param: str = "user_id"):
        """
        Dependency that allows access if user is accessing their own resources or is admin
        """
        async def user_or_admin_checker(
            request: Request,
            current_user: User = Depends(self.require_authentication),
            db: Session = Depends(get_session)
        ) -> User:
            # Extract user_id from path parameters
            path_params = request.path_params
            target_user_id = path_params.get(user_id_param)
            
            # Allow if accessing own resources
            if current_user.id == target_user_id:
                return current_user
            
            # Allow if admin
            if current_user.role and current_user.role.name == "admin":
                return current_user
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only access own resources or require admin privileges"
            )
        
        return user_or_admin_checker
    
    def _get_user_permissions(self, user: User, db: Session) -> List[str]:
        """Get all permissions for a user"""
        if not user.role:
            return []
        
        # Super Admin bypass: If user has super_admin or admin role, return all possible permissions
        if user.role.name.lower() in ["super_admin", "admin"]:
            # Return a comprehensive list of all permissions that exist in the system
            all_permissions = db.query(Permission).all()
            return [permission.name for permission in all_permissions]
        
        permissions = db.query(Permission).join(
            Permission.roles
        ).filter(Role.id == user.role.id).all()
        
        return [permission.name for permission in permissions]

# Decorator functions for easier use
def require_auth(f):
    """Decorator that requires authentication"""
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        # This is typically handled by FastAPI dependencies
        return await f(*args, **kwargs)
    return decorated_function

def require_role(roles: List[str]):
    """Decorator that requires specific roles"""
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            # This is typically handled by FastAPI dependencies
            return await f(*args, **kwargs)
        return decorated_function
    return decorator

def require_permission(permissions: List[str]):
    """Decorator that requires specific permissions"""
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            # This is typically handled by FastAPI dependencies
            return await f(*args, **kwargs)
        return decorated_function
    return decorator

# Global middleware instance
auth_middleware = AuthMiddleware()

# Convenience dependency functions
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_session)
) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    return await auth_middleware.get_current_user(credentials, db)

async def get_current_user_required(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_session)
) -> User:
    """Get current user (authentication required)"""
    return await auth_middleware.require_authentication(credentials, db)

# Permission checker functions
class PermissionChecker:
    """Helper class for checking permissions"""
    
    @staticmethod
    def can_access_item(user: User, item_user_id: str) -> bool:
        """Check if user can access an item"""
        if not user:
            return False
        
        # Admin can access everything
        if user.role and user.role.name == "admin":
            return True
        
        # Owner can access their own items
        if user.id == item_user_id:
            return True
        
        # Staff can access items in their managed branches (would need branch logic)
        if user.role and user.role.name in ["staff", "manager"]:
            return True  # Simplified - would check branch access
        
        return False
    
    @staticmethod
    def can_manage_users(user: User) -> bool:
        """Check if user can manage other users"""
        return user.role and user.role.name in ["admin"]
    
    @staticmethod
    def can_approve_items(user: User) -> bool:
        """Check if user can approve/reject items"""
        return user.role and user.role.name in ["admin", "staff", "manager"]
    
    @staticmethod
    def can_manage_branches(user: User) -> bool:
        """Check if user can manage branches"""
        return user.role and user.role.name in ["admin"]

# Rate limiting middleware
class RateLimitMiddleware:
    def __init__(self):
        self.auth_service = AuthService()
    
    async def check_rate_limit(self, request: Request, db: Session = Depends(get_session)):
        """Check rate limiting for API requests"""
        ip_address = self.auth_service._get_client_ip(request)
        
        # Implementation would depend on your rate limiting strategy
        # Could use Redis or database-based tracking
        pass

# Security headers middleware
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    return response
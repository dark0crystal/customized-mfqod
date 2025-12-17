from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Callable, Any
from functools import wraps
import logging

from app.db.database import get_session
from app.services.auth_service import AuthService
from app.services import permissionServices
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
        Note: This checks role names. For permission-based access, use require_permissions instead.
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
            
            # Full access bypass: If user has all permissions, grant access
            if permissionServices.has_full_access(db, current_user.id):
                logger.info(f"User with full access {current_user.email} granted access to roles: {required_roles}")
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
            # Full access bypass: If user has all permissions, grant access to everything
            if permissionServices.has_full_access(db, current_user.id):
                logger.info(f"User with full access {current_user.email} granted access to all permissions")
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
        Convenience dependency for admin-only access
        Note: This now checks for full access permissions rather than role names
        """
        async def admin_checker(
            current_user: User = Depends(self.require_authentication),
            db: Session = Depends(get_session)
        ) -> User:
            if not permissionServices.has_full_access(db, current_user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Full system access required"
                )
            return current_user
        return admin_checker
    
    def require_staff(self):
        """
        Convenience dependency for staff-level access
        Note: This checks for specific permissions. Update based on your permission structure.
        """
        return self.require_permissions(["can_manage_items", "can_view_analytics"])
    
    def require_user_or_admin(self, user_id_param: str = "user_id"):
        """
        Dependency that allows access if user is accessing their own resources or has full access
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
            
            # Allow if user has full access (all permissions)
            if permissionServices.has_full_access(db, current_user.id):
                return current_user
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Can only access own resources or require full system access"
            )
        
        return user_or_admin_checker
    
    def _get_user_permissions(self, user: User, db: Session) -> List[str]:
        """Get all permissions for a user"""
        if not user.role:
            return []
        
        # Full access bypass: If user has all permissions, return all possible permissions
        if permissionServices.has_full_access(db, user.id):
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
    def can_access_item(user: User, item_user_id: str, db: Session) -> bool:
        """Check if user can access an item"""
        if not user:
            return False
        
        # User with full access can access everything
        if permissionServices.has_full_access(db, user.id):
            return True
        
        # Owner can access their own items
        if user.id == item_user_id:
            return True
        
        # Check if user has permission to manage items
        if permissionServices.check_user_permission(db, user.id, "can_manage_items"):
            return True
        
        return False
    
    @staticmethod
    def can_manage_users(user: User, db: Session) -> bool:
        """Check if user can manage other users"""
        if not user:
            return False
        return permissionServices.has_full_access(db, user.id) or \
               permissionServices.check_user_permission(db, user.id, "can_manage_users")
    
    @staticmethod
    def can_approve_items(user: User, db: Session) -> bool:
        """Check if user can approve/reject items"""
        if not user:
            return False
        return permissionServices.has_full_access(db, user.id) or \
               permissionServices.check_user_permission(db, user.id, "can_manage_items")
    
    @staticmethod
    def can_manage_branches(user: User, db: Session) -> bool:
        """Check if user can manage branches"""
        if not user:
            return False
        return permissionServices.has_full_access(db, user.id) or \
               permissionServices.check_user_permission(db, user.id, "can_manage_branches")

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
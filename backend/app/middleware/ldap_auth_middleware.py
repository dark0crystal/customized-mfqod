from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.ldapAuthService import LDAPAuthService
from typing import List

security = HTTPBearer()
ldap_service = LDAPAuthService()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency to get current authenticated user
    """
    token = credentials.credentials
    user_data = ldap_service.verify_jwt_token(token)
    return user_data

async def require_roles(required_roles: List[str]):
    """
    Dependency factory for role-based access control
    """
    def role_checker(current_user = Depends(get_current_user)):
        user_roles = current_user.get("roles", [])
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these roles: {', '.join(required_roles)}"
            )
        return current_user
    return role_checker

# Predefined role dependencies
require_admin = require_roles(["admin"])
require_manager = require_roles(["admin", "manager"])
require_user = require_roles(["admin", "manager", "user"])
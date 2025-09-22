
# routes/ldap_auth_routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.ldapAuthService import LDAPAuthService
from schemas.ldap_auth_schemas import LoginRequest, TokenResponse, UserInfo, UserSearchResponse
from typing import List, Optional

router = APIRouter(prefix="/auth", tags=["LDAP Authentication"])
security = HTTPBearer()
ldap_service = LDAPAuthService()

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate user with LDAP credentials
    """
    user_info = ldap_service.authenticate_user(
        credentials.username, 
        credentials.password
    )
    
    # Create JWT token
    jwt_token = ldap_service.create_jwt_token(user_info)
    
    return TokenResponse(
        access_token=jwt_token,
        token_type="bearer",
        expires_in=28800,  # 8 hours
        user_info=user_info
    )

@router.get("/me", response_model=UserInfo)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current authenticated user information
    """
    token = credentials.credentials
    user_data = ldap_service.verify_jwt_token(token)
    
    return UserInfo(
        username=user_data["sub"],
        email=user_data.get("email"),
        display_name=user_data.get("name"),
        roles=user_data.get("roles", []),
        groups=user_data.get("groups", [])
    )

@router.get("/users/search", response_model=UserSearchResponse)
async def search_users(
    q: Optional[str] = Query("*", description="Search term"),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Search users in LDAP directory (requires authentication)
    """
    # Verify token
    user_data = ldap_service.verify_jwt_token(credentials.credentials)
    
    # Check if user has admin role
    if "admin" not in user_data.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    users = ldap_service.search_users(q)
    
    user_list = [
        UserInfo(
            username=user["username"],
            email=user.get("email"),
            display_name=user.get("display_name"),
            first_name=user.get("first_name"),
            last_name=user.get("last_name"),
            groups=user.get("groups", []),
            roles=user.get("roles", [])
        )
        for user in users
    ]
    
    return UserSearchResponse(
        users=user_list,
        total=len(user_list)
    )

@router.get("/users/{username}/groups")
async def get_user_groups(
    username: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get groups for a specific user
    """
    # Verify token
    user_data = ldap_service.verify_jwt_token(credentials.credentials)
    
    # Users can only see their own groups unless they're admin
    if user_data["sub"] != username and "admin" not in user_data.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    groups = ldap_service.get_user_groups(username)
    return {"username": username, "groups": groups}
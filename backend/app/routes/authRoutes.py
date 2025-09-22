# from fastapi import APIRouter, Request, Depends, HTTPException, status
# from fastapi.responses import RedirectResponse, HTMLResponse
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from services.azure_auth_service import AzureAuthService
# from schemas.auth_schemas import TokenResponse, UserInfo
# import uuid

# router = APIRouter(prefix="/auth", tags=["Authentication"])
# security = HTTPBearer()
# azure_service = AzureAuthService()

# @router.get("/login")
# async def login():
#     """
#     Redirect user to Azure AD login page
#     """
#     state = str(uuid.uuid4())  # Generate random state for security
#     auth_url = azure_service.get_authorization_url(state=state)
#     return RedirectResponse(url=auth_url)

# @router.get("/callback")
# async def auth_callback(request: Request):
#     """
#     Handle Azure AD callback after user authentication
#     """
#     # Get authorization code from query parameters
#     code = request.query_params.get("code")
#     error = request.query_params.get("error")
    
#     if error:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=f"Authentication failed: {error}"
#         )
    
#     if not code:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Authorization code not found"
#         )
    
#     try:
#         # Exchange code for token
#         token_result = azure_service.exchange_code_for_token(code)
#         access_token = token_result["access_token"]
        
#         # Get user information
#         user_info = azure_service.get_user_info(access_token)
        
#         # Create JWT token for your application
#         jwt_token = azure_service.create_jwt_token(user_info)
        
#         # Return success page with token (in production, you might redirect to frontend)
#         return HTMLResponse(content=f"""
#         <html>
#             <head><title>Login Successful</title></head>
#             <body>
#                 <h1>Login Successful!</h1>
#                 <p>Welcome, {user_info.get('displayName', 'User')}!</p>
#                 <p>Your JWT Token:</p>
#                 <textarea rows="10" cols="100">{jwt_token}</textarea>
#                 <script>
#                     // In a real app, you'd store this token securely
#                     localStorage.setItem('auth_token', '{jwt_token}');
#                 </script>
#             </body>
#         </html>
#         """)
        
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Authentication process failed: {str(e)}"
#         )

# @router.get("/me", response_model=UserInfo)
# async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
#     """
#     Get current authenticated user information
#     """
#     token = credentials.credentials
#     user_data = azure_service.verify_jwt_token(token)
    
#     return UserInfo(
#         id=user_data["sub"],
#         email=user_data["email"],
#         name=user_data["name"],
#         display_name=user_data["name"]
#     )

# @router.post("/logout")
# async def logout():
#     """
#     Logout endpoint (client should delete token)
#     """
#     return {"message": "Logged out successfully. Please delete your token on the client side."}

# # middleware/auth_middleware.py
# from fastapi import Request, HTTPException, status, Depends
# from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from services.azure_auth_service import AzureAuthService
# from typing import Optional

# security = HTTPBearer()
# azure_service = AzureAuthService()

# async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
#     """
#     Dependency to get current authenticated user
#     Use this in routes that require authentication
#     """
#     token = credentials.credentials
#     user_data = azure_service.verify_jwt_token(token)
#     return user_data

# # Optional: Create a dependency for specific roles/permissions
# async def require_admin(current_user = Depends(get_current_user)):
#     """
#     Dependency that requires admin role
#     """
#     # You can implement role checking logic here
#     # This is just an example - you'd need to store roles in your database
#     if not current_user.get("roles") or "admin" not in current_user.get("roles", []):
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Admin access required"
#         )
#     return current_user
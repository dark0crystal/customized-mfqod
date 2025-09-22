# import requests
# import msal
# from jose import jwt, JWTError
# from datetime import datetime, timedelta
# from config.azure_config import AzureADConfig
# from fastapi import HTTPException, status
# from typing import Optional, Dict, Any

# class AzureAuthService:
#     def __init__(self):
#         self.config = AzureADConfig()
#         self.app = msal.ConfidentialClientApplication(
#             client_id=self.config.CLIENT_ID,
#             client_credential=self.config.CLIENT_SECRET,
#             authority=self.config.AUTHORITY
#         )
    
#     def get_authorization_url(self, state: str = None) -> str:
#         """
#         Generate Azure AD authorization URL for user login
#         """
#         auth_url = self.app.get_authorization_request_url(
#             scopes=self.config.SCOPE,
#             redirect_uri=self.config.REDIRECT_URI,
#             state=state
#         )
#         return auth_url
    
#     def exchange_code_for_token(self, authorization_code: str) -> Dict[str, Any]:
#         """
#         Exchange authorization code for access token
#         """
#         try:
#             result = self.app.acquire_token_by_authorization_code(
#                 code=authorization_code,
#                 scopes=self.config.SCOPE,
#                 redirect_uri=self.config.REDIRECT_URI
#             )
            
#             if "error" in result:
#                 raise HTTPException(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     detail=f"Token exchange failed: {result.get('error_description', 'Unknown error')}"
#                 )
            
#             return result
#         except Exception as e:
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail=f"Token exchange error: {str(e)}"
#             )
    
#     def get_user_info(self, access_token: str) -> Dict[str, Any]:
#         """
#         Get user information from Microsoft Graph API
#         """
#         try:
#             headers = {
#                 'Authorization': f'Bearer {access_token}',
#                 'Content-Type': 'application/json'
#             }
            
#             response = requests.get(
#                 'https://graph.microsoft.com/v1.0/me',
#                 headers=headers
#             )
            
#             if response.status_code != 200:
#                 raise HTTPException(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     detail="Failed to fetch user information"
#                 )
            
#             return response.json()
#         except requests.RequestException as e:
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail=f"Error fetching user info: {str(e)}"
#             )
    
#     def create_jwt_token(self, user_data: Dict[str, Any]) -> str:
#         """
#         Create JWT token for the authenticated user
#         """
#         payload = {
#             "sub": user_data.get("id"),
#             "email": user_data.get("mail") or user_data.get("userPrincipalName"),
#             "name": user_data.get("displayName"),
#             "exp": datetime.utcnow() + timedelta(hours=24),
#             "iat": datetime.utcnow(),
#             "iss": "your-fastapi-app"
#         }
        
#         token = jwt.encode(payload, self.config.SECRET_KEY, algorithm="HS256")
#         return token
    
#     def verify_jwt_token(self, token: str) -> Dict[str, Any]:
#         """
#         Verify and decode JWT token
#         """
#         try:
#             payload = jwt.decode(token, self.config.SECRET_KEY, algorithms=["HS256"])
#             return payload
#         except JWTError:
#             raise HTTPException(
#                 status_code=status.HTTP_401_UNAUTHORIZED,
#                 detail="Invalid token",
#                 headers={"WWW-Authenticate": "Bearer"}
#             )

import os
from dotenv import load_dotenv

load_dotenv()

class AzureADConfig:
    CLIENT_ID = os.getenv("AZURE_CLIENT_ID")
    CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")
    TENANT_ID = os.getenv("AZURE_TENANT_ID")
    REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI")
    AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
    SCOPE = ["User.Read", "profile", "openid", "email"]
    SECRET_KEY = os.getenv("SECRET_KEY")
    
    # Azure AD endpoints
    DISCOVERY_URL = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid_configuration"
    TOKEN_URL = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    AUTHORIZATION_URL = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize"

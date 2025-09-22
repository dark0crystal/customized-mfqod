import os
from dotenv import load_dotenv
from typing import List

load_dotenv()

class LDAPConfig:
    # LDAP Server Configuration
    SERVER: str = os.getenv("LDAP_SERVER", "your-domain-controller.squ.edu.om")
    PORT: int = int(os.getenv("LDAP_PORT", "636"))  # 636 for LDAPS, 389 for LDAP
    USE_SSL: bool = os.getenv("LDAP_USE_SSL", "true").lower() == "true"
    
    # Base DN Configuration
    BASE_DN: str = os.getenv("LDAP_BASE_DN", "DC=squ,DC=edu,DC=om")
    USER_DN: str = os.getenv("LDAP_USER_DN", "OU=Users,DC=squ,DC=edu,DC=om")
    GROUP_DN: str = os.getenv("LDAP_GROUP_DN", "OU=Groups,DC=squ,DC=edu,DC=om")
    
    # Authentication Configuration
    BIND_USER: str = os.getenv("LDAP_BIND_USER", "CN=ServiceAccount,OU=Service Accounts,DC=squ,DC=edu,DC=om")
    BIND_PASSWORD: str = os.getenv("LDAP_BIND_PASSWORD", "your-service-account-password")
    
    # JWT Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-jwt-key-change-this-in-production")
    ALGORITHM: str = "HS256"
    
    # LDAP Search Configuration
    USER_SEARCH_FILTER: str = "(sAMAccountName={username})"
    USER_ATTRIBUTES: List[str] = [
        'sAMAccountName',
        'displayName',
        'givenName',
        'sn',
        'mail',
        'userPrincipalName',
        'memberOf',
        'accountExpires',
        'userAccountControl',
        'lastLogon',
        'employeeID',
        'department'
    ]
    
    # Connection Settings
    CONNECTION_TIMEOUT: int = int(os.getenv("LDAP_CONNECTION_TIMEOUT", "30"))
    SEARCH_TIMEOUT: int = int(os.getenv("LDAP_SEARCH_TIMEOUT", "60"))
    
    # Sync Configuration
    SYNC_INTERVAL_HOURS: int = int(os.getenv("LDAP_SYNC_INTERVAL_HOURS", "24"))
    SYNC_BATCH_SIZE: int = int(os.getenv("LDAP_SYNC_BATCH_SIZE", "100"))
    ENABLE_AUTO_SYNC: bool = os.getenv("LDAP_ENABLE_AUTO_SYNC", "true").lower() == "true"
    
    # Status Verification
    CHECK_ACCOUNT_STATUS: bool = True
    DEACTIVATE_EXPIRED_ACCOUNTS: bool = True
    DEACTIVATE_DISABLED_ACCOUNTS: bool = True
    
    # Group to Role Mapping
    ROLE_MAPPING: dict = {
        'Domain Admins': 'admin',
        'Administrators': 'admin',
        'IT Staff': 'staff',
        'Faculty': 'staff',
        'Students': 'student',
        'Alumni': 'external',
        'Guests': 'external'
    }
    
    # Default roles for new users
    DEFAULT_INTERNAL_ROLE: str = "student"
    DEFAULT_EXTERNAL_ROLE: str = "external"

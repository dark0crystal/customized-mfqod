import os
from datetime import timedelta
from typing import Optional

class AuthConfig:
    # JWT Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7 days
    
    # Password Security
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBERS: bool = True
    PASSWORD_REQUIRE_SPECIAL_CHARS: bool = True
    BCRYPT_ROUNDS: int = 12
    
    # Account Security
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    LOCKOUT_DURATION_MINUTES: int = int(os.getenv("LOCKOUT_DURATION_MINUTES", "30"))
    LOCKOUT_INCREMENT_FACTOR: float = 1.5  # Increase lockout time after repeated failures
    
    # Rate Limiting
    LOGIN_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "5"))
    API_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "60"))
    
    # Session Management
    SESSION_CLEANUP_INTERVAL_HOURS: int = 24
    MAX_SESSIONS_PER_USER: int = 3
    
    # External User Registration
    ALLOW_EXTERNAL_REGISTRATION: bool = os.getenv("ALLOW_EXTERNAL_REGISTRATION", "true").lower() == "true"
    REQUIRE_EMAIL_VERIFICATION: bool = os.getenv("REQUIRE_EMAIL_VERIFICATION", "true").lower() == "true"
    
    # Security Headers
    ENABLE_CORS: bool = True
    CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Logging
    ENABLE_AUDIT_LOGGING: bool = True
    LOG_FAILED_ATTEMPTS: bool = True
    LOG_SUCCESSFUL_LOGINS: bool = True
    
    @classmethod
    def get_lockout_duration(cls, attempt_count: int) -> timedelta:
        """Calculate lockout duration based on attempt count with exponential backoff"""
        base_minutes = cls.LOCKOUT_DURATION_MINUTES
        multiplier = cls.LOCKOUT_INCREMENT_FACTOR ** (attempt_count - cls.MAX_LOGIN_ATTEMPTS)
        minutes = min(base_minutes * multiplier, 24 * 60)  # Max 24 hours
        return timedelta(minutes=minutes)

class ADConfig:
    # Active Directory Configuration
    SERVER: str = os.getenv("AD_SERVER", "your-domain-controller.example.com")
    PORT: int = int(os.getenv("AD_PORT", "636"))  # 636 for LDAPS, 389 for LDAP
    USE_SSL: bool = os.getenv("AD_USE_SSL", "true").lower() == "true"
    
    # Service Account for LDAP binding
    BIND_USER: str = os.getenv("AD_BIND_USER", "CN=ServiceAccount,OU=Service Accounts,DC=example,DC=com")
    BIND_PASSWORD: str = os.getenv("AD_BIND_PASSWORD", "service-account-password")
    
    # Search Configuration
    USER_DN: str = os.getenv("AD_USER_DN", "OU=Users,DC=example,DC=com")
    GROUP_DN: str = os.getenv("AD_GROUP_DN", "OU=Groups,DC=example,DC=com")
    USER_SEARCH_FILTER: str = os.getenv("AD_USER_SEARCH_FILTER", "(sAMAccountName={username})")
    USER_ATTRIBUTES: list = [
        "sAMAccountName", "displayName", "givenName", "sn", 
        "mail", "userPrincipalName", "memberOf", "accountExpires",
        "userAccountControl", "lastLogon", "employeeID", "department"
    ]
    
    # Sync Configuration
    SYNC_INTERVAL_HOURS: int = int(os.getenv("AD_SYNC_INTERVAL_HOURS", "24"))
    SYNC_BATCH_SIZE: int = int(os.getenv("AD_SYNC_BATCH_SIZE", "100"))
    ENABLE_AUTO_SYNC: bool = os.getenv("AD_ENABLE_AUTO_SYNC", "true").lower() == "true"
    
    # Connection Settings
    CONNECTION_TIMEOUT: int = int(os.getenv("AD_CONNECTION_TIMEOUT", "30"))
    SEARCH_TIMEOUT: int = int(os.getenv("AD_SEARCH_TIMEOUT", "60"))
    
    # Status Verification
    CHECK_ACCOUNT_STATUS: bool = True
    DEACTIVATE_EXPIRED_ACCOUNTS: bool = True
    DEACTIVATE_DISABLED_ACCOUNTS: bool = True
    
    # Group Mapping
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
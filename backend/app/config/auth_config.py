import os
from datetime import timedelta
from typing import Optional

class AuthConfig:
    # JWT Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))  # 7 days
    
    # Password Security - Simplified to only require 8+ characters
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = False
    PASSWORD_REQUIRE_LOWERCASE: bool = False
    PASSWORD_REQUIRE_NUMBERS: bool = False
    PASSWORD_REQUIRE_SPECIAL_CHARS: bool = False
    BCRYPT_ROUNDS: int = 12
    
    # Account Security
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    LOCKOUT_DURATION_MINUTES: int = int(os.getenv("LOCKOUT_DURATION_MINUTES", "30"))
    LOCKOUT_INCREMENT_FACTOR: float = 1.5  # Increase lockout time after repeated failures
    
    # Rate Limiting
    LOGIN_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "5"))
    API_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "60"))
    
    # General API Rate Limiting Configuration
    ENABLE_GLOBAL_RATE_LIMIT: bool = os.getenv("ENABLE_GLOBAL_RATE_LIMIT", "true").lower() == "true"
    PUBLIC_API_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("PUBLIC_API_RATE_LIMIT_PER_MINUTE", "30"))
    AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE", "60"))
    RATE_LIMIT_WINDOW_MINUTES: int = int(os.getenv("RATE_LIMIT_WINDOW_MINUTES", "1"))
    
    # Excluded paths from rate limiting (health checks, docs, etc.)
    RATE_LIMIT_EXCLUDED_PATHS: list = [
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/api/health",
        "/static",
        "/favicon.ico"
    ]
    
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
    """
    Active Directory Configuration following RFC 2251 and RFC 2253 standards
    This configuration supports standard LDAP authentication with SQU-specific defaults
    """
    
    # LDAP Server Configuration (RFC 2251 compliant) - SQU specific
    SERVER: str = os.getenv("AD_SERVER", "ldap.squ.edu.om")
    PORT: int = int(os.getenv("AD_PORT", "636"))  # 636 for LDAPS, 389 for LDAP
    USE_SSL: bool = os.getenv("AD_USE_SSL", "true").lower() == "true"
    USE_TLS: bool = os.getenv("AD_USE_TLS", "false").lower() == "true"
    
    # Base DN Configuration (RFC 2253 compliant) - SQU specific
    BASE_DN: str = os.getenv("AD_BASE_DN", "DC=squ,DC=edu,DC=om")
    USER_DN: str = os.getenv("AD_USER_DN", "OU=Users,DC=squ,DC=edu,DC=om")
    GROUP_DN: str = os.getenv("AD_GROUP_DN", "OU=Groups,DC=squ,DC=edu,DC=om")
    
    # Service Account for LDAP Binding (RFC 2251 compliant) - SQU specific
    BIND_USER: str = os.getenv("AD_BIND_USER", "CN=ServiceAccount,OU=Service Accounts,DC=squ,DC=edu,DC=om")
    BIND_PASSWORD: str = os.getenv("AD_BIND_PASSWORD", "service-account-password")
    
    # JWT Configuration for Application Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret-jwt-key")
    ALGORITHM: str = "HS256"
    TOKEN_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "8"))
    
    # LDAP Search Configuration (RFC 2254 compliant filters)
    USER_SEARCH_FILTER: str = os.getenv("AD_USER_SEARCH_FILTER", "(&(objectClass=person)(sAMAccountName={username}))")
    GROUP_SEARCH_FILTER: str = os.getenv("AD_GROUP_SEARCH_FILTER", "(objectClass=group)")
    
    # Standard LDAP Attributes (RFC 2256 compliant)
    USER_ATTRIBUTES: list = [
        'sAMAccountName',      # Windows-specific but commonly used
        'uid',                 # Standard LDAP attribute
        'cn',                  # Common Name (RFC 2256)
        'displayName',         # Display Name
        'givenName',           # First Name (RFC 2256)
        'sn',                  # Surname (RFC 2256)
        'mail',                # Email Address (RFC 2256)
        'userPrincipalName',   # UPN (Windows-specific)
        'memberOf',            # Group membership
        'accountExpires',      # Account expiration
        'userAccountControl',  # Account control flags
        'lastLogon',           # Last logon timestamp
        'employeeID',          # Employee ID
        'department',          # Department
        'title',               # Job title
        'telephoneNumber',     # Phone number
        'objectClass'          # Object classes
    ]
    
    # Connection Settings (RFC 2251 compliant)
    CONNECTION_TIMEOUT: int = int(os.getenv("AD_CONNECTION_TIMEOUT", "30"))
    SEARCH_TIMEOUT: int = int(os.getenv("AD_SEARCH_TIMEOUT", "60"))
    MAX_CONNECTIONS: int = int(os.getenv("AD_MAX_CONNECTIONS", "10"))
    
    # SSL/TLS Configuration
    SSL_CERT_FILE: str = os.getenv("AD_SSL_CERT_FILE", "")
    SSL_KEY_FILE: str = os.getenv("AD_SSL_KEY_FILE", "")
    SSL_CA_FILE: str = os.getenv("AD_SSL_CA_FILE", "")
    VERIFY_SSL: bool = os.getenv("AD_VERIFY_SSL", "true").lower() == "true"
    
    # Sync Configuration
    SYNC_INTERVAL_HOURS: int = int(os.getenv("AD_SYNC_INTERVAL_HOURS", "24"))
    SYNC_BATCH_SIZE: int = int(os.getenv("AD_SYNC_BATCH_SIZE", "100"))
    ENABLE_AUTO_SYNC: bool = os.getenv("AD_ENABLE_AUTO_SYNC", "true").lower() == "true"
    
    # Account Status Verification
    CHECK_ACCOUNT_STATUS: bool = os.getenv("AD_CHECK_ACCOUNT_STATUS", "true").lower() == "true"
    DEACTIVATE_EXPIRED_ACCOUNTS: bool = os.getenv("AD_DEACTIVATE_EXPIRED_ACCOUNTS", "true").lower() == "true"
    DEACTIVATE_DISABLED_ACCOUNTS: bool = os.getenv("AD_DEACTIVATE_DISABLED_ACCOUNTS", "true").lower() == "true"
    
    # Note: Role mapping removed - roles are managed directly in the database
    # The application will assign roles based on database configuration, not AD groups
    
    # Default roles for new users
    DEFAULT_INTERNAL_ROLE: str = os.getenv("AD_DEFAULT_INTERNAL_ROLE", "student")
    DEFAULT_EXTERNAL_ROLE: str = os.getenv("AD_DEFAULT_EXTERNAL_ROLE", "external")
    
    # LDAP Protocol Version (RFC 2251)
    PROTOCOL_VERSION: int = 3
    
    # Referral Handling (RFC 2251)
    FOLLOW_REFERRALS: bool = os.getenv("AD_FOLLOW_REFERRALS", "false").lower() == "true"
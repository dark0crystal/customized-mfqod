import os
from datetime import timedelta
from typing import Optional, List


def _env(key: str) -> Optional[str]:
    """Get optional string from environment."""
    return os.getenv(key)


def _env_required(key: str) -> str:
    """Get required string from environment; raises if missing."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Required environment variable {key} is not set")
    return v


def _env_int(key: str) -> Optional[int]:
    """Get optional int from environment."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return int(v)


def _env_required_int(key: str) -> int:
    """Get required int from environment; raises if missing or invalid."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Required environment variable {key} is not set")
    return int(v)


def _env_float(key: str) -> Optional[float]:
    """Get optional float from environment."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return float(v)


def _env_required_float(key: str) -> float:
    """Get required float from environment; raises if missing or invalid."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Required environment variable {key} is not set")
    return float(v)


def _env_bool(key: str) -> Optional[bool]:
    """Get optional bool from environment (true/1/yes => True, false/0/no => False)."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return v.lower() in ("true", "1", "yes")


def _env_required_bool(key: str) -> bool:
    """Get required bool from environment; raises if missing."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Required environment variable {key} is not set")
    return v.lower() in ("true", "1", "yes")


def _env_list(key: str, separator: str = ",") -> List[str]:
    """Get list from environment as comma-separated string; returns empty list if unset."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return []
    return [s.strip() for s in v.split(separator) if s.strip()]


def _env_required_list(key: str, separator: str = ",") -> List[str]:
    """Get required list from environment; raises if missing or empty."""
    v = os.getenv(key)
    if v is None or v.strip() == "":
        raise RuntimeError(f"Required environment variable {key} is not set")
    items = [s.strip() for s in v.split(separator) if s.strip()]
    if not items:
        raise RuntimeError(f"Required environment variable {key} must not be empty")
    return items


class AuthConfig:
    # JWT Configuration
    SECRET_KEY: str = _env_required("SECRET_KEY")
    JWT_ALGORITHM: str = _env_required("JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _env_required_int("ACCESS_TOKEN_EXPIRE_MINUTES")
    REFRESH_TOKEN_EXPIRE_DAYS: int = _env_required_int("REFRESH_TOKEN_EXPIRE_DAYS")

    # Password Security
    PASSWORD_MIN_LENGTH: int = _env_required_int("PASSWORD_MIN_LENGTH")
    PASSWORD_REQUIRE_UPPERCASE: bool = _env_required_bool("PASSWORD_REQUIRE_UPPERCASE")
    PASSWORD_REQUIRE_LOWERCASE: bool = _env_required_bool("PASSWORD_REQUIRE_LOWERCASE")
    PASSWORD_REQUIRE_NUMBERS: bool = _env_required_bool("PASSWORD_REQUIRE_NUMBERS")
    PASSWORD_REQUIRE_SPECIAL_CHARS: bool = _env_required_bool("PASSWORD_REQUIRE_SPECIAL_CHARS")
    BCRYPT_ROUNDS: int = _env_required_int("BCRYPT_ROUNDS")

    # Account Security
    MAX_LOGIN_ATTEMPTS: int = _env_required_int("MAX_LOGIN_ATTEMPTS")
    LOCKOUT_DURATION_MINUTES: int = _env_required_int("LOCKOUT_DURATION_MINUTES")
    LOCKOUT_INCREMENT_FACTOR: float = _env_required_float("LOCKOUT_INCREMENT_FACTOR")

    # Rate Limiting
    LOGIN_RATE_LIMIT_PER_MINUTE: int = _env_required_int("LOGIN_RATE_LIMIT_PER_MINUTE")
    API_RATE_LIMIT_PER_MINUTE: int = _env_required_int("API_RATE_LIMIT_PER_MINUTE")
    ENABLE_GLOBAL_RATE_LIMIT: bool = _env_required_bool("ENABLE_GLOBAL_RATE_LIMIT")
    PUBLIC_API_RATE_LIMIT_PER_MINUTE: int = _env_required_int("PUBLIC_API_RATE_LIMIT_PER_MINUTE")
    AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE: int = _env_required_int("AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE")
    RATE_LIMIT_WINDOW_MINUTES: int = _env_required_int("RATE_LIMIT_WINDOW_MINUTES")
    RATE_LIMIT_EXCLUDED_PATHS: List[str] = _env_required_list("RATE_LIMIT_EXCLUDED_PATHS")

    # Session Management
    SESSION_CLEANUP_INTERVAL_HOURS: int = _env_required_int("SESSION_CLEANUP_INTERVAL_HOURS")
    MAX_SESSIONS_PER_USER: int = _env_required_int("MAX_SESSIONS_PER_USER")

    # External User Registration
    ALLOW_EXTERNAL_REGISTRATION: bool = _env_required_bool("ALLOW_EXTERNAL_REGISTRATION")
    REQUIRE_EMAIL_VERIFICATION: bool = _env_required_bool("REQUIRE_EMAIL_VERIFICATION")

    # Password Reset
    FRONTEND_BASE_URL: str = _env_required("FRONTEND_BASE_URL")
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = _env_required_int("PASSWORD_RESET_TOKEN_EXPIRE_HOURS")

    # Security Headers
    ENABLE_CORS: bool = _env_required_bool("ENABLE_CORS")
    CORS_ORIGINS: List[str] = _env_required_list("CORS_ORIGINS")

    # Logging
    ENABLE_AUDIT_LOGGING: bool = _env_required_bool("ENABLE_AUDIT_LOGGING")
    LOG_FAILED_ATTEMPTS: bool = _env_required_bool("LOG_FAILED_ATTEMPTS")
    LOG_SUCCESSFUL_LOGINS: bool = _env_required_bool("LOG_SUCCESSFUL_LOGINS")

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
    This configuration supports standard LDAP authentication
    """

    # LDAP Server Configuration (RFC 2251 compliant)
    SERVER: str = _env_required("AD_SERVER")
    PORT: int = _env_required_int("AD_PORT")
    USE_SSL: bool = _env_required_bool("AD_USE_SSL")
    USE_TLS: bool = _env_required_bool("AD_USE_TLS")

    # Base DN Configuration (RFC 2253 compliant)
    BASE_DN: str = _env_required("AD_BASE_DN")
    USER_DN: str = _env_required("AD_USER_DN")
    GROUP_DN: str = _env_required("AD_GROUP_DN")

    # Service Account for LDAP Binding (RFC 2251 compliant)
    BIND_USER: str = _env_required("AD_BIND_USER")
    BIND_PASSWORD: str = _env_required("AD_BIND_PASSWORD")

    # JWT Configuration for Application Tokens
    SECRET_KEY: str = _env_required("SECRET_KEY")
    ALGORITHM: str = _env_required("JWT_ALGORITHM")
    TOKEN_EXPIRY_HOURS: int = _env_required_int("JWT_EXPIRY_HOURS")

    # LDAP Search Configuration (RFC 2254 compliant filters)
    USER_SEARCH_FILTER: str = _env_required("AD_USER_SEARCH_FILTER")
    GROUP_SEARCH_FILTER: str = _env_required("AD_GROUP_SEARCH_FILTER")

    # Standard LDAP Attributes (RFC 2256 compliant) - comma-separated in AD_USER_ATTRIBUTES
    USER_ATTRIBUTES: List[str] = _env_required_list("AD_USER_ATTRIBUTES")

    # Connection Settings (RFC 2251 compliant)
    CONNECTION_TIMEOUT: int = _env_required_int("AD_CONNECTION_TIMEOUT")
    SEARCH_TIMEOUT: int = _env_required_int("AD_SEARCH_TIMEOUT")
    MAX_CONNECTIONS: int = _env_required_int("AD_MAX_CONNECTIONS")

    # SSL/TLS Configuration (optional; set in env if using client certs)
    SSL_CERT_FILE: Optional[str] = _env("AD_SSL_CERT_FILE")
    SSL_KEY_FILE: Optional[str] = _env("AD_SSL_KEY_FILE")
    SSL_CA_FILE: Optional[str] = _env("AD_SSL_CA_FILE")
    VERIFY_SSL: bool = _env_required_bool("AD_VERIFY_SSL")

    # Sync Configuration
    SYNC_INTERVAL_HOURS: int = _env_required_int("AD_SYNC_INTERVAL_HOURS")
    SYNC_BATCH_SIZE: int = _env_required_int("AD_SYNC_BATCH_SIZE")
    ENABLE_AUTO_SYNC: bool = _env_required_bool("AD_ENABLE_AUTO_SYNC")

    # Account Status Verification
    CHECK_ACCOUNT_STATUS: bool = _env_required_bool("AD_CHECK_ACCOUNT_STATUS")
    DEACTIVATE_EXPIRED_ACCOUNTS: bool = _env_required_bool("AD_DEACTIVATE_EXPIRED_ACCOUNTS")
    DEACTIVATE_DISABLED_ACCOUNTS: bool = _env_required_bool("AD_DEACTIVATE_DISABLED_ACCOUNTS")

    # Default roles for new users
    DEFAULT_INTERNAL_ROLE: str = _env_required("AD_DEFAULT_INTERNAL_ROLE")
    DEFAULT_EXTERNAL_ROLE: str = _env_required("AD_DEFAULT_EXTERNAL_ROLE")

    # LDAP Protocol Version (RFC 2251), typically 3
    PROTOCOL_VERSION: int = _env_required_int("AD_PROTOCOL_VERSION")

    # Referral Handling (RFC 2251)
    FOLLOW_REFERRALS: bool = _env_required_bool("AD_FOLLOW_REFERRALS")

"""
Email Configuration Module

All variables are read from the environment only (no defaults in code),
except FRONTEND_BASE_URL which keeps a default for local development.
"""
import os
from typing import Optional


def _env(key: str) -> Optional[str]:
    return os.getenv(key)


def _env_int(key: str) -> Optional[int]:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return int(v)


def _env_bool(key: str) -> Optional[bool]:
    v = os.getenv(key)
    if v is None or v.strip() == "":
        return None
    return v.lower() in ("true", "1", "yes")


class EmailSettings:
    """Email configuration settings (from env only, except FRONTEND_BASE_URL)."""

    def __init__(self):
        # SMTP Server Configuration (env only)
        self.SMTP_HOST: Optional[str] = _env("SMTP_HOST")
        self.SMTP_PORT: Optional[int] = _env_int("SMTP_PORT")
        self.SMTP_USERNAME: Optional[str] = _env("SMTP_USERNAME")
        self.SMTP_PASSWORD: Optional[str] = _env("SMTP_PASSWORD")

        # Email Settings (env only)
        self.MAIL_FROM: Optional[str] = _env("MAIL_FROM")
        self.MAIL_FROM_NAME: Optional[str] = _env("MAIL_FROM_NAME")

        # Security (env only)
        self.SMTP_TLS: Optional[bool] = _env_bool("SMTP_TLS")
        self.SMTP_SSL: Optional[bool] = _env_bool("SMTP_SSL")

        # Templates (env only)
        self.TEMPLATE_DIR: Optional[str] = _env("EMAIL_TEMPLATE_DIR")

        # Frontend URL for generating links in emails (kept with default)
        self.FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

        # Feature flags (env only)
        self.EMAIL_ENABLED: Optional[bool] = _env_bool("EMAIL_ENABLED")


# Global email settings instance
email_settings = EmailSettings()
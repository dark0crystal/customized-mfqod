"""
Email Configuration Module
"""
import os
from typing import Optional


class EmailSettings:
    """Email configuration settings"""
    
    def __init__(self):
        # SMTP Server Configuration
        self.SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
        self.SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
        self.SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
        
        # Email Settings
        self.MAIL_FROM: str = os.getenv("MAIL_FROM", "noreply@university.edu")
        self.MAIL_FROM_NAME: str = os.getenv("MAIL_FROM_NAME", "University Lost & Found System")
        
        # Security
        self.SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() == "true"
        self.SMTP_SSL: bool = os.getenv("SMTP_SSL", "false").lower() == "true"
        
        # Templates
        self.TEMPLATE_DIR: str = os.getenv("EMAIL_TEMPLATE_DIR", "app/templates/email")
        
        # Feature flags
        self.EMAIL_ENABLED: bool = os.getenv("EMAIL_ENABLED", "true").lower() == "true"


# Global email settings instance
email_settings = EmailSettings()
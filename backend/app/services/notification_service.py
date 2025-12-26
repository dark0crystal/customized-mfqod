"""
Email Notification Service

A general-purpose email notification service that can be used across different scenarios.
Supports templated emails, multiple recipients, and various notification types.
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import ssl
import certifi

# Optional imports for email functionality
try:
    import aiosmtplib
    from jinja2 import Environment, FileSystemLoader, Template
    EMAIL_DEPENDENCIES_AVAILABLE = True
except ImportError:
    EMAIL_DEPENDENCIES_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Email dependencies not available. Install 'aiosmtplib' and 'jinja2' to enable email notifications.")

from app.config.email_config import email_settings


logger = logging.getLogger(__name__)


class NotificationType(Enum):
    """Notification types for different scenarios"""
    WELCOME = "welcome"
    ITEM_FOUND = "item_found"
    ITEM_CLAIMED = "item_claimed"
    ACCOUNT_ACTIVATION = "account_activation"
    PASSWORD_RESET = "password_reset"
    ITEM_APPROVAL = "item_approval"
    ITEM_REJECTION = "item_rejection"
    SYSTEM_ALERT = "system_alert"
    REMINDER = "reminder"
    USER_SUSPENSION = "user_suspension"
    USER_REACTIVATION = "user_reactivation"
    CLAIM_STATUS_UPDATE = "claim_status_update"
    NEW_CLAIM_ALERT = "new_claim_alert"
    NEW_ITEM_ALERT = "new_item_alert"
    NEW_MISSING_ITEM_ALERT = "new_missing_item_alert"
    EMAIL_VERIFICATION = "email_verification"


class EmailNotificationService:
    """
    General-purpose email notification service
    """
    
    def __init__(self):
        self.smtp_host = email_settings.SMTP_HOST
        self.smtp_port = email_settings.SMTP_PORT
        self.smtp_username = email_settings.SMTP_USERNAME
        self.smtp_password = email_settings.SMTP_PASSWORD
        self.mail_from = email_settings.MAIL_FROM
        self.mail_from_name = email_settings.MAIL_FROM_NAME
        self.smtp_tls = email_settings.SMTP_TLS
        self.smtp_ssl = email_settings.SMTP_SSL
        self.template_dir = email_settings.TEMPLATE_DIR
        self.email_enabled = email_settings.EMAIL_ENABLED and EMAIL_DEPENDENCIES_AVAILABLE
        
        # Initialize Jinja2 environment for templates
        self.jinja_env = None
        if EMAIL_DEPENDENCIES_AVAILABLE:
            self._setup_template_environment()
        else:
            logger.warning("Email functionality disabled: missing dependencies")
    
    def _setup_template_environment(self):
        """Setup Jinja2 template environment"""
        if not EMAIL_DEPENDENCIES_AVAILABLE:
            return
            
        try:
            if os.path.exists(self.template_dir):
                self.jinja_env = Environment(
                    loader=FileSystemLoader(self.template_dir),
                    autoescape=True
                )
                logger.info(f"Email templates loaded from: {self.template_dir}")
            else:
                logger.warning(f"Template directory not found: {self.template_dir}")
                # Create basic template environment for fallback
                self.jinja_env = Environment()
        except Exception as e:
            logger.error(f"Failed to setup template environment: {e}")
            self.jinja_env = Environment()
    
    async def send_email(
        self,
        to_email: str | List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Send email with HTML and optional text content
        
        Args:
            to_email: Recipient email(s)
            subject: Email subject
            html_content: HTML email content
            text_content: Plain text email content (optional)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
            attachments: List of attachments (optional)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.email_enabled:
            logger.info("Email notifications are disabled")
            return False
        
        if not EMAIL_DEPENDENCIES_AVAILABLE:
            logger.error("Email dependencies not available")
            return False
        
        if not self.smtp_username or not self.smtp_password:
            logger.error("SMTP credentials not configured")
            return False
        
        try:
            # Convert single email to list
            if isinstance(to_email, str):
                to_email = [to_email]
            
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.mail_from_name} <{self.mail_from}>"
            message["To"] = ", ".join(to_email)
            
            if cc:
                message["Cc"] = ", ".join(cc)
            
            # Add text content
            if text_content:
                text_part = MIMEText(text_content, "plain")
                message.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)
            
            # Prepare recipient list
            recipients = to_email.copy()
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            # Send email
            await self._send_smtp_email(message, recipients)
            
            logger.info(f"Email sent successfully to: {', '.join(to_email)}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    async def _send_smtp_email(self, message: MIMEMultipart, recipients: List[str]):
        """Send email via SMTP"""
        # For port 465, use SSL from the start (use_tls=True)
        # For port 587, connect plain then use STARTTLS (use_tls=False, then starttls())
        use_tls_from_start = self.smtp_ssl or (self.smtp_port == 465)
        
        # Create SSL context with certifi certificates
        try:
            ssl_context = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            # Fallback to default context if certifi fails
            ssl_context = ssl.create_default_context()
        
        smtp_client = aiosmtplib.SMTP(
            hostname=self.smtp_host,
            port=self.smtp_port,
            use_tls=use_tls_from_start,
            tls_context=ssl_context if use_tls_from_start else None,
            start_tls=False  # Handle STARTTLS manually
        )
        
        try:
            await smtp_client.connect()
            
            # For port 587 with STARTTLS, upgrade connection after connecting
            if self.smtp_tls and not use_tls_from_start:
                await smtp_client.starttls(tls_context=ssl_context)
            
            if self.smtp_username and self.smtp_password:
                await smtp_client.login(self.smtp_username, self.smtp_password)
            
            await smtp_client.send_message(
                message,
                sender=self.mail_from,
                recipients=recipients
            )
            
        finally:
            await smtp_client.quit()
    
    async def send_templated_email(
        self,
        to_email: str | List[str],
        notification_type: NotificationType,
        template_data: Dict[str, Any],
        subject_override: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> bool:
        """
        Send email using predefined templates
        
        Args:
            to_email: Recipient email(s)
            notification_type: Type of notification
            template_data: Data to populate template
            subject_override: Custom subject (optional)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            # Get template content
            template_content = await self._get_template_content(
                notification_type, 
                template_data
            )
            
            if not template_content:
                logger.error(f"Failed to get template content for {notification_type}")
                return False
            
            subject = subject_override or template_content.get("subject", "Notification")
            html_content = template_content.get("html", "")
            text_content = template_content.get("text")
            
            return await self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                cc=cc,
                bcc=bcc
            )
            
        except Exception as e:
            logger.error(f"Failed to send templated email: {e}")
            return False
    
    async def _get_template_content(
        self, 
        notification_type: NotificationType, 
        template_data: Dict[str, Any]
    ) -> Optional[Dict[str, str]]:
        """Get rendered template content"""
        try:
            # Add common template variables
            template_data.update({
                "current_year": datetime.now().year,
                "system_name": "University Lost & Found System",
                "support_email": self.mail_from,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            # Try to load template files
            template_name = notification_type.value
            
            # Load HTML template
            html_content = await self._render_template(f"{template_name}.html", template_data)
            
            # Load text template (optional)
            text_content = await self._render_template(f"{template_name}.txt", template_data)
            
            # Load subject template or use default
            subject = await self._render_template(f"{template_name}_subject.txt", template_data)
            if not subject:
                subject = self._get_default_subject(notification_type, template_data)
            
            return {
                "html": html_content or self._get_fallback_html(notification_type, template_data),
                "text": text_content,
                "subject": subject
            }
            
        except Exception as e:
            logger.error(f"Failed to get template content: {e}")
            return None
    
    async def _render_template(self, template_name: str, data: Dict[str, Any]) -> Optional[str]:
        """Render a template with given data"""
        try:
            if self.jinja_env:
                template = self.jinja_env.get_template(template_name)
                return template.render(**data)
        except Exception as e:
            logger.debug(f"Template {template_name} not found or failed to render: {e}")
        
        return None
    
    def _get_default_subject(self, notification_type: NotificationType, data: Dict[str, Any]) -> str:
        """Get default subject for notification type"""
        subject_map = {
            NotificationType.WELCOME: "Welcome to University Lost & Found System",
            NotificationType.ITEM_FOUND: "New Lost Item Match Found",
            NotificationType.ITEM_CLAIMED: "Item Claim Notification",
            NotificationType.ACCOUNT_ACTIVATION: "Account Activation Required",
            NotificationType.PASSWORD_RESET: "Password Reset Request",
            NotificationType.ITEM_APPROVAL: "Item Listing Approved",
            NotificationType.ITEM_REJECTION: "Item Listing Requires Review",
            NotificationType.SYSTEM_ALERT: "System Alert Notification",
            NotificationType.REMINDER: "Reminder Notification",
            NotificationType.USER_SUSPENSION: "Account Suspension Notice",
            NotificationType.USER_REACTIVATION: "Account Reactivated",
            NotificationType.CLAIM_STATUS_UPDATE: "Claim Status Update",
            NotificationType.NEW_CLAIM_ALERT: "New Claim Submitted - Moderator Action Required",
            NotificationType.NEW_ITEM_ALERT: "New Item Posted - Moderator Review Required",
            NotificationType.NEW_MISSING_ITEM_ALERT: "New Missing Item Reported - Admin Review Required",
            NotificationType.EMAIL_VERIFICATION: "Verify Your Email Address - University Lost & Found System"
        }
        
        return subject_map.get(notification_type, "University Lost & Found Notification")
    
    def _get_fallback_html(self, notification_type: NotificationType, data: Dict[str, Any]) -> str:
        """Generate fallback HTML content when template is not available"""
        system_name = data.get("system_name", "University Lost & Found System")
        user_name = data.get("user_name", "")
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{self._get_default_subject(notification_type, data)}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #cccccc; }}
                .header {{ padding: 20px; text-align: center; border-bottom: 1px solid #cccccc; }}
                .content {{ padding: 20px; }}
                .footer {{ padding: 15px; text-align: center; font-size: 12px; border-top: 1px solid #cccccc; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>{system_name}</h2>
                </div>
                <div class="content">
                    <p>Hello{f" {user_name}" if user_name else ""},</p>
                    <p>{self._get_fallback_message(notification_type, data)}</p>
                    <p>If you have any questions, please contact our support team.</p>
                </div>
                <div class="footer">
                    <p>&copy; {data.get("current_year", 2024)} {system_name}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html
    
    def _get_fallback_message(self, notification_type: NotificationType, data: Dict[str, Any]) -> str:
        """Get fallback message for notification type"""
        message_map = {
            NotificationType.WELCOME: "Welcome to our system! Your account has been created successfully.",
            NotificationType.ITEM_FOUND: "We found a potential match for your lost item.",
            NotificationType.ITEM_CLAIMED: "An item has been claimed from our system.",
            NotificationType.ACCOUNT_ACTIVATION: "Please activate your account to continue.",
            NotificationType.PASSWORD_RESET: "You have requested a password reset.",
            NotificationType.ITEM_APPROVAL: "Your item listing has been approved and is now visible.",
            NotificationType.ITEM_REJECTION: "Your item listing requires additional review.",
            NotificationType.SYSTEM_ALERT: "This is a system notification.",
            NotificationType.REMINDER: "This is a reminder notification.",
            NotificationType.USER_SUSPENSION: "Your account has been temporarily suspended.",
            NotificationType.USER_REACTIVATION: "Your account has been reactivated.",
            NotificationType.CLAIM_STATUS_UPDATE: "Your claim status has been updated by a moderator.",
            NotificationType.NEW_CLAIM_ALERT: "A new claim has been submitted and requires your review.",
            NotificationType.NEW_ITEM_ALERT: "A new item has been posted and requires your review.",
            NotificationType.NEW_MISSING_ITEM_ALERT: "A new missing item has been reported and requires your review.",
            NotificationType.EMAIL_VERIFICATION: f"Your email verification code is {data.get('otp_code', 'N/A')}. This code will expire in 10 minutes."
        }
        
        return message_map.get(notification_type, "You have received a notification from our system.")
    
    async def send_bulk_notification(
        self,
        recipients: List[str],
        notification_type: NotificationType,
        template_data: Dict[str, Any],
        subject_override: Optional[str] = None,
        batch_size: int = 50
    ) -> Dict[str, Any]:
        """
        Send bulk notifications with rate limiting
        
        Args:
            recipients: List of recipient emails
            notification_type: Type of notification
            template_data: Template data
            subject_override: Custom subject
            batch_size: Number of emails per batch
            
        Returns:
            Dict with success/failure counts
        """
        if not recipients:
            return {"success": 0, "failed": 0, "total": 0}
        
        success_count = 0
        failed_count = 0
        
        # Process in batches
        for i in range(0, len(recipients), batch_size):
            batch = recipients[i:i + batch_size]
            
            # Send emails in batch concurrently
            tasks = []
            for email in batch:
                task = self.send_templated_email(
                    to_email=email,
                    notification_type=notification_type,
                    template_data=template_data,
                    subject_override=subject_override
                )
                tasks.append(task)
            
            # Wait for batch to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Count results
            for result in results:
                if isinstance(result, Exception):
                    failed_count += 1
                elif result:
                    success_count += 1
                else:
                    failed_count += 1
            
            # Rate limiting - wait between batches
            if i + batch_size < len(recipients):
                await asyncio.sleep(1)
        
        logger.info(f"Bulk notification complete: {success_count} sent, {failed_count} failed")
        
        return {
            "success": success_count,
            "failed": failed_count,
            "total": len(recipients)
        }


# Global notification service instance
notification_service = EmailNotificationService()


# Convenience functions for common scenarios
async def send_welcome_email(user_email: str, user_name: str, activation_link: Optional[str] = None) -> bool:
    """Send welcome email to new user"""
    template_data = {
        "user_name": user_name,
        "activation_link": activation_link
    }
    
    return await notification_service.send_templated_email(
        to_email=user_email,
        notification_type=NotificationType.WELCOME,
        template_data=template_data
    )


async def send_item_found_notification(user_email: str, user_name: str, item_title: str, item_url: str) -> bool:
    """Send notification when a matching item is found"""
    template_data = {
        "user_name": user_name,
        "item_title": item_title,
        "item_url": item_url
    }
    
    return await notification_service.send_templated_email(
        to_email=user_email,
        notification_type=NotificationType.ITEM_FOUND,
        template_data=template_data
    )


async def send_password_reset_email(user_email: str, user_name: str, reset_link: str) -> bool:
    """Send password reset email"""
    template_data = {
        "user_name": user_name,
        "reset_link": reset_link
    }
    
    return await notification_service.send_templated_email(
        to_email=user_email,
        notification_type=NotificationType.PASSWORD_RESET,
        template_data=template_data
    )


async def send_item_approval_notification(user_email: str, user_name: str, item_title: str, admin_message: Optional[str] = None) -> bool:
    """Send item approval notification"""
    template_data = {
        "user_name": user_name,
        "item_title": item_title,
        "admin_message": admin_message or "Your item has been approved."
    }
    
    return await notification_service.send_templated_email(
        to_email=user_email,
        notification_type=NotificationType.ITEM_APPROVAL,
        template_data=template_data
    )


async def send_claim_status_notification(
    user_email: str, 
    user_name: str, 
    claim_title: str,
    item_title: str,
    status: str,
    custom_title: Optional[str] = None,
    custom_description: Optional[str] = None,
    item_url: Optional[str] = None
) -> bool:
    """Send claim status update notification to claimer"""
    template_data = {
        "user_name": user_name,
        "claim_title": claim_title,
        "item_title": item_title,
        "status": status,
        "custom_title": custom_title,
        "custom_description": custom_description,
        "item_url": item_url,
        "status_approved": status.lower() == "approved"
    }
    
    subject = custom_title or f"Claim Status Update: {claim_title}"
    
    return await notification_service.send_templated_email(
        to_email=user_email,
        notification_type=NotificationType.CLAIM_STATUS_UPDATE,
        template_data=template_data,
        subject_override=subject
    )


async def send_new_claim_alert(
    moderator_emails: List[str],
    claim_title: str,
    claim_description: str,
    item_title: str,
    claimer_name: str,
    claimer_email: str,
    claim_url: Optional[str] = None,
    item_url: Optional[str] = None,
    branch_phone1: Optional[str] = None,
    branch_phone2: Optional[str] = None
) -> bool:
    """Send new claim alert to moderators"""
    template_data = {
        "claim_title": claim_title,
        "claim_description": claim_description,
        "item_title": item_title,
        "claimer_name": claimer_name,
        "claimer_email": claimer_email,
        "claim_url": claim_url,
        "item_url": item_url,
        "branch_phone1": branch_phone1,
        "branch_phone2": branch_phone2
    }
    
    return await notification_service.send_templated_email(
        to_email=moderator_emails,
        notification_type=NotificationType.NEW_CLAIM_ALERT,
        template_data=template_data
    )


async def send_new_item_alert(
    moderator_emails: List[str],
    item_title: str,
    item_description: str,
    item_type: str,
    poster_name: str,
    poster_email: str,
    item_url: Optional[str] = None
) -> bool:
    """Send new item alert to moderators"""
    template_data = {
        "item_title": item_title,
        "item_description": item_description,
        "item_type": item_type,
        "poster_name": poster_name,
        "poster_email": poster_email,
        "item_url": item_url
    }
    
    return await notification_service.send_templated_email(
        to_email=moderator_emails,
        notification_type=NotificationType.NEW_ITEM_ALERT,
        template_data=template_data
    )


async def send_new_missing_item_alert(
    admin_emails: List[str],
    missing_item_title: str,
    missing_item_description: str,
    item_type: str,
    reporter_name: str,
    reporter_email: str,
    missing_item_url: Optional[str] = None,
    branch_phone1: Optional[str] = None,
    branch_phone2: Optional[str] = None
) -> bool:
    """Send new missing item alert to admins"""
    template_data = {
        "missing_item_title": missing_item_title,
        "missing_item_description": missing_item_description,
        "item_type": item_type,
        "reporter_name": reporter_name,
        "reporter_email": reporter_email,
        "missing_item_url": missing_item_url,
        "branch_phone1": branch_phone1,
        "branch_phone2": branch_phone2
    }
    
    return await notification_service.send_templated_email(
        to_email=admin_emails,
        notification_type=NotificationType.NEW_MISSING_ITEM_ALERT,
        template_data=template_data
    )


async def send_otp_email(user_email: str, otp_code: str) -> bool:
    """Send OTP email for email verification"""
    template_data = {
        "otp_code": otp_code,
        "user_name": ""  # No name available at registration stage
    }
    
    return await notification_service.send_templated_email(
        to_email=user_email,
        notification_type=NotificationType.EMAIL_VERIFICATION,
        template_data=template_data
    )
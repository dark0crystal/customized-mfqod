"""
Notification Routes

API endpoints for managing and sending notifications
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr
import logging

from app.db.database import get_session
from app.services.notification_service import (
    notification_service, 
    NotificationType,
    send_welcome_email,
    send_item_found_notification,
    send_password_reset_email,
    send_item_approval_notification
)
from app.middleware.auth_middleware import get_current_user_required
from app.utils.permission_decorator import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailRequest(BaseModel):
    """Basic email request model"""
    to_email: EmailStr | List[EmailStr]
    subject: str
    html_content: str
    text_content: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None


class TemplatedEmailRequest(BaseModel):
    """Templated email request model"""
    to_email: EmailStr | List[EmailStr]
    notification_type: str
    template_data: Dict[str, Any]
    subject_override: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None


class BulkNotificationRequest(BaseModel):
    """Bulk notification request model"""
    recipients: List[EmailStr]
    notification_type: str
    template_data: Dict[str, Any]
    subject_override: Optional[str] = None
    batch_size: Optional[int] = 50


class TestEmailRequest(BaseModel):
    """Test email request model"""
    to_email: EmailStr
    test_type: str = "welcome"


@router.post("/send-email")
async def send_basic_email(
    email_request: EmailRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_required)
):
    """
    Send a basic email with HTML content
    Requires authentication
    """
    try:
        # Convert single email to list for consistency
        to_email = email_request.to_email
        if isinstance(to_email, str):
            to_email = [to_email]
        
        # Send email in background
        background_tasks.add_task(
            notification_service.send_email,
            to_email=to_email,
            subject=email_request.subject,
            html_content=email_request.html_content,
            text_content=email_request.text_content,
            cc=email_request.cc,
            bcc=email_request.bcc
        )
        
        logger.info(f"Email queued for sending to: {', '.join(to_email)}")
        
        return {
            "message": "Email queued for sending",
            "recipients": to_email,
            "status": "queued"
        }
        
    except Exception as e:
        logger.error(f"Failed to queue email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue email: {str(e)}")


@router.post("/send-templated-email")
async def send_templated_email_endpoint(
    email_request: TemplatedEmailRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_required)
):
    """
    Send a templated email
    Requires authentication
    """
    try:
        # Validate notification type
        try:
            notification_type = NotificationType(email_request.notification_type)
        except ValueError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid notification type: {email_request.notification_type}"
            )
        
        # Convert single email to list for consistency
        to_email = email_request.to_email
        if isinstance(to_email, str):
            to_email = [to_email]
        
        # Send email in background
        background_tasks.add_task(
            notification_service.send_templated_email,
            to_email=to_email,
            notification_type=notification_type,
            template_data=email_request.template_data,
            subject_override=email_request.subject_override,
            cc=email_request.cc,
            bcc=email_request.bcc
        )
        
        logger.info(f"Templated email ({notification_type.value}) queued for: {', '.join(to_email)}")
        
        return {
            "message": "Templated email queued for sending",
            "notification_type": notification_type.value,
            "recipients": to_email,
            "status": "queued"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to queue templated email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue templated email: {str(e)}")


@router.post("/send-bulk-notification")
@require_permission("admin")
async def send_bulk_notification_endpoint(
    bulk_request: BulkNotificationRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_required)
):
    """
    Send bulk notifications
    Requires admin permission
    """
    try:
        # Validate notification type
        try:
            notification_type = NotificationType(bulk_request.notification_type)
        except ValueError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid notification type: {bulk_request.notification_type}"
            )
        
        if not bulk_request.recipients:
            raise HTTPException(status_code=400, detail="No recipients provided")
        
        if len(bulk_request.recipients) > 1000:
            raise HTTPException(status_code=400, detail="Too many recipients (max 1000)")
        
        # Send bulk notification in background
        background_tasks.add_task(
            notification_service.send_bulk_notification,
            recipients=bulk_request.recipients,
            notification_type=notification_type,
            template_data=bulk_request.template_data,
            subject_override=bulk_request.subject_override,
            batch_size=bulk_request.batch_size or 50
        )
        
        logger.info(f"Bulk notification ({notification_type.value}) queued for {len(bulk_request.recipients)} recipients")
        
        return {
            "message": "Bulk notification queued for sending",
            "notification_type": notification_type.value,
            "recipient_count": len(bulk_request.recipients),
            "batch_size": bulk_request.batch_size or 50,
            "status": "queued"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to queue bulk notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue bulk notification: {str(e)}")


@router.post("/test-email")
async def send_test_email(
    test_request: TestEmailRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_required)
):
    """
    Send a test email for debugging
    Requires authentication
    """
    try:
        test_data = {
            "user_name": current_user.get("full_name", "Test User"),
            "test_message": "This is a test email from the notification service.",
            "sent_by": current_user.get("email", "system")
        }
        
        if test_request.test_type == "welcome":
            test_data.update({
                "activation_link": "https://example.com/activate/test-token"
            })
            background_tasks.add_task(
                send_welcome_email,
                user_email=test_request.to_email,
                user_name=test_data["user_name"],
                activation_link=test_data["activation_link"]
            )
        
        elif test_request.test_type == "item_found":
            test_data.update({
                "item_title": "Test Lost Item",
                "item_url": "https://example.com/items/test-item"
            })
            background_tasks.add_task(
                send_item_found_notification,
                user_email=test_request.to_email,
                user_name=test_data["user_name"],
                item_title=test_data["item_title"],
                item_url=test_data["item_url"]
            )
        
        elif test_request.test_type == "password_reset":
            test_data.update({
                "reset_link": "https://example.com/reset/test-token"
            })
            background_tasks.add_task(
                send_password_reset_email,
                user_email=test_request.to_email,
                user_name=test_data["user_name"],
                reset_link=test_data["reset_link"]
            )
        
        else:
            # Generic test email
            background_tasks.add_task(
                notification_service.send_templated_email,
                to_email=test_request.to_email,
                notification_type=NotificationType.SYSTEM_ALERT,
                template_data={
                    **test_data,
                    "alert_title": "Test Email",
                    "alert_message": "This is a test email from the notification service.",
                    "alert_type": "test"
                }
            )
        
        logger.info(f"Test email ({test_request.test_type}) queued for: {test_request.to_email}")
        
        return {
            "message": f"Test email ({test_request.test_type}) queued for sending",
            "recipient": test_request.to_email,
            "test_type": test_request.test_type,
            "status": "queued"
        }
        
    except Exception as e:
        logger.error(f"Failed to queue test email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to queue test email: {str(e)}")


@router.get("/notification-types")
async def get_notification_types():
    """
    Get list of available notification types
    Public endpoint
    """
    return {
        "notification_types": [
            {
                "value": notification_type.value,
                "name": notification_type.value.replace("_", " ").title()
            }
            for notification_type in NotificationType
        ]
    }


@router.get("/email-config")
@require_permission("admin")
async def get_email_config(current_user=Depends(get_current_user_required)):
    """
    Get email configuration status
    Requires admin permission
    """
    from app.config.email_config import email_settings
    
    return {
        "email_enabled": email_settings.EMAIL_ENABLED,
        "smtp_host": email_settings.SMTP_HOST,
        "smtp_port": email_settings.SMTP_PORT,
        "mail_from": email_settings.MAIL_FROM,
        "mail_from_name": email_settings.MAIL_FROM_NAME,
        "smtp_configured": bool(email_settings.SMTP_USERNAME and email_settings.SMTP_PASSWORD),
        "template_dir": email_settings.TEMPLATE_DIR
    }


@router.post("/validate-email-config")
@require_permission("admin")
async def validate_email_config(current_user=Depends(get_current_user_required)):
    """
    Validate email configuration
    Requires admin permission
    """
    try:
        from app.config.email_config import email_settings
        
        if not email_settings.EMAIL_ENABLED:
            return {
                "valid": False,
                "message": "Email notifications are disabled",
                "issues": ["EMAIL_ENABLED is set to false"]
            }
        
        issues = []
        
        if not email_settings.SMTP_USERNAME:
            issues.append("SMTP_USERNAME not configured")
        
        if not email_settings.SMTP_PASSWORD:
            issues.append("SMTP_PASSWORD not configured")
        
        if not email_settings.SMTP_HOST:
            issues.append("SMTP_HOST not configured")
        
        if not email_settings.SMTP_PORT:
            issues.append("SMTP_PORT not configured")
        
        if not email_settings.MAIL_FROM:
            issues.append("MAIL_FROM not configured")
        
        valid = len(issues) == 0
        
        return {
            "valid": valid,
            "message": "Email configuration is valid" if valid else "Email configuration has issues",
            "issues": issues
        }
        
    except Exception as e:
        logger.error(f"Failed to validate email config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate email config: {str(e)}")
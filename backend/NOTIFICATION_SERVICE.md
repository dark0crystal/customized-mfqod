# Email Notification Service

A comprehensive email notification service for the University Lost & Found System that supports templated emails, multiple scenarios, and bulk notifications.

## Features

- 🎨 **Templated Emails**: Beautiful, responsive HTML email templates
- 📧 **Multiple Scenarios**: Support for various notification types
- 🚀 **Async Support**: Non-blocking email sending
- 📮 **Bulk Notifications**: Send emails to multiple recipients efficiently
- 🔧 **Configurable**: Easy SMTP configuration via environment variables
- 🛡️ **Error Handling**: Robust error handling and logging
- 📱 **Responsive**: Mobile-friendly email templates

## Installation

1. Install the required dependencies:
```bash
pip install aiosmtplib jinja2
```

2. Configure environment variables in your `.env` file:
```bash
# Email Configuration
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
MAIL_FROM=noreply@university.edu
MAIL_FROM_NAME=University Lost & Found System
SMTP_TLS=true
```

## Notification Types

The service supports the following notification types:

- `WELCOME` - Welcome new users
- `ITEM_FOUND` - Notify when a matching item is found
- `ITEM_CLAIMED` - Notify when an item is claimed
- `ACCOUNT_ACTIVATION` - Account activation reminders
- `PASSWORD_RESET` - Password reset emails
- `ITEM_APPROVAL` - Item listing approved
- `ITEM_REJECTION` - Item listing rejected
- `SYSTEM_ALERT` - System notifications
- `REMINDER` - General reminders
- `USER_SUSPENSION` - Account suspension notices
- `USER_REACTIVATION` - Account reactivation notices

## Quick Start

### 1. Basic Email Sending

```python
from app.services.notification_service import notification_service

# Send a simple email
await notification_service.send_email(
    to_email="user@example.com",
    subject="Hello!",
    html_content="<h1>Welcome!</h1><p>This is a test email.</p>"
)
```

### 2. Templated Emails

```python
from app.services.notification_service import (
    notification_service, 
    NotificationType
)

# Send a welcome email
await notification_service.send_templated_email(
    to_email="newuser@example.com",
    notification_type=NotificationType.WELCOME,
    template_data={
        "user_name": "John Doe",
        "activation_link": "https://yoursite.com/activate/token"
    }
)
```

### 3. Convenience Functions

```python
from app.services.notification_service import (
    send_welcome_email,
    send_item_found_notification,
    send_password_reset_email
)

# Welcome email
await send_welcome_email(
    user_email="user@example.com",
    user_name="John Doe",
    activation_link="https://example.com/activate/token"
)

# Item found notification
await send_item_found_notification(
    user_email="user@example.com",
    user_name="John Doe",
    item_title="Lost Laptop",
    item_url="https://example.com/items/123"
)

# Password reset
await send_password_reset_email(
    user_email="user@example.com",
    user_name="John Doe",
    reset_link="https://example.com/reset/token"
)
```

### 4. Bulk Notifications

```python
# Send to multiple recipients
recipients = ["user1@example.com", "user2@example.com", "user3@example.com"]

result = await notification_service.send_bulk_notification(
    recipients=recipients,
    notification_type=NotificationType.SYSTEM_ALERT,
    template_data={
        "alert_title": "System Maintenance",
        "alert_message": "The system will be down for maintenance.",
        "alert_type": "maintenance"
    }
)

print(f"Sent: {result['success']}, Failed: {result['failed']}")
```

## API Endpoints

The service includes REST API endpoints for external integration:

### Send Basic Email
```
POST /api/notifications/send-email
```

### Send Templated Email
```
POST /api/notifications/send-templated-email
```

### Send Bulk Notification (Admin only)
```
POST /api/notifications/send-bulk-notification
```

### Test Email
```
POST /api/notifications/test-email
```

### Get Notification Types
```
GET /api/notifications/notification-types
```

### Email Configuration (Admin only)
```
GET /api/notifications/email-config
POST /api/notifications/validate-email-config
```

## Integration Examples

### User Registration
```python
# In userServices.py
async def register_user(user: UserRegister, session: Session):
    # ... user creation logic ...
    
    # Send welcome email
    try:
        from app.services.notification_service import send_welcome_email
        user_full_name = f"{new_user.first_name} {new_user.last_name}".strip()
        
        asyncio.create_task(
            send_welcome_email(
                user_email=new_user.email,
                user_name=user_full_name
            )
        )
    except Exception as e:
        logger.error(f"Failed to send welcome email: {e}")
```

### Item Approval
```python
# In itemService.py
async def approve_item(item_id: str, session: Session):
    # ... approval logic ...
    
    # Notify user of approval
    try:
        from app.services.notification_service import send_item_approval_notification
        
        asyncio.create_task(
            send_item_approval_notification(
                user_email=item.user.email,
                user_name=item.user.full_name,
                item_title=item.title,
                admin_message="Your item has been approved!"
            )
        )
    except Exception as e:
        logger.error(f"Failed to send approval notification: {e}")
```

## Email Templates

Templates are located in `app/templates/email/` and use Jinja2 syntax:

- `base.html` - Base template with common styling
- `welcome.html` - Welcome email template
- `item_found.html` - Item found notification
- `password_reset.html` - Password reset email
- `item_approval.html` - Item approval notification
- `reminder.html` - General reminder template
- `system_alert.html` - System alert template

### Template Variables

Common variables available in all templates:
- `user_name` - User's full name
- `system_name` - System name
- `support_email` - Support email address
- `current_year` - Current year
- `timestamp` - Current timestamp

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_ENABLED` | Enable/disable email sending | `true` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP username | Required |
| `SMTP_PASSWORD` | SMTP password | Required |
| `MAIL_FROM` | From email address | `noreply@university.edu` |
| `MAIL_FROM_NAME` | From name | `University Lost & Found System` |
| `SMTP_TLS` | Use TLS encryption | `true` |
| `SMTP_SSL` | Use SSL encryption | `false` |
| `EMAIL_TEMPLATE_DIR` | Template directory | `app/templates/email` |

### SMTP Provider Settings

#### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=true
# Use App Password, not regular password
```

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_TLS=true
```

#### Yahoo
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_TLS=true
```

## Testing

Run the notification service to verify configuration:

```bash
# Start the application and test notifications through the API
python -m uvicorn app.main:app --reload
```
- Bulk notifications
- Error handling

## Error Handling

The service includes comprehensive error handling:

- **SMTP Errors**: Caught and logged with details
- **Template Errors**: Fallback to plain text templates
- **Configuration Errors**: Clear error messages
- **Rate Limiting**: Built-in delays for bulk sending

## Security Considerations

- **Credentials**: Store SMTP credentials securely in environment variables
- **Rate Limiting**: Built-in rate limiting for bulk operations
- **Input Validation**: All email addresses are validated
- **Error Logging**: Errors are logged without exposing sensitive data

## Troubleshooting

### Common Issues

1. **"SMTP credentials not configured"**
   - Set `SMTP_USERNAME` and `SMTP_PASSWORD` environment variables

2. **"Template not found"**
   - Check `EMAIL_TEMPLATE_DIR` path
   - Ensure template files exist

3. **"Failed to connect to SMTP server"**
   - Verify `SMTP_HOST` and `SMTP_PORT`
   - Check firewall settings
   - For Gmail, use App Password instead of regular password

4. **"Authentication failed"**
   - Verify SMTP credentials
   - Enable "Less secure app access" for some providers
   - Use App Passwords where required

### Logs

Check application logs for detailed error information:
```bash
tail -f logs/app.log | grep notification
```

## Future Enhancements

Potential improvements:
- Email queue with Redis
- Email analytics and tracking
- Rich text editor for admin emails
- Email scheduling
- Attachment support
- Email signatures
- Unsubscribe functionality
# SMTP Server and Email Notifications Documentation

This document describes the SMTP server configuration and email notification system used in the University Lost & Found application.

## Overview

The application uses an asynchronous SMTP-based email notification service for sending various types of emails including:
- User registration and email verification
- Password reset requests
- Item notifications (found, claimed, approval)
- System alerts and reminders
- Administrative notifications

**Service:** `backend/app/services/notification_service.py` - `EmailNotificationService`

**Configuration:** `backend/app/config/email_config.py` - `EmailSettings`

## SMTP Configuration

### Configuration File

**Location:** `backend/app/config/email_config.py`

The email configuration is loaded from environment variables with default values:

```python
class EmailSettings:
    # SMTP Server Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    
    # Email Settings
    MAIL_FROM: str = os.getenv("MAIL_FROM", "noreply@university.edu")
    MAIL_FROM_NAME: str = os.getenv("MAIL_FROM_NAME", "University Lost & Found System")
    
    # Security
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() == "true"
    SMTP_SSL: bool = os.getenv("SMTP_SSL", "false").lower() == "true"
    
    # Templates
    TEMPLATE_DIR: str = os.getenv("EMAIL_TEMPLATE_DIR", "app/templates/email")
    
    # Frontend URL
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
    
    # Feature flags
    EMAIL_ENABLED: bool = os.getenv("EMAIL_ENABLED", "true").lower() == "true"
```

## Environment Variables

All SMTP configuration is done via environment variables. Set these in your `.env` file:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `EMAIL_ENABLED` | Enable/disable email sending | `true` | No |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` | Yes |
| `SMTP_PORT` | SMTP server port | `587` | Yes |
| `SMTP_USERNAME` | SMTP authentication username | None | Yes |
| `SMTP_PASSWORD` | SMTP authentication password | None | Yes |
| `MAIL_FROM` | From email address | `noreply@university.edu` | Yes |
| `MAIL_FROM_NAME` | From name displayed in emails | `University Lost & Found System` | No |
| `SMTP_TLS` | Use TLS encryption (STARTTLS) | `true` | No |
| `SMTP_SSL` | Use SSL encryption (port 465) | `false` | No |
| `EMAIL_TEMPLATE_DIR` | Template directory path | `app/templates/email` | No |
| `FRONTEND_BASE_URL` | Frontend URL for email links | `http://localhost:3000` | No |

### Example Configuration

```bash
# Email Configuration
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true
SMTP_SSL=false
MAIL_FROM=your-email@gmail.com
MAIL_FROM_NAME="University Lost & Found System"
FRONTEND_BASE_URL=https://lostfound.university.edu
```

## SMTP Provider Settings

### Gmail

**Configuration:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_SSL=false
```

**Important Notes:**
- Use **App Password**, not your regular Gmail password
- Enable 2-Step Verification in your Google Account
- Generate App Password: Google Account → Security → App Passwords
- Port 587 uses STARTTLS (recommended)
- Port 465 uses SSL (set `SMTP_SSL=true`)

### Outlook/Hotmail

**Configuration:**
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_SSL=false
```

**Important Notes:**
- Use your full email address as username
- Use your account password (or App Password if 2FA enabled)
- Port 587 uses STARTTLS

### Yahoo Mail

**Configuration:**
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_SSL=false
```

**Important Notes:**
- Generate App Password from Yahoo Account Security settings
- Port 587 uses STARTTLS

### Custom SMTP Server

**Configuration:**
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_SSL=false
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
```

**Port Configuration:**
- **Port 587:** Use STARTTLS (`SMTP_TLS=true`, `SMTP_SSL=false`)
- **Port 465:** Use SSL (`SMTP_SSL=true`, `SMTP_TLS=false`)
- **Port 25:** Usually unencrypted (not recommended)

## Email Service Implementation

### Service Class

**Location:** `backend/app/services/notification_service.py`

**Class:** `EmailNotificationService`

### Key Methods

#### `send_email()`

Send email with HTML and optional text content.

**Parameters:**
- `to_email`: Recipient email(s) - string or list
- `subject`: Email subject
- `html_content`: HTML email content
- `text_content`: Plain text content (optional)
- `cc`: CC recipients (optional)
- `bcc`: BCC recipients (optional)
- `attachments`: List of attachments (optional)

**Returns:** `bool` - True if sent successfully

**Example:**
```python
from app.services.notification_service import notification_service

success = await notification_service.send_email(
    to_email="user@example.com",
    subject="Test Email",
    html_content="<h1>Hello</h1><p>This is a test.</p>",
    text_content="Hello\n\nThis is a test."
)
```

#### `send_templated_email()`

Send email using predefined templates.

**Parameters:**
- `to_email`: Recipient email(s)
- `notification_type`: `NotificationType` enum value
- `template_data`: Dictionary with template variables
- `subject_override`: Custom subject (optional)
- `cc`: CC recipients (optional)
- `bcc`: BCC recipients (optional)

**Returns:** `bool` - True if sent successfully

**Example:**
```python
from app.services.notification_service import notification_service, NotificationType

success = await notification_service.send_templated_email(
    to_email="user@example.com",
    notification_type=NotificationType.WELCOME,
    template_data={
        "user_name": "John Doe",
        "activation_link": "https://example.com/activate/token"
    }
)
```

#### `send_bulk_notification()`

Send notifications to multiple recipients with rate limiting.

**Parameters:**
- `recipients`: List of recipient emails
- `notification_type`: `NotificationType` enum value
- `template_data`: Dictionary with template variables
- `subject_override`: Custom subject (optional)
- `batch_size`: Number of emails per batch (default: 50)

**Returns:** Dictionary with success/failure counts

**Example:**
```python
result = await notification_service.send_bulk_notification(
    recipients=["user1@example.com", "user2@example.com"],
    notification_type=NotificationType.SYSTEM_ALERT,
    template_data={"alert_message": "System maintenance scheduled"},
    batch_size=50
)
# Returns: {"success": 2, "failed": 0, "total": 2}
```

### SMTP Connection Handling

**Location:** `backend/app/services/notification_service.py` - `_send_smtp_email()` method

**Connection Logic:**
1. **Port 465 (SSL):** Connects with SSL from start
2. **Port 587 (STARTTLS):** Connects plain, then upgrades with STARTTLS
3. **Authentication:** Uses username/password if provided
4. **SSL Context:** Uses certifi certificates for SSL/TLS verification

**Implementation:**
```python
async def _send_smtp_email(self, message: MIMEMultipart, recipients: List[str]):
    use_tls_from_start = self.smtp_ssl or (self.smtp_port == 465)
    
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    
    smtp_client = aiosmtplib.SMTP(
        hostname=self.smtp_host,
        port=self.smtp_port,
        use_tls=use_tls_from_start,
        tls_context=ssl_context if use_tls_from_start else None,
        start_tls=False
    )
    
    await smtp_client.connect()
    
    if self.smtp_tls and not use_tls_from_start:
        await smtp_client.starttls(tls_context=ssl_context)
    
    if self.smtp_username and self.smtp_password:
        await smtp_client.login(self.smtp_username, self.smtp_password)
    
    await smtp_client.send_message(message, sender=self.mail_from, recipients=recipients)
    await smtp_client.quit()
```

## Email Templates

### Template Directory

**Location:** `backend/app/templates/email/`

Templates use Jinja2 templating engine.

### Base Template

**File:** `base.html`

All email templates extend the base template which provides:
- Consistent styling (formal, black/grey text, simple borders)
- Header with system name
- Footer with copyright and support information
- Responsive design for mobile devices

### Available Templates

| Template File | Notification Type | Purpose |
|---------------|------------------|---------|
| `email_verification.html` | `EMAIL_VERIFICATION` | OTP code for email verification |
| `welcome.html` | `WELCOME` | Welcome new users |
| `password_reset.html` | `PASSWORD_RESET` | Password reset links |
| `item_found.html` | `ITEM_FOUND` | Notify when matching item found |
| `item_claimed.html` | `ITEM_CLAIMED` | Item claim notifications |
| `item_approval.html` | `ITEM_APPROVAL` | Item listing approved |
| `new_claim_alert.html` | `NEW_CLAIM_ALERT` | Alert moderators of new claims |
| `new_missing_item_alert.html` | `NEW_MISSING_ITEM_ALERT` | Alert admins of new missing items |
| `system_alert.html` | `SYSTEM_ALERT` | System notifications |
| `reminder.html` | `REMINDER` | General reminders |

### Template Variables

Common variables available in all templates:
- `user_name`: User's full name
- `system_name`: System name ("University Lost & Found System")
- `support_email`: Support email address
- `current_year`: Current year
- `timestamp`: Current timestamp

Template-specific variables are documented in each template file.

### Template Rendering

Templates are rendered using Jinja2:

```python
template = jinja_env.get_template("welcome.html")
html_content = template.render(
    user_name="John Doe",
    activation_link="https://example.com/activate/token",
    system_name="University Lost & Found System"
)
```

## Notification Types

**Enum:** `NotificationType` in `backend/app/services/notification_service.py`

**Available Types:**
- `WELCOME` - Welcome new users
- `ITEM_FOUND` - Notify when matching item found
- `ITEM_CLAIMED` - Item claim notifications
- `ACCOUNT_ACTIVATION` - Account activation reminders
- `PASSWORD_RESET` - Password reset emails
- `ITEM_APPROVAL` - Item listing approved
- `ITEM_REJECTION` - Item listing rejected
- `SYSTEM_ALERT` - System notifications
- `REMINDER` - General reminders
- `USER_SUSPENSION` - Account suspension notices
- `USER_REACTIVATION` - Account reactivation notices
- `CLAIM_STATUS_UPDATE` - Claim status updates
- `NEW_CLAIM_ALERT` - New claim alerts for moderators
- `NEW_ITEM_ALERT` - New item alerts for moderators
- `NEW_MISSING_ITEM_ALERT` - New missing item alerts for admins
- `EMAIL_VERIFICATION` - Email verification OTP

## Convenience Functions

**Location:** `backend/app/services/notification_service.py`

Pre-built functions for common scenarios:

### `send_welcome_email()`

```python
await send_welcome_email(
    user_email="user@example.com",
    user_name="John Doe",
    activation_link="https://example.com/activate/token"  # Optional
)
```

### `send_otp_email()`

```python
await send_otp_email(
    user_email="user@example.com",
    otp_code="123456"
)
```

### `send_password_reset_email()`

```python
await send_password_reset_email(
    user_email="user@example.com",
    user_name="John Doe",
    reset_link="https://example.com/reset/token"
)
```

### `send_item_found_notification()`

```python
await send_item_found_notification(
    user_email="user@example.com",
    user_name="John Doe",
    item_title="Lost Wallet",
    item_url="https://example.com/items/123"
)
```

### `send_item_approval_notification()`

```python
await send_item_approval_notification(
    user_email="user@example.com",
    user_name="John Doe",
    item_title="Found Phone",
    admin_message="Your item has been approved."  # Optional
)
```

### `send_new_claim_alert()`

```python
await send_new_claim_alert(
    moderator_emails=["mod1@example.com", "mod2@example.com"],
    claim_title="Claim for Lost Wallet",
    claim_description="I lost my wallet...",
    item_title="Found Wallet",
    claimer_name="John Doe",
    claimer_email="john@example.com",
    claim_url="https://example.com/claims/123",  # Optional
    item_url="https://example.com/items/456"  # Optional
)
```

## API Endpoints

**Router:** `backend/app/routes/notificationRoutes.py`

### Send Basic Email

**Endpoint:** `POST /api/notifications/send-email`

**Auth Required:** Yes

**Request:**
```json
{
    "to_email": "user@example.com",
    "subject": "Test Email",
    "html_content": "<h1>Hello</h1>",
    "text_content": "Hello",
    "cc": ["cc@example.com"],
    "bcc": ["bcc@example.com"]
}
```

**Response:**
```json
{
    "message": "Email queued for sending",
    "recipients": ["user@example.com"],
    "status": "queued"
}
```

### Send Templated Email

**Endpoint:** `POST /api/notifications/send-templated-email`

**Auth Required:** Yes

**Request:**
```json
{
    "to_email": "user@example.com",
    "notification_type": "welcome",
    "template_data": {
        "user_name": "John Doe",
        "activation_link": "https://example.com/activate/token"
    },
    "subject_override": "Custom Subject"
}
```

**Response:**
```json
{
    "message": "Templated email queued for sending",
    "notification_type": "welcome",
    "recipients": ["user@example.com"],
    "status": "queued"
}
```

### Send Bulk Notification

**Endpoint:** `POST /api/notifications/send-bulk-notification`

**Auth Required:** Yes (Admin permission)

**Request:**
```json
{
    "recipients": ["user1@example.com", "user2@example.com"],
    "notification_type": "system_alert",
    "template_data": {
        "alert_message": "System maintenance scheduled"
    },
    "batch_size": 50
}
```

**Response:**
```json
{
    "message": "Bulk notification queued for sending",
    "notification_type": "system_alert",
    "recipient_count": 2,
    "batch_size": 50,
    "status": "queued"
}
```

### Get Notification Types

**Endpoint:** `GET /api/notifications/notification-types`

**Auth Required:** No

**Response:**
```json
{
    "notification_types": [
        {"value": "welcome", "name": "Welcome"},
        {"value": "item_found", "name": "Item Found"},
        ...
    ]
}
```

### Get Email Config

**Endpoint:** `GET /api/notifications/email-config`

**Auth Required:** Yes (Admin permission)

**Response:**
```json
{
    "email_enabled": true,
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "mail_from": "noreply@university.edu",
    "mail_from_name": "University Lost & Found System",
    "smtp_configured": true,
    "template_dir": "app/templates/email"
}
```

### Validate Email Config

**Endpoint:** `POST /api/notifications/validate-email-config`

**Auth Required:** Yes (Admin permission)

**Response:**
```json
{
    "valid": true,
    "message": "Email configuration is valid",
    "issues": []
}
```

## Dependencies

**Required Python Packages:**
- `aiosmtplib` - Asynchronous SMTP client
- `jinja2` - Template engine
- `certifi` - SSL certificate bundle

**Installation:**
```bash
pip install aiosmtplib jinja2 certifi
```

**Location:** `backend/requirements.txt`

## Security Considerations

### Credential Storage

- **Never commit credentials to version control**
- Store SMTP credentials in environment variables
- Use `.env` file (add to `.gitignore`)
- Use secure secret management in production

### SSL/TLS Encryption

- Always use TLS/SSL for SMTP connections
- Port 587 with STARTTLS (recommended)
- Port 465 with SSL (alternative)
- SSL certificate verification enabled by default

### Rate Limiting

- Bulk notifications include rate limiting
- Default batch size: 50 emails
- 1 second delay between batches
- Prevents SMTP server overload

### Input Validation

- Email addresses validated using Pydantic `EmailStr`
- Template content auto-escaped (XSS prevention)
- HTML sanitization via Jinja2 autoescape

## Error Handling

### Email Sending Errors

**Common Errors:**
- **SMTP Authentication Failed:** Invalid username/password
- **Connection Timeout:** SMTP server unreachable
- **SSL/TLS Error:** Certificate or encryption issue
- **Template Not Found:** Missing template file
- **Invalid Email Address:** Malformed email format

**Error Logging:**
- All errors logged with details
- Sensitive information (passwords) not logged
- Failed emails return `False` without raising exceptions

**Example Error Handling:**
```python
try:
    success = await notification_service.send_email(...)
    if not success:
        logger.error("Email sending failed")
except Exception as e:
    logger.error(f"Email error: {e}")
```

### Fallback Behavior

- If template not found, uses fallback HTML template
- If email disabled, returns `False` without error
- If dependencies missing, logs warning and disables email

## Email Status

### Email Enabled Check

The service checks if email is enabled before sending:

```python
if not self.email_enabled:
    logger.info("Email notifications are disabled")
    return False
```

### Dependency Check

If required packages are not installed:

```python
if not EMAIL_DEPENDENCIES_AVAILABLE:
    logger.error("Email dependencies not available")
    return False
```

### Credential Check

If SMTP credentials are not configured:

```python
if not self.smtp_username or not self.smtp_password:
    logger.error("SMTP credentials not configured")
    return False
```

## Testing

### Test Email Endpoint

**Endpoint:** `POST /api/notifications/test-email`

**Auth Required:** Yes

**Request:**
```json
{
    "to_email": "your-email@example.com",
    "test_type": "welcome"
}
```

**Test Types:**
- `welcome` - Welcome email template
- `item_found` - Item found notification
- `password_reset` - Password reset email
- Default - Generic system alert

### Manual Testing

```python
from app.services.notification_service import notification_service

# Test basic email
success = await notification_service.send_email(
    to_email="test@example.com",
    subject="Test",
    html_content="<h1>Test</h1>"
)

# Test templated email
success = await notification_service.send_templated_email(
    to_email="test@example.com",
    notification_type=NotificationType.WELCOME,
    template_data={"user_name": "Test User"}
)
```

## Background Processing

Emails are sent asynchronously using FastAPI BackgroundTasks:

```python
from fastapi import BackgroundTasks

@router.post("/send-email")
async def send_email_endpoint(
    email_request: EmailRequest,
    background_tasks: BackgroundTasks
):
    background_tasks.add_task(
        notification_service.send_email,
        to_email=email_request.to_email,
        subject=email_request.subject,
        html_content=email_request.html_content
    )
    return {"status": "queued"}
```

This prevents blocking the API response while emails are being sent.

## Related Files

### Backend

- **Service:** `backend/app/services/notification_service.py`
- **Config:** `backend/app/config/email_config.py`
- **Routes:** `backend/app/routes/notificationRoutes.py`
- **Templates:** `backend/app/templates/email/`

### Usage Examples

- **OTP Service:** `backend/app/services/otp_service.py`
- **Auth Service:** `backend/app/services/auth_service.py`
- **Item Service:** `backend/app/services/itemService.py`
- **Claim Service:** `backend/app/services/claimService.py`

## Email Format

### Message Structure

- **MIME Type:** `multipart/alternative`
- **Text Part:** Plain text version (optional)
- **HTML Part:** HTML version (required)
- **Headers:** From, To, Subject, Cc, Bcc

### From Address Format

```
{MAIL_FROM_NAME} <{MAIL_FROM}>
```

Example: `University Lost & Found System <noreply@university.edu>`

## Troubleshooting

### Common Issues

**Issue: Authentication Failed**
- Check SMTP_USERNAME and SMTP_PASSWORD
- For Gmail, use App Password, not regular password
- Verify 2FA is enabled if using App Password

**Issue: Connection Timeout**
- Check SMTP_HOST and SMTP_PORT
- Verify firewall allows SMTP connections
- Check network connectivity

**Issue: SSL/TLS Error**
- Verify SMTP_TLS/SMTP_SSL settings match port
- Port 587: SMTP_TLS=true, SMTP_SSL=false
- Port 465: SMTP_SSL=true

**Issue: Emails Not Sending**
- Check EMAIL_ENABLED is true
- Verify dependencies installed (aiosmtplib, jinja2)
- Check application logs for error messages
- Validate configuration via `/api/notifications/validate-email-config`

**Issue: Template Not Found**
- Verify template file exists in `app/templates/email/`
- Check template name matches notification type
- Ensure Jinja2 template syntax is correct















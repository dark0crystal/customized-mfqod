# Password Reset Documentation

This document describes the password reset flow used in the University Lost & Found application.

---

## Overview

The application supports password reset for **external users only**. Internal users (university staff/students) authenticate via Active Directory and must reset their password through the organization's portal or IT services.

**Key behaviors:**
- External users can request a password reset link via email
- Reset links expire after 24 hours (configurable)
- Rate limiting: max 3 reset requests per hour per user
- Internal users receive an explicit error directing them to the organization portal

---

## User Types and Eligibility

| User Type   | Password Reset Via App | Notes                                                                 |
|-------------|------------------------|-----------------------------------------------------------------------|
| **External**| Yes                    | Receives reset link by email. Can reset through the application.      |
| **Internal**| No                     | Must use organization's website or portal to reset password.           |

Internal users who attempt to reset their password will see: *"University affiliates: Please reset your password through the university portal."*

---

## Password Reset Flow

### Step 1: Request Reset

1. User visits **Forgot Password** page (`/auth/forgot-password`)
2. User enters email address
3. Frontend calls `POST /api/auth/request-reset`

**Backend logic:**
- If user does not exist: returns generic success (avoids email enumeration)
- If user is internal: returns 400 with explicit error message
- If user is external: generates token, stores it, sends email with reset link

**Endpoint:** `POST /api/auth/request-reset`

**Request:**
```json
{
    "email": "user@example.com"
}
```

**Response (success):**
```json
{
    "message": "If an account exists with that email, you will receive a password reset link shortly."
}
```

**Response (internal user - 400):**
```json
{
    "detail": "Internal users must reset their password through the organization's website or portal. This form is for external users only."
}
```

### Step 2: Email Delivery

- System generates a secure token (32 bytes, URL-safe)
- Token is stored in `password_reset_tokens` table
- Email is sent with reset link: `{FRONTEND_BASE_URL}/en/auth/reset-password?token={token}`
- Email template: `backend/app/templates/email/password_reset.html`

### Step 3: Confirm Reset

1. User clicks link in email
2. User is redirected to Reset Password page with token in URL
3. User enters new password (and confirmation)
4. Frontend calls `POST /api/auth/reset-password`

**Backend logic:**
- Validates token (exists, not used, not expired)
- Validates user is external
- Validates password strength
- Updates password, marks token as used

**Endpoint:** `POST /api/auth/reset-password`

**Request:**
```json
{
    "token": "reset-token-from-email",
    "new_password": "newSecurePassword123"
}
```

**Response (success):**
```json
{
    "message": "Password has been reset successfully. You can now log in."
}
```

**Response (invalid token - 400):**
```json
{
    "detail": "Invalid or expired reset token. Please request a new password reset."
}
```

---

## Security

### Rate Limiting

- **Max 3 reset requests per hour** per user
- Excess requests return generic success (no email sent)
- Prevents abuse and email bombing

### Token Security

- Tokens are 32-byte cryptographically secure random strings (`secrets.token_urlsafe(32)`)
- Single-use: token is marked `used` after successful reset
- Old unused tokens are invalidated when a new request is made
- Expiration: 24 hours (configurable)

### Email Enumeration Prevention

- For non-existent users: returns same generic success message
- For internal users: returns explicit error (intentional, to guide user to correct portal)

### Password Requirements

- Minimum 8 characters (configurable)
- Same validation as registration and change-password

---

## Configuration

**Location:** `backend/app/config/auth_config.py` - `AuthConfig` class

| Variable                        | Description                      | Default  |
|--------------------------------|----------------------------------|----------|
| `FRONTEND_BASE_URL`            | Base URL for reset links in email| `http://localhost:3000` |
| `PASSWORD_RESET_TOKEN_EXPIRE_HOURS` | Token expiration in hours  | `24`     |

**Environment variables:**
```bash
FRONTEND_BASE_URL=http://localhost:3000
PASSWORD_RESET_TOKEN_EXPIRE_HOURS=24
```

---

## Database

### `password_reset_tokens` Table

| Column      | Type      | Description                          |
|-------------|-----------|--------------------------------------|
| `id`        | UUID      | Primary key                          |
| `user_id`   | UUID      | Foreign key to user                  |
| `token`     | String    | Unique reset token                   |
| `expires_at`| DateTime  | Token expiration                     |
| `used`      | Boolean   | Whether token has been used          |
| `created_at`| DateTime  | Creation timestamp                   |

**Migration:** `backend/app/db/migrations/versions/44416e7a1f85_add_password_reset_tokens_table.py`

---

## Implementation Locations

| Component       | Location                                                                 |
|-----------------|--------------------------------------------------------------------------|
| Auth routes     | `backend/app/routes/comprehensive_auth_routes.py` - `request_password_reset`, `reset_password` |
| Auth service    | `backend/app/services/auth_service.py` - `request_password_reset`, `confirm_password_reset` |
| Schemas         | `backend/app/schemas/auth_schemas.py` - `ResetPasswordRequest`, `ResetPasswordConfirm` |
| Email template  | `backend/app/templates/email/password_reset.html`                        |
| Email service   | `backend/app/services/notification_service.py` - `send_password_reset_email` |
| Forgot password page | `frontend/src/app/[locale]/(main)/auth/forgot-password/page.tsx`  |
| Reset password page  | `frontend/src/app/[locale]/(main)/auth/reset-password/page.tsx`  |
| API client      | `frontend/src/utils/api.ts` - `authApi.requestPasswordReset`, `authApi.confirmPasswordReset` |

---

## Related Documentation

- **Authentication:** `docs/authentication.md` - Login, registration, token system
- **Email notifications:** `docs/smtp-email-notifications.md` - SMTP config, email templates

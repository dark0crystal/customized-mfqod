# Authentication System Documentation

This document describes the authentication system used in the University Lost & Found application.

## Overview

The application uses a hybrid authentication system combining:
- **JWT (JSON Web Tokens)** for access tokens
- **Database-backed sessions** for refresh tokens
- **Dual authentication methods**: Active Directory (LDAP) for internal users and database passwords for external users

## Authentication Methods

### Internal Users (University Staff/Students)

Internal users authenticate via **Active Directory (LDAP)**:

- Authentication is performed against the university's LDAP server
- User accounts are automatically created/synced from AD on first login
- User information (name, email, etc.) is synced from AD
- Password changes must be done through Active Directory
- User type: `internal`

**Configuration:** `backend/app/config/auth_config.py` - `ADConfig` class

**Service:** `backend/app/services/enhanced_ad_service.py` - `EnhancedADService`

### External Users

External users authenticate using **database-stored password hashes**:

- Passwords are hashed using bcrypt (12 rounds)
- User accounts are created through registration
- Password changes are handled within the application
- User type: `external`

**Service:** `backend/app/services/auth_service.py` - `AuthService`

## Registration Flow

### External User Registration

External users must register before accessing the system:

1. **Send OTP** → `POST /api/auth/send-otp`
   - User provides email address
   - System generates 6-digit OTP code
   - OTP is sent via email
   - OTP expires in 10 minutes
   - Rate limited: 3 requests per email per hour

2. **Verify OTP** → `POST /api/auth/verify-otp`
   - User provides email and OTP code
   - System validates OTP code and expiration
   - Email is marked as verified

3. **Register** → `POST /api/auth/register`
   - User provides registration data (email, password, name, etc.)
   - System checks email verification status
   - Password strength is validated (minimum 8 characters)
   - Password is hashed using bcrypt
   - User account is created with default "user" role
   - User type is set to `external`

**Registration Requirements:**
- Email must be verified via OTP
- Password: minimum 8 characters
- First name and last name required
- Username optional (defaults to email)
- Phone number optional

**Endpoints:**
- `POST /api/auth/send-otp` - Send OTP to email
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/register` - Complete registration

**Location:** `backend/app/routes/comprehensive_auth_routes.py`

### Internal User Registration

Internal users are **automatically created** on first login:

1. User attempts to login with university credentials
2. System authenticates against Active Directory
3. If authentication succeeds and user doesn't exist in database:
   - User account is automatically created
   - User information is synced from AD
   - Default role is assigned
   - User type is set to `internal`

**No manual registration required for internal users.**

## Login Flow

### Login Process

1. **User submits credentials** → `POST /api/auth/login`
   - Email/username and password

2. **System determines user type:**
   - Checks if user exists in database
   - If exists: routes to appropriate authentication method
   - If doesn't exist: attempts AD authentication (for auto-creation)

3. **Authentication:**
   - **Internal users:** Authenticate against Active Directory
   - **External users:** Verify password hash against database

4. **On successful authentication:**
   - Generate JWT access token (8 hours expiration)
   - Generate refresh token (random secure string)
   - Create session record in database
   - Reset failed login attempts
   - Log successful login attempt
   - Return tokens and user information

5. **On failed authentication:**
   - Increment failed login attempts
   - Apply account lockout if threshold exceeded
   - Log failed attempt with reason

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
    "email_or_username": "user@example.com",
    "password": "password123"
}
```

**Response:**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "random-secure-token-string",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": {
        "id": "user-uuid",
        "email": "user@example.com",
        "username": "username",
        "first_name": "John",
        "last_name": "Doe",
        "user_type": "internal",
        "role": "student",
        "permissions": ["read_items", "create_items"]
    }
}
```

**Location:** `backend/app/routes/comprehensive_auth_routes.py` - `login()` function

**Service:** `backend/app/services/auth_service.py` - `authenticate_user()` method

## Token System

### JWT Access Tokens

**Type:** JSON Web Token (JWT)

**Algorithm:** HS256

**Expiration:** 8 hours (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)

**Payload Structure:**
```json
{
    "sub": "user-uuid",                    // Subject (user ID)
    "email": "user@example.com",           // User email
    "username": "username",                 // Username
    "user_type": "internal",               // User type
    "role": "student",                     // Role name
    "role_id": "role-uuid",                 // Role ID
    "exp": 1234567890,                      // Expiration timestamp
    "iat": 1234567890,                      // Issued at timestamp
    "iss": "university-lost-found-auth"     // Issuer
}
```

**Token Creation:** `backend/app/services/auth_service.py` - `_create_access_token()` method

**Token Verification:** `backend/app/services/auth_service.py` - `verify_token()` method

### Refresh Tokens

**Type:** Random secure string (URL-safe)

**Storage:** Database table `user_sessions`

**Expiration:** 7 days (configurable via `REFRESH_TOKEN_EXPIRE_DAYS`)

**Session Record Structure:**
- `session_token`: Refresh token value
- `user_id`: Associated user
- `ip_address`: Login IP address
- `user_agent`: Browser/client information
- `is_active`: Session validity flag
- `expires_at`: Expiration timestamp
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Model:** `backend/app/models.py` - `UserSession` class

**Generation:** `backend/app/services/auth_service.py` - `_generate_refresh_token()` method

### Token Usage

**Request Authentication:**
- Access token sent in `Authorization` header: `Bearer <access_token>`
- Middleware extracts and verifies token
- User object is loaded from database
- User is available in route handlers

**Middleware:** `backend/app/middleware/auth_middleware.py` - `AuthMiddleware` class

**Dependencies:**
- `get_current_user_optional()` - Optional authentication (returns None if not authenticated)
- `get_current_user_required()` - Required authentication (raises 401 if not authenticated)

## Token Refresh

### Refresh Flow

1. **Client detects token expiration** (or approaching expiration)
2. **Client sends refresh request** → `POST /api/auth/refresh`
   - Includes refresh token in request body

3. **Backend validates refresh token:**
   - Checks if session exists in database
   - Verifies session is active
   - Verifies session hasn't expired
   - Verifies user account is active

4. **On successful validation:**
   - Generate new access token
   - Update session `updated_at` timestamp
   - Return new access token

5. **On failure:**
   - Return 401 Unauthorized
   - Client should redirect to login

**Endpoint:** `POST /api/auth/refresh`

**Request:**
```json
{
    "refresh_token": "session-token-string"
}
```

**Response:**
```json
{
    "access_token": "new-jwt-token",
    "token_type": "bearer",
    "expires_in": 28800
}
```

**Location:** `backend/app/routes/comprehensive_auth_routes.py` - `refresh_token()` function

**Service:** `backend/app/services/auth_service.py` - `refresh_access_token()` method

### Frontend Auto-Refresh

The frontend automatically refreshes tokens:

- Monitors token expiration every 2 minutes
- Proactively refreshes when token has less than 5 minutes remaining
- Handles refresh failures by redirecting to login
- Prevents multiple simultaneous refresh requests

**Implementation:** `frontend/src/utils/tokenManager.ts` - `TokenManager` class

## Logout

### Logout Process

1. **Client sends logout request** → `POST /api/auth/logout`
   - Includes refresh token in request body
   - Requires valid access token in Authorization header

2. **Backend invalidates session:**
   - Finds session by refresh token
   - Sets `is_active = False`
   - Updates session timestamp

3. **Client clears tokens:**
   - Removes access token from storage
   - Removes refresh token from storage
   - Removes user information

**Note:** Access tokens remain valid until expiration (no server-side revocation). Only refresh tokens are invalidated.

**Endpoint:** `POST /api/auth/logout`

**Request:**
```json
{
    "refresh_token": "session-token-string"
}
```

**Response:**
```json
{
    "message": "Successfully logged out"
}
```

**Location:** `backend/app/routes/comprehensive_auth_routes.py` - `logout()` function

**Service:** `backend/app/services/auth_service.py` - `logout()` method

## Security Features

### Rate Limiting

**Login Rate Limiting:**
- Maximum 5 login attempts per minute per IP address
- Maximum 5 login attempts per minute per email/username
- Returns 429 Too Many Requests when exceeded

**Configuration:** `backend/app/config/auth_config.py` - `LOGIN_RATE_LIMIT_PER_MINUTE`

**Implementation:** `backend/app/services/auth_service.py` - `_check_rate_limit()` method

### Account Lockout

**Lockout Mechanism:**
- After 5 failed login attempts, account is locked
- Lockout duration increases with each additional failure (exponential backoff)
- Base lockout: 30 minutes
- Maximum lockout: 24 hours

**Configuration:** `backend/app/config/auth_config.py` - `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION_MINUTES`

**Implementation:** `backend/app/services/auth_service.py` - `_handle_failed_login()` method

### Password Security

**Password Hashing:**
- Algorithm: bcrypt
- Rounds: 12
- Passwords never stored in plaintext

**Password Requirements:**
- Minimum length: 8 characters
- No complexity requirements (configurable)

**Configuration:** `backend/app/config/auth_config.py` - `PASSWORD_MIN_LENGTH`, `BCRYPT_ROUNDS`

**Implementation:** `backend/app/services/auth_service.py` - `_hash_password()`, `_verify_password()` methods

### Session Management

**Session Limits:**
- Maximum 3 active sessions per user
- Oldest sessions are deactivated when limit exceeded
- Expired sessions are automatically cleaned up

**Session Tracking:**
- IP address recorded
- User agent recorded
- Creation and expiration timestamps
- Active/inactive status

**Configuration:** `backend/app/config/auth_config.py` - `MAX_SESSIONS_PER_USER`

**Implementation:** `backend/app/services/auth_service.py` - `_cleanup_old_sessions()` method

### Audit Logging

**Login Attempt Logging:**
- All login attempts are logged (success and failure)
- Records: user ID, email/username, IP address, user agent, status, failure reason
- Timestamp recorded

**Model:** `backend/app/models.py` - `LoginAttempt` class

**Configuration:** `backend/app/config/auth_config.py` - `ENABLE_AUDIT_LOGGING`

**Implementation:** `backend/app/services/auth_service.py` - `_log_login_attempt()` method

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/login` | POST | User login | No |
| `/api/auth/register` | POST | Register external user | No |
| `/api/auth/send-otp` | POST | Send OTP for email verification | No |
| `/api/auth/verify-otp` | POST | Verify OTP code | No |
| `/api/auth/refresh` | POST | Refresh access token | No |
| `/api/auth/logout` | POST | Logout user | Yes |
| `/api/auth/me` | GET | Get current user info | Yes |
| `/api/auth/me` | PUT | Update user profile | Yes |
| `/api/auth/change-password` | POST | Change password (external users only) | Yes |
| `/api/auth/sessions` | GET | Get user sessions | Yes |
| `/api/auth/sessions/{id}` | DELETE | Revoke session | Yes |

### Admin Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/admin/users` | GET | Get all users | Yes (Admin) |
| `/api/auth/admin/login-attempts` | GET | Get login attempts | Yes (Admin) |
| `/api/auth/admin/sync-ad` | POST | Trigger AD sync | Yes (Admin) |
| `/api/auth/admin/ad-sync-logs` | GET | Get AD sync logs | Yes (Admin) |
| `/api/auth/admin/health` | GET | System health check | Yes (Admin) |
| `/api/auth/admin/diagnose-ad` | POST | AD diagnostic tool | Yes (Admin) |
| `/api/auth/admin/users/{id}/toggle-active` | PUT | Toggle user active status | Yes (Admin) |

**Location:** `backend/app/routes/comprehensive_auth_routes.py`

## Frontend Integration

### Token Storage

**Storage Method:** HTTP-only cookies (via `cookieUtils`)

**Tokens Stored:**
- `access_token`: JWT access token (1 day expiration)
- `refresh_token`: Refresh token (7 days expiration)
- `user`: User information JSON (7 days expiration)

**Implementation:** `frontend/src/utils/tokenManager.ts` - `TokenManager` class

### Authentication Flow

1. **Login:** User submits credentials → `tokenManager.login()`
2. **Token Storage:** Tokens stored in cookies
3. **API Requests:** Access token automatically included in `Authorization` header
4. **Token Refresh:** Automatic refresh before expiration
5. **Logout:** Tokens cleared from cookies

### API Request Authentication

**Automatic Token Injection:**
- `tokenManager.makeAuthenticatedRequest()` automatically adds `Authorization` header
- Handles token refresh on 401 errors
- Retries request with new token

**Implementation:** `frontend/src/utils/tokenManager.ts` - `makeAuthenticatedRequest()` method

### Protected Routes

**Middleware:** `frontend/src/middleware.ts`
- Checks authentication status
- Redirects to login if not authenticated
- Handles token refresh

**Protected Route Pattern:** `[locale]/(protected)/**`

## Configuration

### Authentication Configuration

**File:** `backend/app/config/auth_config.py` - `AuthConfig` class

**Key Settings:**
- `SECRET_KEY`: JWT signing key
- `JWT_ALGORITHM`: Token algorithm (HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token lifetime (480 minutes / 8 hours)
- `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token lifetime (7 days)
- `MAX_LOGIN_ATTEMPTS`: Failed attempts before lockout (5)
- `LOCKOUT_DURATION_MINUTES`: Base lockout duration (30 minutes)
- `LOGIN_RATE_LIMIT_PER_MINUTE`: Rate limit (5 per minute)
- `MAX_SESSIONS_PER_USER`: Maximum active sessions (3)
- `PASSWORD_MIN_LENGTH`: Minimum password length (8)
- `BCRYPT_ROUNDS`: Password hashing rounds (12)

### Active Directory Configuration

**File:** `backend/app/config/auth_config.py` - `ADConfig` class

**Key Settings:**
- `SERVER`: LDAP server address
- `PORT`: LDAP port (636 for LDAPS)
- `USE_SSL`: Enable SSL
- `BASE_DN`: Base distinguished name
- `USER_DN`: User organizational unit
- `BIND_USER`: Service account DN
- `BIND_PASSWORD`: Service account password
- `USER_SEARCH_FILTER`: LDAP search filter

## Related Files

### Backend

- **Routes:** `backend/app/routes/comprehensive_auth_routes.py`
- **Service:** `backend/app/services/auth_service.py`
- **AD Service:** `backend/app/services/enhanced_ad_service.py`
- **Middleware:** `backend/app/middleware/auth_middleware.py`
- **Config:** `backend/app/config/auth_config.py`
- **Models:** `backend/app/models.py` (User, UserSession, LoginAttempt)
- **Schemas:** `backend/app/schemas/auth_schemas.py`

### Frontend

- **Token Manager:** `frontend/src/utils/tokenManager.ts`
- **API Utils:** `frontend/src/utils/api.ts`
- **Auth Hook:** `frontend/src/hooks/useAuth.ts`
- **Middleware:** `frontend/src/middleware.ts`
- **Login Page:** `frontend/src/app/[locale]/(main)/auth/login/page.tsx`
- **Register Page:** `frontend/src/app/[locale]/(main)/auth/register/page.tsx`

## Token Lifecycle

1. **Login:** User authenticates → Access token + Refresh token generated
2. **API Requests:** Access token used in Authorization header
3. **Token Expiration:** Access token expires after 8 hours
4. **Token Refresh:** Refresh token used to get new access token
5. **Session Expiration:** Refresh token expires after 7 days
6. **Logout:** Refresh token invalidated, access token remains valid until expiration
7. **Re-login Required:** User must login again after refresh token expiration

## User Types

### Internal Users

- **Authentication:** Active Directory (LDAP)
- **Account Creation:** Automatic on first login
- **Password Management:** Through Active Directory
- **User Type Value:** `"internal"`
- **Data Sync:** Synced from AD on each login

### External Users

- **Authentication:** Database password hash
- **Account Creation:** Manual registration
- **Password Management:** Through application
- **User Type Value:** `"external"`
- **Email Verification:** Required via OTP

## Permissions System

Users have permissions based on their role:

- Permissions are assigned to roles
- Users inherit permissions from their role
- Full access users bypass permission checks
- Permissions are included in login response
- Permissions are checked via middleware dependencies

**Permission Check:** `backend/app/middleware/auth_middleware.py` - `require_permissions()` method

**Permission Service:** `backend/app/services/permissionServices.py`

## Error Handling

### Authentication Errors

| Status Code | Description |
|-------------|-------------|
| 401 Unauthorized | Invalid credentials, expired token, invalid token |
| 423 Locked | Account locked due to failed attempts |
| 429 Too Many Requests | Rate limit exceeded |
| 409 Conflict | Email already registered |
| 400 Bad Request | Invalid input, OTP verification failed |
| 500 Internal Server Error | Server error during authentication |

### Common Error Scenarios

- **Invalid credentials:** 401 with "Invalid credentials" message
- **Account locked:** 423 with lockout expiration timestamp
- **Token expired:** 401 with "Token has expired" message
- **Rate limit exceeded:** 429 with "Too many login attempts" message
- **Email not verified:** 400 with "Email address must be verified" message


# University Lost & Found System - Enhanced Authentication

A comprehensive lost and found system with dual authentication supporting both internal university users (via Active Directory) and external users (traditional authentication).

## 🚀 Features

### Authentication System
- **Dual Authentication**: Support for both Active Directory (internal users) and traditional database authentication (external users)
- **Automatic User Type Detection**: Intelligently detects if a user is internal or external based on email domain or username format
- **Real-time AD Verification**: Verifies current enrollment/employment status against Active Directory on each login
- **JWT-based Sessions**: Secure token-based authentication with refresh token support
- **Account Lockout**: Progressive lockout system with exponential backoff for failed login attempts
- **Rate Limiting**: Protection against brute force attacks with configurable limits

### Security Features
- **Role-Based Access Control (RBAC)**: Granular permissions system with predefined roles
- **Password Security**: Configurable password policies with strength validation
- **Security Logging**: Comprehensive audit trail for all authentication events
- **Session Management**: Active session tracking with automatic cleanup
- **Security Headers**: Automatic security header injection
- **CSRF Protection**: Cross-site request forgery protection

### Active Directory Integration
- **Automated User Sync**: Periodic synchronization of user data from Active Directory
- **Group Mapping**: Automatic role assignment based on AD group membership
- **Account Status Verification**: Real-time checking of account expiration and status
- **Graceful Fallback**: System continues to operate even if AD is temporarily unavailable
- **Health Monitoring**: Continuous monitoring of AD connectivity

## 📋 Requirements

- Python 3.11+
- PostgreSQL 12+
- Active Directory (for internal user authentication)
- Redis (optional, for enhanced caching and rate limiting)

## 🛠 Installation

### 1. Clone and Setup

```bash
git clone <repository-url>
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb lost_found_db

# Run migrations
alembic upgrade head
```

### 3. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your specific configuration
```

## 🔐 Authentication Flow

### Internal Users (University Staff/Students)
1. User enters university email or username
2. System detects user type as "internal"
3. Credentials are verified against Active Directory
4. User information is synced to local database
5. JWT tokens are issued for session management

### External Users (Visitors, Alumni)
1. User enters email and password
2. System detects user type as "external"  
3. Credentials are verified against local database
4. JWT tokens are issued for session management

## 📚 API Documentation

Once the application is running, visit:
- **Interactive API Docs**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

## 🔧 Configuration

### Key Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/lost_found_db

# JWT Security
SECRET_KEY=your-super-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Active Directory
LDAP_SERVER=your-domain-controller.squ.edu.om
LDAP_BIND_USER=CN=ServiceAccount,OU=Service Accounts,DC=squ,DC=edu,DC=om
LDAP_BIND_PASSWORD=your-service-account-password

# Security Settings
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
```

## 🚀 Running the Application

### Development
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

## 📝 API Usage Examples

### Login (Internal User)
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email_or_username": "student123",
    "password": "userpassword"
  }'
```

### Register External User
```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@gmail.com",
    "password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

## 🔒 Security Features

### Implemented Security Measures
1. **Password Hashing**: bcrypt with configurable rounds
2. **Rate Limiting**: Per-IP and per-user request limiting
3. **Account Lockout**: Progressive lockout with exponential backoff
4. **Security Headers**: Automatic injection of security headers
5. **Input Validation**: Comprehensive input sanitization
6. **Audit Logging**: Complete audit trail for compliance
7. **Session Security**: Secure session token management

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html
```

## 📊 Monitoring

### Log Files
- `logs/security.log`: Security events and authentication attempts
- `logs/audit.log`: User actions and administrative activities
- `logs/application.log`: General application logs

### Health Check
- `GET /api/health`: Basic system health
- `GET /api/auth/admin/health`: Comprehensive system health (admin only)

## 🔄 Database Migrations

The enhanced authentication system includes new database tables:

1. **Enhanced User Table**: Added fields for dual authentication
2. **Login Attempts**: Security audit trail
3. **User Sessions**: Active session management
4. **AD Sync Logs**: Synchronization tracking

Run the migration:
```bash
alembic upgrade head
```

## 📈 Features Implemented

✅ **Dual Authentication System**  
✅ **User Type Detection**  
✅ **JWT-based Authentication**  
✅ **Role-Based Access Control**  
✅ **Active Directory Integration**  
✅ **Account Lockout System**  
✅ **Rate Limiting**  
✅ **Security Logging**  
✅ **Session Management**  
✅ **Automated User Sync**  
✅ **Password Policy Enforcement**  
✅ **Comprehensive API Documentation**  
✅ **Health Monitoring**  
✅ **Database Migrations**  

## 🚨 Important Notes

1. **Active Directory Setup**: Ensure your AD service account has appropriate read permissions
2. **Security**: Always use HTTPS in production
3. **Monitoring**: Regularly check security logs for suspicious activity
4. **Backups**: Implement regular database backups
5. **Updates**: Keep dependencies updated for security patches

## 🤝 Next Steps

1. Update your `.env` file with actual configuration values
2. Run the database migrations
3. Test the authentication endpoints
4. Configure Active Directory integration
5. Set up monitoring and logging
6. Deploy to production with proper security measures

For questions or support, please refer to the comprehensive documentation or create an issue in the repository.
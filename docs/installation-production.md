# Installation and Production Setup Guide

This guide covers the complete installation process and production deployment setup for the University Lost & Found System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Python**: 3.9 or higher (3.11+ recommended)
- **Operating System**: Linux, macOS, or Windows
- **Database**: SQLite (default) or PostgreSQL (for production)
- **Memory**: Minimum 2GB RAM (4GB+ recommended for production)
- **Disk Space**: Minimum 1GB free space

### Required Software

1. **Python 3.9+**
   ```bash
   python --version  # Should show 3.9 or higher
   ```

2. **pip** (Python package manager)
   ```bash
   pip --version
   ```

3. **PostgreSQL** (Optional - only if using PostgreSQL instead of SQLite)
   ```bash
   # macOS
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

4. **Git** (for cloning the repository)
   ```bash
   git --version
   ```

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd customized-mfqod
```

### 2. Create Virtual Environment

**On macOS/Linux:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**On Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

### 3. Install Dependencies

#### Option A: Install All Dependencies (Recommended)

```bash
# Make sure you're in the backend directory with venv activated
pip install --upgrade pip
pip install -r requirements.txt
```

#### Option B: Install Core Dependencies Only

If you encounter issues with optional dependencies, install core packages first:

```bash
# Core FastAPI and web framework
pip install fastapi==0.104.1 uvicorn[standard]==0.24.0 python-multipart==0.0.6

# Database
pip install sqlalchemy==2.0.23 alembic==1.12.1

# Authentication and Security
pip install python-jose[cryptography]==3.3.0 passlib[bcrypt]==1.7.4 bcrypt==4.1.2 cryptography==41.0.7

# Rate Limiting
pip install slowapi==0.1.9

# Data validation
pip install pydantic[email]==2.5.0 email-validator==2.1.0

# Environment configuration
pip install python-dotenv==1.0.0 python-decouple==3.8

# Then install remaining dependencies
pip install -r requirements.txt
```

#### Option C: Install PostgreSQL Driver (If Using PostgreSQL)

If you're using PostgreSQL instead of SQLite, uncomment and install:

```bash
# First, uncomment psycopg2-binary in requirements.txt:
# Change: # psycopg2-binary==2.9.9
# To:     psycopg2-binary==2.9.9

# Then install
pip install psycopg2-binary==2.9.9

# Or if you have PostgreSQL development libraries installed:
pip install psycopg2-binary==2.9.9
```

**Note for macOS**: If you get `pg_config` errors, install PostgreSQL first:
```bash
brew install postgresql
export PATH="/usr/local/opt/postgresql/bin:$PATH"
pip install psycopg2-binary==2.9.9
```

### 4. Verify Installation

```bash
# Check if key packages are installed
python -c "import fastapi; print('FastAPI:', fastapi.__version__)"
python -c "import slowapi; print('slowapi installed successfully')"
python -c "import sqlalchemy; print('SQLAlchemy:', sqlalchemy.__version__)"
```

## Environment Configuration

### 1. Copy Environment Template

```bash
cd backend
cp SQU_LDAP_CONFIG.env .env
```

### 2. Configure Environment Variables

Edit `.env` file with your production settings:

```env
# Database Configuration
DATABASE_URL=sqlite:///./mfqod.db  # For SQLite
# OR for PostgreSQL:
# DATABASE_URL=postgresql://username:password@localhost:5432/lost_found_db

# JWT Security
SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=480
JWT_EXPIRY_HOURS=8

# Rate Limiting Configuration
ENABLE_GLOBAL_RATE_LIMIT=true
PUBLIC_API_RATE_LIMIT_PER_MINUTE=30
AUTHENTICATED_API_RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_WINDOW_MINUTES=1

# Active Directory (if using LDAP)
AD_SERVER=ldap.squ.edu.om
AD_PORT=636
AD_USE_SSL=true
AD_BASE_DN=DC=squ,DC=edu,DC=om
AD_USER_DN=OU=Users,DC=squ,DC=edu,DC=om
AD_BIND_USER=CN=ServiceAccount,OU=Service Accounts,DC=squ,DC=edu,DC=om
AD_BIND_PASSWORD=your-service-account-password

# Email Configuration
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-character-app-password
SMTP_TLS=true
MAIL_FROM=your-email@gmail.com
MAIL_FROM_NAME="SQU Lost & Found System"

# Application Settings
DEBUG=false
LOG_LEVEL=INFO
```

### 3. Security Checklist

- [ ] Change `SECRET_KEY` to a strong random string
- [ ] Update `AD_BIND_PASSWORD` with actual service account password
- [ ] Set `DEBUG=false` for production
- [ ] Configure proper CORS origins in `auth_config.py`
- [ ] Use strong database passwords if using PostgreSQL
- [ ] Enable HTTPS in production
- [ ] Set up proper firewall rules

## Database Setup

### SQLite (Default - Development)

SQLite requires no additional setup. The database file will be created automatically on first run.

```bash
# Database file will be created at: backend/mfqod.db
# Make sure the backend directory is writable
```

### PostgreSQL (Production Recommended)

1. **Create Database**:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE lost_found_db;
CREATE USER lost_found_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE lost_found_db TO lost_found_user;
\q
```

2. **Update DATABASE_URL in .env**:
```env
DATABASE_URL=postgresql://lost_found_user:secure_password@localhost:5432/lost_found_db
```

3. **Run Migrations**:
```bash
cd backend
alembic upgrade head
```

### Initialize Database Schema

```bash
cd backend

# Run database migrations
alembic upgrade head

# Initialize roles and permissions (if needed)
python setup_permissions.py
```

## Production Deployment

### 1. Application Structure

```
backend/
├── app/
│   ├── main.py              # Application entry point
│   ├── config/              # Configuration files
│   ├── models.py            # Database models
│   ├── routes/              # API routes
│   ├── services/           # Business logic
│   └── middleware/         # Middleware (rate limiting, auth)
├── .env                     # Environment variables (DO NOT COMMIT)
├── requirements.txt         # Python dependencies
└── alembic.ini              # Database migration config
```

### 2. Run Database Migrations

```bash
cd backend
alembic upgrade head
```

### 3. Start the Application

#### Development Mode

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Production Mode with Gunicorn

```bash
cd backend
source venv/bin/activate

# Using Gunicorn with Uvicorn workers
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
```

### 4. Systemd Service (Linux)

Create `/etc/systemd/system/lost-found-api.service`:

```ini
[Unit]
Description=University Lost & Found API
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/path/to/customized-mfqod/backend
Environment="PATH=/path/to/customized-mfqod/backend/venv/bin"
ExecStart=/path/to/customized-mfqod/backend/venv/bin/gunicorn \
    -w 4 -k uvicorn.workers.UvicornWorker app.main:app \
    --bind 127.0.0.1:8000 \
    --timeout 120
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable lost-found-api
sudo systemctl start lost-found-api
sudo systemctl status lost-found-api
```


### Performance

- [ ] Use PostgreSQL for production (not SQLite)
- [ ] Configure database connection pooling
- [ ] Set up Redis for caching (optional)
- [ ] Enable gzip compression in Nginx
- [ ] Configure proper logging levels
- [ ] Set up log rotation

### Monitoring

- [ ] Set up application monitoring (e.g., Sentry, New Relic)
- [ ] Configure health check endpoints
- [ ] Set up database backups
- [ ] Monitor rate limiting metrics
- [ ] Set up alerting for errors

### Backup

- [ ] Configure automated database backups
- [ ] Backup uploaded files in `storage/uploads/`
- [ ] Test backup restoration process
- [ ] Document backup procedures

## Troubleshooting

### Common Issues

#### 1. ModuleNotFoundError: No module named 'slowapi'

**Solution:**
```bash
pip install slowapi==0.1.9
```

#### 2. psycopg2-binary Installation Fails

**Solution:**
- If using SQLite: Comment out `psycopg2-binary` in `requirements.txt` (already done)
- If using PostgreSQL: Install PostgreSQL development libraries first:
  ```bash
  # macOS
  brew install postgresql
  
  # Ubuntu/Debian
  sudo apt-get install libpq-dev python3-dev
  ```

#### 3. Database Connection Errors

**Solution:**
- Verify `DATABASE_URL` in `.env` is correct
- Check database server is running (if PostgreSQL)
- Verify database credentials
- Check network connectivity

#### 4. Rate Limiting Not Working

**Solution:**
- Verify `ENABLE_GLOBAL_RATE_LIMIT=true` in `.env`
- Check that `slowapi` is installed
- Verify middleware is initialized in `main.py`
- Check application logs for errors

#### 5. Active Directory Authentication Fails

**Solution:**
- Verify AD server is reachable
- Check `AD_BIND_USER` and `AD_BIND_PASSWORD` are correct
- Verify network connectivity to AD server
- Check firewall rules allow LDAP/LDAPS traffic

#### 6. Import Errors

**Solution:**
- Ensure virtual environment is activated
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.9+)

### Getting Help

1. Check application logs in `backend/logs/`
2. Review error messages in terminal output
3. Verify environment variables are set correctly
4. Check database connection and migrations
5. Review API documentation at `/api/docs` when server is running

## Quick Start Commands

```bash
# 1. Setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Configure
cp SQU_LDAP_CONFIG.env .env
# Edit .env with your settings

# 3. Database
alembic upgrade head

# 4. Run
uvicorn app.main:app --reload
```

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [slowapi Documentation](https://github.com/laurents/slowapi)

---

**Last Updated**: 2026-02-8
**Version**: 2.0.0































# LDAP Test Server Setup Guide

This guide explains how to set up and use a Docker-based OpenLDAP test server for testing LDAP/AD authentication functionality without accessing the production SQU AD server.

## Overview

The test LDAP server runs in a Docker container and provides a local LDAP environment that mimics the structure of SQU's Active Directory. This allows you to:

- Test LDAP authentication without production access
- Develop and debug LDAP integration locally
- Test user sync and authentication flows
- Verify LDAP configuration changes

## Prerequisites

- Docker and Docker Compose installed
- Python 3.x with `python-ldap` package
- Access to the project repository

## Quick Start

### 1. Start the Test LDAP Server

```bash
# From the project root directory
docker-compose -f docker-compose.test-ldap.yml up -d
```

### 2. Initialize the LDAP Server with Test Data

```bash
# Run the initialization script
bash backend/scripts/init-test-ldap.sh
```

This script will:
- Start the Docker containers
- Wait for LDAP to be ready
- Import test users and groups
- Verify the setup

### 3. Configure Your Application

Copy the test environment configuration:

```bash
# Option 1: Copy .env.test to .env (backup your current .env first!)
cp backend/.env backend/.env.production  # Backup
cp backend/.env.test backend/.env

# Option 2: Set environment variables manually
export AD_SERVER=localhost
export AD_PORT=1389
export AD_USE_SSL=false
export AD_BIND_USER="cn=admin,dc=squ,dc=edu,dc=om"
export AD_BIND_PASSWORD=admin123
```

### 4. Test the Connection

```bash
# Run the test script
python backend/test_ldap_connection.py
```

### 5. Test Authentication via API

Start your application and test login:

```bash
# Test login with a test user
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
       "email_or_username": "s133705",
       "password": "test123"
     }'
```

## Test User Credentials

The following test users are pre-configured in the test LDAP server:

| Username | Password | Type | Email | DN |
|----------|----------|------|-------|-----|
| `s133705` | `test123` | Student | s133705@student.squ.edu.om | CN=s133705,ou=Students,ou=Users,dc=squ,dc=edu,dc=om |
| `staff001` | `test123` | Staff | staff001@squ.edu.om | CN=staff001,ou=Staff,ou=Users,dc=squ,dc=edu,dc=om |
| `admin` | `admin123` | Admin | admin@squ.edu.om | CN=admin,ou=Staff,ou=Users,dc=squ,dc=edu,dc=om |
| `s123456` | `test123` | Student | s123456@student.squ.edu.om | CN=s123456,ou=Students,ou=Users,dc=squ,dc=edu,dc=om |

**Service Account** (for LDAP binding):
- DN: `cn=ServiceAccount,ou=Service Accounts,dc=squ,dc=edu,dc=om`
- Password: `test123`

**LDAP Admin Account**:
- DN: `cn=admin,dc=squ,dc=edu,dc=om`
- Password: `admin123`

## Server Information

- **LDAP Port**: `1389` (non-SSL)
- **LDAPS Port**: `1636` (SSL)
- **Base DN**: `dc=squ,dc=edu,dc=om`
- **Users DN**: `ou=Users,dc=squ,dc=edu,dc=om`
- **Groups DN**: `ou=Groups,dc=squ,dc=edu,dc=om`

## Web Interface

A phpLDAPadmin interface is available for managing the LDAP server:

- **URL**: http://localhost:8080
- **Login DN**: `cn=admin,dc=squ,dc=edu,dc=om`
- **Password**: `admin123`

## Configuration Files

### Environment Configuration

The test environment uses `backend/.env.test` which contains:

```bash
AD_SERVER=localhost
AD_PORT=1389
AD_USE_SSL=false
AD_BASE_DN=dc=squ,dc=edu,dc=om
AD_USER_DN=ou=Users,dc=squ,dc=edu,dc=om
AD_BIND_USER=cn=ServiceAccount,ou=Service Accounts,dc=squ,dc=edu,dc=om
AD_BIND_PASSWORD=test123
```

### LDIF Files

Test data is defined in LDIF files located in `backend/ldap-test-data/`:

- `01-base.ldif` - Base domain structure and organizational units
- `02-users.ldif` - Test user accounts
- `03-groups.ldif` - Test groups and group memberships

## Switching Between Test and Production

### To Use Test LDAP:

1. Backup your production `.env`:
   ```bash
   cp backend/.env backend/.env.production
   ```

2. Use test configuration:
   ```bash
   cp backend/.env.test backend/.env
   ```

3. Start test LDAP server:
   ```bash
   docker-compose -f docker-compose.test-ldap.yml up -d
   ```

### To Switch Back to Production:

1. Stop test LDAP server:
   ```bash
   docker-compose -f docker-compose.test-ldap.yml down
   ```

2. Restore production `.env`:
   ```bash
   cp backend/.env.production backend/.env
   ```

## Managing the Test LDAP Server

### Start the Server

```bash
docker-compose -f docker-compose.test-ldap.yml up -d
```

### Stop the Server

```bash
docker-compose -f docker-compose.test-ldap.yml down
```

### View Logs

```bash
# LDAP server logs
docker logs test-ldap-server

# Follow logs
docker logs -f test-ldap-server

# phpLDAPadmin logs
docker logs test-ldap-admin
```

### Restart the Server

```bash
docker-compose -f docker-compose.test-ldap.yml restart
```

### Remove All Data (Fresh Start)

```bash
# Stop and remove containers and volumes
docker-compose -f docker-compose.test-ldap.yml down -v

# Start fresh
docker-compose -f docker-compose.test-ldap.yml up -d
bash backend/scripts/init-test-ldap.sh
```

## Adding More Test Users

### Method 1: Using LDIF File

1. Create a new LDIF file (e.g., `04-additional-users.ldif`) in `backend/ldap-test-data/`:

```ldif
dn: CN=newuser,ou=Students,ou=Users,dc=squ,dc=edu,dc=om
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
objectClass: posixAccount
cn: newuser
sn: New
givenName: User
displayName: New Test User
mail: newuser@student.squ.edu.om
userPassword: {SSHA}test123
sAMAccountName: newuser
uid: newuser
uidNumber: 10003
gidNumber: 10003
homeDirectory: /home/newuser
employeeID: NEW001
department: Computer Science
title: Student
userAccountControl: 512
accountExpires: 0
```

2. Import the LDIF file:

```bash
docker exec -i test-ldap-server ldapadd -x -H ldap://localhost:389 \
    -D "cn=admin,dc=squ,dc=edu,dc=om" \
    -w admin123 < backend/ldap-test-data/04-additional-users.ldif
```

### Method 2: Using phpLDAPadmin

1. Open http://localhost:8080
2. Login with admin credentials
3. Navigate to the Users OU
4. Create new user entries using the web interface

### Method 3: Using ldapadd Command

```bash
# Create a temporary LDIF file
cat > /tmp/newuser.ldif << EOF
dn: CN=newuser,ou=Students,ou=Users,dc=squ,dc=edu,dc=om
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
cn: newuser
sn: New
givenName: User
userPassword: {SSHA}test123
sAMAccountName: newuser
uid: newuser
EOF

# Import
docker exec -i test-ldap-server ldapadd -x -H ldap://localhost:389 \
    -D "cn=admin,dc=squ,dc=edu,dc=om" \
    -w admin123 < /tmp/newuser.ldif
```

## Testing Authentication

### Using the Test Script

```bash
python backend/test_ldap_connection.py
```

This script will:
- Test LDAP connection
- Test bind authentication
- Search for test users
- Test user authentication

### Using curl

```bash
# Test login endpoint
curl -X POST "http://localhost:8000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
       "email_or_username": "s133705",
       "password": "test123"
     }'
```

### Using Python

```python
import ldap

# Connect
conn = ldap.initialize("ldap://localhost:1389")
conn.simple_bind_s("cn=admin,dc=squ,dc=edu,dc=om", "admin123")

# Search
result = conn.search_s(
    "ou=Users,dc=squ,dc=edu,dc=om",
    ldap.SCOPE_SUBTREE,
    "(sAMAccountName=s133705)",
    ["cn", "mail", "displayName"]
)

# Authenticate
user_conn = ldap.initialize("ldap://localhost:1389")
user_conn.simple_bind_s("CN=s133705,ou=Students,ou=Users,dc=squ,dc=edu,dc=om", "test123")
print("Authentication successful!")
```

## Troubleshooting

### Container Won't Start

**Problem**: Docker container fails to start

**Solutions**:
- Check if ports 1389, 1636, or 8080 are already in use:
  ```bash
  lsof -i :1389
  lsof -i :1636
  lsof -i :8080
  ```
- Check Docker logs:
  ```bash
  docker logs test-ldap-server
  ```
- Ensure Docker has enough resources allocated

### Connection Refused

**Problem**: Cannot connect to LDAP server

**Solutions**:
- Verify container is running:
  ```bash
  docker ps | grep test-ldap-server
  ```
- Check if LDAP is ready:
  ```bash
  docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 \
      -b dc=squ,dc=edu,dc=om -D "cn=admin,dc=squ,dc=edu,dc=om" -w admin123
  ```
- Wait a few seconds after starting the container (it needs time to initialize)

### Authentication Fails

**Problem**: User authentication fails

**Solutions**:
- Verify user exists:
  ```bash
  docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 \
      -b "ou=Users,dc=squ,dc=edu,dc=om" \
      -D "cn=admin,dc=squ,dc=edu,dc=om" -w admin123 \
      "(sAMAccountName=s133705)"
  ```
- Check password (test users use `test123` or `admin123`)
- Verify user DN is correct
- Check userAccountControl attribute (should be 512 for enabled accounts)

### Search Returns No Results

**Problem**: User search finds no users

**Solutions**:
- Verify search base DN is correct: `ou=Users,dc=squ,dc=edu,dc=om`
- Check search filter syntax
- Try a broader search:
  ```bash
  docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 \
      -b "ou=Users,dc=squ,dc=edu,dc=om" \
      -D "cn=admin,dc=squ,dc=edu,dc=om" -w admin123 \
      "(objectClass=person)"
  ```

### SSL/TLS Errors

**Problem**: SSL connection fails

**Solutions**:
- For test environment, use non-SSL (port 1389):
  ```bash
  AD_USE_SSL=false
  AD_PORT=1389
  ```
- If using SSL, disable certificate verification:
  ```bash
  AD_VERIFY_SSL=false
  ```

### Data Not Persisting

**Problem**: Users disappear after container restart

**Solutions**:
- Check if volumes are properly mounted:
  ```bash
  docker volume ls | grep ldap
  ```
- Ensure you're not using `docker-compose down -v` (this removes volumes)
- Data should persist in Docker volumes: `test-ldap-server_ldap-data` and `test-ldap-server_ldap-config`

## Safety Measures

The test LDAP setup is designed to be completely isolated from production:

1. **Separate Ports**: Uses ports 1389/1636 instead of 389/636 to avoid conflicts
2. **Separate Configuration**: Uses `.env.test` file, separate from production `.env`
3. **Docker Isolation**: Runs in separate containers with isolated network
4. **No Code Changes**: Existing code uses environment variables - no modifications needed
5. **Clear Documentation**: This guide helps prevent accidental production usage

## Production Deployment

**IMPORTANT**: Never use the test LDAP configuration in production!

Before deploying to production:
1. Ensure `.env` contains production LDAP settings
2. Verify `AD_SERVER` points to production server
3. Verify `AD_PORT` uses production port (636 for LDAPS)
4. Verify `AD_USE_SSL=true` for production
5. Verify production service account credentials are set

## Additional Resources

- [OpenLDAP Documentation](https://www.openldap.org/doc/)
- [LDAP Search Filters](https://ldap.com/ldap-filters/)
- [phpLDAPadmin Guide](https://www.phpldapadmin.org/docs/)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Docker container logs
3. Verify environment configuration
4. Test with the provided test script
5. Check the application logs for detailed error messages




































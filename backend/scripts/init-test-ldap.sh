#!/bin/bash

# Initialize Test LDAP Server
# This script starts the Docker OpenLDAP container and imports test data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/../docker-compose.test-ldap.yml"

echo "=========================================="
echo "Test LDAP Server Initialization"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: docker-compose is not installed. Please install docker-compose."
    exit 1
fi

# Determine docker-compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo ""
echo "Step 1: Starting Docker containers..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

echo ""
echo "Step 2: Waiting for LDAP server to be ready..."
MAX_WAIT=60
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 -b dc=squ,dc=edu,dc=om -D "cn=admin,dc=squ,dc=edu,dc=om" -w admin123 > /dev/null 2>&1; then
        echo "✓ LDAP server is ready!"
        break
    fi
    echo "  Waiting for LDAP server... ($WAIT_COUNT/$MAX_WAIT seconds)"
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "ERROR: LDAP server did not become ready within $MAX_WAIT seconds"
    echo "Check container logs: docker logs test-ldap-server"
    exit 1
fi

echo ""
echo "Step 3: Checking if data already exists..."
EXISTING_USERS=$(docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 -b "ou=Users,dc=squ,dc=edu,dc=om" -D "cn=admin,dc=squ,dc=edu,dc=om" -w admin123 2>/dev/null | grep -c "dn:" || echo "0")

if [ "$EXISTING_USERS" -gt "1" ]; then
    echo "⚠ Data already exists in LDAP server."
    read -p "Do you want to re-import data? This will add duplicate entries. (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping data import. Using existing data."
        echo ""
        echo "=========================================="
        echo "✓ Test LDAP server is ready!"
        echo "=========================================="
        echo ""
        echo "Server: localhost:1389"
        echo "Admin DN: cn=admin,dc=squ,dc=edu,dc=om"
        echo "Admin Password: admin123"
        echo ""
        echo "Test users available:"
        echo "  - s133705 / test123"
        echo "  - staff001 / test123"
        echo "  - admin / admin123"
        echo ""
        exit 0
    fi
fi

echo ""
echo "Step 4: Importing LDIF files..."
LDIF_DIR="$PROJECT_ROOT/ldap-test-data"

if [ ! -d "$LDIF_DIR" ]; then
    echo "ERROR: LDIF directory not found: $LDIF_DIR"
    exit 1
fi

# Import LDIF files in order
for ldif_file in "$LDIF_DIR"/01-base.ldif "$LDIF_DIR"/02-users.ldif "$LDIF_DIR"/03-groups.ldif; do
    if [ -f "$ldif_file" ]; then
        echo "  Importing $(basename "$ldif_file")..."
        docker exec -i test-ldap-server ldapadd -x -H ldap://localhost:389 \
            -D "cn=admin,dc=squ,dc=edu,dc=om" \
            -w admin123 \
            < "$ldif_file" 2>&1 | grep -v "Already exists" || true
        echo "  ✓ $(basename "$ldif_file") imported"
    else
        echo "  ⚠ File not found: $ldif_file"
    fi
done

echo ""
echo "Step 5: Verifying imported data..."
USER_COUNT=$(docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 \
    -b "ou=Users,dc=squ,dc=edu,dc=om" \
    -D "cn=admin,dc=squ,dc=edu,dc=om" \
    -w admin123 \
    2>/dev/null | grep -c "^dn:" || echo "0")

GROUP_COUNT=$(docker exec test-ldap-server ldapsearch -x -H ldap://localhost:389 \
    -b "ou=Groups,dc=squ,dc=edu,dc=om" \
    -D "cn=admin,dc=squ,dc=edu,dc=om" \
    -w admin123 \
    2>/dev/null | grep -c "^dn:" || echo "0")

echo "  Users found: $USER_COUNT"
echo "  Groups found: $GROUP_COUNT"

echo ""
echo "=========================================="
echo "✓ Test LDAP server initialization complete!"
echo "=========================================="
echo ""
echo "Server Information:"
echo "  LDAP: localhost:1389"
echo "  LDAPS: localhost:1636"
echo "  Admin DN: cn=admin,dc=squ,dc=edu,dc=om"
echo "  Admin Password: admin123"
echo ""
echo "Service Account:"
echo "  DN: cn=ServiceAccount,ou=Service Accounts,dc=squ,dc=edu,dc=om"
echo "  Password: test123"
echo ""
echo "Test Users:"
echo "  Student: s133705 / test123"
echo "  Staff: staff001 / test123"
echo "  Admin: admin / admin123"
echo ""
echo "Web Interface:"
echo "  phpLDAPadmin: http://localhost:8080"
echo "  Login DN: cn=admin,dc=squ,dc=edu,dc=om"
echo "  Password: admin123"
echo ""
echo "Next Steps:"
echo "  1. Update your .env file with test LDAP settings (see .env.test)"
echo "  2. Test authentication: python backend/test_ldap_connection.py"
echo "  3. Start your application and test login"
echo ""




































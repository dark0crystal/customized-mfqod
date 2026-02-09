#!/usr/bin/env python3
"""
Permissions & Roles Setup Script

This script initializes the complete permission and role structure for the application.
Run once during production deployment or after migrations.

Usage:
    cd backend
    python setup_permissions.py

Prerequisites:
    - DATABASE_URL environment variable must be set (e.g. in .env)
    - Database must exist and migrations applied (alembic upgrade head)
    - Tables: permissions, role, role_permissions must exist

What this script does:
    1. Inserts all 15 required permissions (skips duplicates)
    2. Creates three roles: super_admin, moderator, user
    3. Assigns ALL permissions to super_admin
    4. Assigns item-management permissions to moderator
    5. Assigns NO permissions to user (basic authenticated user)
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import uuid

# Load environment variables
load_dotenv()

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL environment variable is not set")
    sys.exit(1)

# Create database engine
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# =============================================================================
# PERMISSIONS - All 15 permissions used by the application
# =============================================================================
PERMISSIONS = [
    # Item management
    {
        "name": "can_manage_items",
        "description": "Full item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own items.",
    },
    {
        "name": "can_manage_missing_items",
        "description": "Full missing item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own missing items.",
    },
    {
        "name": "can_manage_item_types",
        "description": "Full item type management (create, view, edit, delete)",
    },
    # Claims & transfer requests
    {
        "name": "can_manage_claims",
        "description": "Full claim management (view, create, process/approve/reject)",
    },
    {
        "name": "can_manage_transfer_requests",
        "description": "Full transfer request management (create, view, approve, reject)",
    },
    # Organizations, branches, addresses
    {
        "name": "can_manage_branches",
        "description": "Full branch management (create, view, edit, delete, manage managers)",
    },
    {
        "name": "can_manage_addresses",
        "description": "Full address management (create, view, edit, delete)",
    },
    {
        "name": "can_manage_organizations",
        "description": "Full organization management (create, view, edit, delete)",
    },
    # User management
    {
        "name": "can_manage_users",
        "description": "Full user management access (create, view, edit, delete)",
    },
    # System & admin
    {
        "name": "can_view_system_logs",
        "description": "Can view system logs",
    },
    {
        "name": "can_view_audit_logs",
        "description": "Can view audit logs and audit trail",
    },
    {
        "name": "can_manage_roles",
        "description": "Can create, edit, delete roles",
    },
    {
        "name": "can_manage_permissions",
        "description": "Can manage permission assignments to roles",
    },
    {
        "name": "can_view_analytics",
        "description": "Can view system analytics and statistics",
    },
    {
        "name": "can_configure_system",
        "description": "Can configure system settings",
    },
]

# =============================================================================
# ROLES - super_admin, moderator, user
# =============================================================================
ROLES = [
    {
        "name": "super_admin",
        "description": "Full system access. All permissions granted.",
    },
    {
        "name": "moderator",
        "description": "Content moderator. Can manage items, missing items, claims, item types, transfer requests, and view analytics.",
    },
    {
        "name": "user",
        "description": "Basic authenticated user. No admin permissions. Can report items and claim their own.",
    },
]

# Permissions assigned to moderator (item management only)
MODERATOR_PERMISSIONS = [
    "can_manage_items",
    "can_manage_missing_items",
    "can_manage_item_types",
    "can_manage_claims",
    "can_manage_transfer_requests",
    "can_view_analytics",
]


def setup_permissions(session):
    """Insert all permissions. Skips duplicates."""
    created = 0
    skipped = 0
    current_time = datetime.now(timezone.utc)

    for perm in PERMISSIONS:
        result = session.execute(
            text("SELECT id FROM permissions WHERE name = :name"),
            {"name": perm["name"]},
        ).fetchone()

        if result:
            print(f"  ⏭️  Skipped permission: {perm['name']}")
            skipped += 1
            continue

        session.execute(
            text("""
                INSERT INTO permissions (id, name, description, created_at, updated_at)
                VALUES (:id, :name, :description, :created_at, :updated_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "name": perm["name"],
                "description": perm.get("description"),
                "created_at": current_time,
                "updated_at": current_time,
            },
        )
        print(f"  ✅ Created permission: {perm['name']}")
        created += 1

    return created, skipped


def setup_roles(session):
    """Create super_admin, moderator, user roles. Skips if exist."""
    created = 0
    skipped = 0
    current_time = datetime.now(timezone.utc)

    for role in ROLES:
        result = session.execute(
            text("SELECT id FROM role WHERE name = :name"),
            {"name": role["name"]},
        ).fetchone()

        if result:
            print(f"  ⏭️  Skipped role: {role['name']}")
            skipped += 1
            continue

        session.execute(
            text("""
                INSERT INTO role (id, name, description, created_at, updated_at)
                VALUES (:id, :name, :description, :created_at, :updated_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "name": role["name"],
                "description": role.get("description"),
                "created_at": current_time,
                "updated_at": current_time,
            },
        )
        print(f"  ✅ Created role: {role['name']}")
        created += 1

    return created, skipped


def setup_role_permissions(session):
    """Assign permissions to super_admin and moderator."""
    # Super admin: all permissions
    super_admin_result = session.execute(
        text("SELECT id FROM role WHERE name = 'super_admin'")
    ).fetchone()
    if not super_admin_result:
        print("  ⚠️  super_admin role not found, skipping permission assignment")
        return

    super_admin_id = super_admin_result[0]
    all_perms = session.execute(text("SELECT id, name FROM permissions")).fetchall()

    for perm_id, perm_name in all_perms:
        existing = session.execute(
            text("""
                SELECT 1 FROM role_permissions
                WHERE role_id = :role_id AND permission_id = :perm_id
            """),
            {"role_id": super_admin_id, "perm_id": perm_id},
        ).fetchone()
        if not existing:
            session.execute(
                text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                """),
                {"role_id": super_admin_id, "permission_id": perm_id},
            )
    print(f"  ✅ Assigned {len(all_perms)} permissions to super_admin")

    # Moderator: item management permissions only
    moderator_result = session.execute(
        text("SELECT id FROM role WHERE name = 'moderator'")
    ).fetchone()
    if not moderator_result:
        print("  ⚠️  moderator role not found")
        return

    moderator_id = moderator_result[0]
    moderator_perm_ids = []
    for name in MODERATOR_PERMISSIONS:
        row = session.execute(
            text("SELECT id FROM permissions WHERE name = :name"),
            {"name": name},
        ).fetchone()
        if row:
            moderator_perm_ids.append(row[0])

    assigned = 0
    for perm_id in moderator_perm_ids:
        existing = session.execute(
            text("""
                SELECT 1 FROM role_permissions
                WHERE role_id = :role_id AND permission_id = :perm_id
            """),
            {"role_id": moderator_id, "perm_id": perm_id},
        ).fetchone()
        if not existing:
            session.execute(
                text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                """),
                {"role_id": moderator_id, "permission_id": perm_id},
            )
            assigned += 1
    print(f"  ✅ Assigned {len(moderator_perm_ids)} permissions to moderator")

    # User role: no permissions (nothing to do)


def verify_setup(session):
    """Verify permissions and roles were set up correctly."""
    print("\n🔍 Verifying setup...")

    perm_count = session.execute(text("SELECT COUNT(*) FROM permissions")).scalar()
    expected_perms = len(PERMISSIONS)
    if perm_count >= expected_perms:
        print(f"  ✅ Permissions: {perm_count} (expected {expected_perms})")
    else:
        print(f"  ⚠️  Permissions: {perm_count} (expected {expected_perms})")

    for role_name in ["super_admin", "moderator", "user"]:
        row = session.execute(
            text("""
                SELECT r.name, COUNT(rp.permission_id) as perm_count
                FROM role r
                LEFT JOIN role_permissions rp ON r.id = rp.role_id
                WHERE r.name = :name
                GROUP BY r.name
            """),
            {"name": role_name},
        ).fetchone()
        if row:
            print(f"  ✅ Role {row[0]}: {row[1]} permissions")
        else:
            print(f"  ⚠️  Role {role_name}: not found")


def main():
    print("=" * 60)
    print("🚀 PERMISSIONS & ROLES SETUP")
    print("=" * 60)
    print("\nThis script will:")
    print("  1. Create 15 permissions")
    print("  2. Create roles: super_admin, moderator, user")
    print("  3. Assign all permissions to super_admin")
    print("  4. Assign 6 permissions to moderator (item management)")
    print("  5. Leave user role with no permissions\n")

    # Test database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful\n")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

    session = SessionLocal()
    try:
        # 1. Permissions
        print("📋 Section 1: Permissions")
        setup_permissions(session)

        # 2. Roles
        print("\n👥 Section 2: Roles")
        setup_roles(session)
        session.commit()

        # 3. Role permissions
        print("\n🔗 Section 3: Role-Permission assignments")
        setup_role_permissions(session)
        session.commit()

        # 4. Verify
        verify_setup(session)

        print("\n" + "=" * 60)
        print("🎉 Setup completed successfully!")
        print("=" * 60)

    except Exception as e:
        session.rollback()
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()

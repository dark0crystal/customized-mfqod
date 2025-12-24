#!/usr/bin/env python3
"""
Production Setup Script: Initialize Permissions

This script adds all required permissions to the database.
Run this script once during production deployment to ensure all permissions exist.

Usage:
    python setup_permissions.py

The script will:
1. Connect to the database
2. Insert all required permissions (skipping duplicates)
3. Print a summary of operations
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

# Define all permissions required by the application
# Using hierarchical permission model: "manage" permissions imply all CRUD operations
PERMISSIONS = [
    # ============================================
    # ITEMS PERMISSIONS
    # ============================================
    {
        "name": "can_manage_items",
        "description": "Full item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own items."
    },
    
    # ============================================
    # MISSING ITEMS PERMISSIONS
    # ============================================
    {
        "name": "can_manage_missing_items",
        "description": "Full missing item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own missing items."
    },
    
    # ============================================
    # ITEM TYPES PERMISSIONS
    # ============================================
    {
        "name": "can_manage_item_types",
        "description": "Full item type management (create, view, edit, delete)"
    },
    
    # ============================================
    # BRANCHES PERMISSIONS
    # ============================================
    {
        "name": "can_manage_branches",
        "description": "Full branch management (create, view, edit, delete, manage managers)"
    },
    
    # ============================================
    # ADDRESSES PERMISSIONS
    # ============================================
    {
        "name": "can_manage_addresses",
        "description": "Full address management (create, view, edit, delete)"
    },
    
    # ============================================
    # ORGANIZATIONS PERMISSIONS
    # ============================================
    {
        "name": "can_manage_organizations",
        "description": "Full organization management (create, view, edit, delete)"
    },
    
    # ============================================
    # USERS PERMISSIONS
    # ============================================
    {
        "name": "can_manage_users",
        "description": "Full user management access (create, view, edit, delete)"
    },
    
    # ============================================
    # CLAIMS PERMISSIONS
    # ============================================
    {
        "name": "can_manage_claims",
        "description": "Full claim management (view, create, process/approve/reject)"
    },
    
    # ============================================
    # TRANSFER REQUESTS PERMISSIONS
    # ============================================
    {
        "name": "can_manage_transfer_requests",
        "description": "Full transfer request management (create, view, approve, reject)"
    },
    
    # ============================================
    # SYSTEM & ADMIN PERMISSIONS
    # ============================================
    {
        "name": "admin",
        "description": "Admin access - full system access"
    },
    {
        "name": "can_view_system_logs",
        "description": "Can view system logs"
    },
    {
        "name": "can_manage_roles",
        "description": "Can create/edit/delete roles"
    },
    {
        "name": "can_manage_permissions",
        "description": "Can manage permission assignments"
    },
    {
        "name": "can_view_analytics",
        "description": "Can view system analytics and statistics"
    },
    {
        "name": "can_configure_system",
        "description": "Can configure system settings"
    },
    {
        "name": "can_access_admin",
        "description": "Can access admin panel"
    },
]


def setup_permissions():
    """
    Insert all permissions into the database.
    Skips permissions that already exist (based on unique name constraint).
    """
    session = SessionLocal()
    created_count = 0
    skipped_count = 0
    errors = []
    
    try:
        print("🔄 Starting permission setup...")
        print(f"📋 Total permissions to process: {len(PERMISSIONS)}\n")
        
        current_time = datetime.now(timezone.utc)
        
        for perm in PERMISSIONS:
            try:
                # Check if permission already exists
                check_query = text("""
                    SELECT id FROM permissions 
                    WHERE name = :name
                """)
                result = session.execute(check_query, {"name": perm["name"]}).fetchone()
                
                if result:
                    print(f"⏭️  Skipped: {perm['name']} (already exists)")
                    skipped_count += 1
                    continue
                
                # Generate UUID for the permission
                permission_id = str(uuid.uuid4())
                
                # Insert new permission
                insert_query = text("""
                    INSERT INTO permissions (id, name, description, created_at, updated_at)
                    VALUES (:id, :name, :description, :created_at, :updated_at)
                """)
                
                session.execute(insert_query, {
                    "id": permission_id,
                    "name": perm["name"],
                    "description": perm.get("description"),
                    "created_at": current_time,
                    "updated_at": current_time
                })
                
                print(f"✅ Created: {perm['name']}")
                created_count += 1
                
            except Exception as e:
                error_msg = f"❌ Error processing {perm['name']}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        # Commit all changes
        session.commit()
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        print(f"✅ Created: {created_count} permissions")
        print(f"⏭️  Skipped: {skipped_count} permissions (already exist)")
        print(f"❌ Errors: {len(errors)}")
        
        if errors:
            print("\n⚠️  Errors encountered:")
            for error in errors:
                print(f"   {error}")
        
        if created_count > 0:
            print(f"\n✨ Successfully added {created_count} new permissions to the database!")
        else:
            print("\n✨ All permissions already exist in the database.")
        
        return True
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Fatal error: {str(e)}")
        return False
        
    finally:
        session.close()


def verify_permissions():
    """
    Verify that all required permissions exist in the database.
    """
    session = SessionLocal()
    
    try:
        print("\n🔍 Verifying permissions...")
        
        # Get all permission names from database
        query = text("SELECT name FROM permissions")
        db_permissions = {row[0] for row in session.execute(query).fetchall()}
        
        # Get all required permission names
        required_permissions = {perm["name"] for perm in PERMISSIONS}
        
        # Find missing permissions
        missing = required_permissions - db_permissions
        
        if missing:
            print(f"⚠️  Missing {len(missing)} permissions:")
            for perm in sorted(missing):
                print(f"   - {perm}")
            return False
        else:
            print("✅ All required permissions are present in the database!")
            return True
            
    except Exception as e:
        print(f"❌ Error during verification: {str(e)}")
        return False
        
    finally:
        session.close()


if __name__ == "__main__":
    print("="*60)
    print("🚀 PERMISSION SETUP SCRIPT")
    print("="*60)
    print()
    
    # Test database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful\n")
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        sys.exit(1)
    
    # Setup permissions
    success = setup_permissions()
    
    if success:
        # Verify permissions
        verify_permissions()
        print("\n" + "="*60)
        print("🎉 Permission setup completed!")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("❌ Permission setup failed!")
        print("="*60)
        sys.exit(1)







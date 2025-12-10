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
PERMISSIONS = [
    # ============================================
    # ITEMS PERMISSIONS
    # ============================================
    {
        "name": "can_create_items",
        "description": "Can create new lost/found items"
    },
    {
        "name": "can_view_items",
        "description": "Can view lost/found items"
    },
    {
        "name": "can_view_own_items",
        "description": "Can view own lost/found items"
    },
    {
        "name": "can_edit_items",
        "description": "Can edit item details"
    },
    {
        "name": "can_approve_items",
        "description": "Can approve/reject item reports"
    },
    {
        "name": "can_delete_items",
        "description": "Can delete items"
    },
    {
        "name": "can_restore_items",
        "description": "Can restore deleted items"
    },
    {
        "name": "can_bulk_delete_items",
        "description": "Can delete multiple items at once"
    },
    {
        "name": "can_bulk_edit_items",
        "description": "Can edit multiple items at once"
    },
    {
        "name": "can_manage_claims",
        "description": "Can manage item claims"
    },
    {
        "name": "can_view_statistics",
        "description": "Can view system statistics and analytics"
    },
    
    # ============================================
    # MISSING ITEMS PERMISSIONS
    # ============================================
    {
        "name": "can_create_missing_items",
        "description": "Can report missing items"
    },
    {
        "name": "can_view_missing_items",
        "description": "Can view missing items"
    },
    {
        "name": "can_view_own_missing_items",
        "description": "Can view own missing items"
    },
    {
        "name": "can_edit_missing_items",
        "description": "Can edit missing item details"
    },
    {
        "name": "can_approve_missing_items",
        "description": "Can approve/reject missing item reports"
    },
    {
        "name": "can_manage_missing_items",
        "description": "Can manage missing items"
    },
    {
        "name": "can_delete_missing_items",
        "description": "Can delete missing items"
    },
    {
        "name": "can_restore_missing_items",
        "description": "Can restore deleted missing items"
    },
    {
        "name": "can_bulk_delete_missing_items",
        "description": "Can delete multiple missing items at once"
    },
    {
        "name": "can_bulk_edit_missing_items",
        "description": "Can edit multiple missing items at once"
    },
    
    # ============================================
    # ITEM TYPES PERMISSIONS
    # ============================================
    {
        "name": "can_create_item_types",
        "description": "Can create new item types"
    },
    {
        "name": "can_view_item_types",
        "description": "Can view item types"
    },
    {
        "name": "can_edit_item_types",
        "description": "Can edit item types"
    },
    {
        "name": "can_delete_item_types",
        "description": "Can delete item types"
    },
    {
        "name": "can_manage_item_types",
        "description": "Full item type management access"
    },
    
    # ============================================
    # BRANCHES PERMISSIONS
    # ============================================
    {
        "name": "can_create_branches",
        "description": "Can create new branches"
    },
    {
        "name": "can_view_branches",
        "description": "Can view branches"
    },
    {
        "name": "can_edit_branches",
        "description": "Can edit branch details"
    },
    {
        "name": "can_delete_branches",
        "description": "Can delete branches"
    },
    {
        "name": "can_view_own_branches",
        "description": "Can view own managed branches"
    },
    {
        "name": "can_view_user_branches",
        "description": "Can view user branch assignments"
    },
    {
        "name": "can_assign_branch_managers",
        "description": "Can assign branch managers"
    },
    {
        "name": "can_remove_branch_managers",
        "description": "Can remove branch managers"
    },
    {
        "name": "can_view_branch_managers",
        "description": "Can view branch managers"
    },
    
    # ============================================
    # ADDRESSES PERMISSIONS
    # ============================================
    {
        "name": "can_create_addresses",
        "description": "Can create addresses"
    },
    {
        "name": "can_view_addresses",
        "description": "Can view addresses"
    },
    {
        "name": "can_edit_addresses",
        "description": "Can edit addresses"
    },
    {
        "name": "can_delete_addresses",
        "description": "Can delete addresses"
    },
    
    # ============================================
    # ORGANIZATIONS PERMISSIONS
    # ============================================
    {
        "name": "can_create_organizations",
        "description": "Can create new organizations"
    },
    {
        "name": "can_view_organizations",
        "description": "Can view organizations"
    },
    {
        "name": "can_edit_organizations",
        "description": "Can edit organization details"
    },
    {
        "name": "can_delete_organizations",
        "description": "Can delete organizations"
    },
    
    # ============================================
    # USERS PERMISSIONS
    # ============================================
    {
        "name": "can_view_users",
        "description": "Can view user profiles and lists"
    },
    {
        "name": "can_create_users",
        "description": "Can create new user accounts"
    },
    {
        "name": "can_edit_users",
        "description": "Can edit user profiles and settings"
    },
    {
        "name": "can_delete_users",
        "description": "Can delete user accounts"
    },
    {
        "name": "can_manage_users",
        "description": "Full user management access"
    },
    
    # ============================================
    # CLAIMS PERMISSIONS
    # ============================================
    {
        "name": "can_view_claims",
        "description": "Can view item claims"
    },
    {
        "name": "can_create_claims",
        "description": "Can create item claims"
    },
    {
        "name": "can_process_claims",
        "description": "Can approve/reject claims"
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
        "description": "Can view system analytics and reports"
    },
    {
        "name": "can_configure_system",
        "description": "Can configure system settings"
    },
    {
        "name": "can_access_admin",
        "description": "Can access admin panel"
    },
    
    # ============================================
    # TRANSFER REQUESTS PERMISSIONS (if needed)
    # ============================================
    {
        "name": "can_create_transfer_requests",
        "description": "Can create branch transfer requests"
    },
    {
        "name": "can_view_transfer_requests",
        "description": "Can view transfer requests"
    },
    {
        "name": "can_approve_transfer_requests",
        "description": "Can approve transfer requests"
    },
    {
        "name": "can_reject_transfer_requests",
        "description": "Can reject transfer requests"
    },
    {
        "name": "can_manage_transfer_requests",
        "description": "Can manage all transfer requests"
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







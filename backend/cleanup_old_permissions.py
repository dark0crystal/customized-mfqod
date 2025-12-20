#!/usr/bin/env python3
"""
Cleanup Script: Remove Old Unused Permissions

This script removes old granular permissions that have been consolidated
into hierarchical "manage" permissions.

Usage:
    python3 cleanup_old_permissions.py
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

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

# Define old permissions to remove (granular permissions that were consolidated)
OLD_PERMISSIONS_TO_REMOVE = [
    # Items permissions (consolidated into can_manage_items)
    'can_create_items',
    'can_view_items',
    'can_view_own_items',
    'can_edit_items',
    'can_approve_items',
    'can_delete_items',
    'can_restore_items',
    'can_bulk_delete_items',
    'can_bulk_edit_items',
    
    # Missing Items permissions (consolidated into can_manage_missing_items)
    'can_create_missing_items',
    'can_view_missing_items',
    'can_view_own_missing_items',
    'can_edit_missing_items',
    'can_approve_missing_items',
    'can_delete_missing_items',
    'can_restore_missing_items',
    'can_bulk_delete_missing_items',
    'can_bulk_edit_missing_items',
    
    # Item Types permissions (consolidated into can_manage_item_types)
    'can_create_item_types',
    'can_view_item_types',
    'can_edit_item_types',
    'can_delete_item_types',
    
    # Branches permissions (consolidated into can_manage_branches)
    'can_create_branches',
    'can_view_branches',
    'can_edit_branches',
    'can_delete_branches',
    'can_view_own_branches',
    'can_view_user_branches',
    'can_assign_branch_managers',
    'can_remove_branch_managers',
    'can_view_branch_managers',
    'can_be_branch_manager',
    
    # Addresses permissions (consolidated into can_manage_addresses)
    'can_create_addresses',
    'can_view_addresses',
    'can_edit_addresses',
    'can_delete_addresses',
    
    # Organizations permissions (consolidated into can_manage_organizations)
    'can_create_organizations',
    'can_view_organizations',
    'can_edit_organizations',
    'can_delete_organizations',
    
    # Users permissions (consolidated into can_manage_users)
    'can_view_users',
    'can_create_users',
    'can_edit_users',
    'can_delete_users',
    
    # Claims permissions (consolidated into can_manage_claims)
    'can_view_claims',
    'can_create_claims',
    'can_process_claims',
    
    # Transfer Requests permissions (consolidated into can_manage_transfer_requests)
    'can_create_transfer_requests',
    'can_view_transfer_requests',
    'can_approve_transfer_requests',
    'can_reject_transfer_requests',
    
    # Analytics permissions (consolidated into can_view_analytics)
    'can_view_statistics',
]

# Permissions to keep (new consolidated + system permissions)
PERMISSIONS_TO_KEEP = [
    'can_manage_items',
    'can_manage_missing_items',
    'can_manage_claims',
    'can_manage_item_types',
    'can_manage_branches',
    'can_manage_addresses',
    'can_manage_organizations',
    'can_manage_transfer_requests',
    'can_manage_users',
    'can_view_analytics',
    'admin',
    'can_view_system_logs',
    'can_manage_roles',
    'can_manage_permissions',
    'can_configure_system',
    'can_access_admin',
    # Keep old can_manage_missing_items if it exists (might be from before consolidation)
    'can_manage_missing_items',
    'can_manage_item_types',  # In case there was an old one
    'can_manage_transfer_requests',  # In case there was an old one
]


def cleanup_old_permissions():
    """
    Remove old granular permissions from the database.
    First removes them from role_permissions, then deletes the permissions themselves.
    """
    session = SessionLocal()
    removed_count = 0
    skipped_count = 0
    errors = []
    
    try:
        print("🔄 Starting cleanup of old permissions...")
        print(f"📋 Total old permissions to check: {len(OLD_PERMISSIONS_TO_REMOVE)}\n")
        
        for perm_name in OLD_PERMISSIONS_TO_REMOVE:
            try:
                # Check if permission exists
                check_query = text("""
                    SELECT id FROM permissions 
                    WHERE name = :name
                """)
                result = session.execute(check_query, {"name": perm_name}).fetchone()
                
                if not result:
                    print(f"⏭️  Skipped: {perm_name} (doesn't exist)")
                    skipped_count += 1
                    continue
                
                permission_id = result[0]
                
                # Check if permission is assigned to any roles
                role_check_query = text("""
                    SELECT COUNT(*) FROM role_permissions 
                    WHERE permission_id = :permission_id
                """)
                role_count = session.execute(role_check_query, {"permission_id": permission_id}).scalar()
                
                if role_count > 0:
                    print(f"⚠️  Warning: {perm_name} is assigned to {role_count} role(s). Removing from roles first...")
                    # Remove from role_permissions first
                    delete_role_perm_query = text("""
                        DELETE FROM role_permissions 
                        WHERE permission_id = :permission_id
                    """)
                    session.execute(delete_role_perm_query, {"permission_id": permission_id})
                    print(f"   ✅ Removed {perm_name} from {role_count} role assignment(s)")
                
                # Delete the permission itself
                delete_perm_query = text("""
                    DELETE FROM permissions 
                    WHERE id = :permission_id
                """)
                session.execute(delete_perm_query, {"permission_id": permission_id})
                
                print(f"✅ Removed: {perm_name}")
                removed_count += 1
                
            except Exception as e:
                error_msg = f"❌ Error processing {perm_name}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        # Commit all changes
        session.commit()
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        print(f"✅ Removed: {removed_count} old permissions")
        print(f"⏭️  Skipped: {skipped_count} permissions (didn't exist)")
        print(f"❌ Errors: {len(errors)}")
        
        if errors:
            print("\n⚠️  Errors encountered:")
            for error in errors:
                print(f"   {error}")
        
        if removed_count > 0:
            print(f"\n✨ Successfully removed {removed_count} old permissions from the database!")
        else:
            print("\n✨ No old permissions found to remove.")
        
        return True
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Fatal error: {str(e)}")
        return False
        
    finally:
        session.close()


def verify_permissions():
    """
    Verify that only the new consolidated permissions remain.
    """
    session = SessionLocal()
    
    try:
        print("\n🔍 Verifying remaining permissions...")
        
        # Get all permission names from database
        query = text("SELECT name FROM permissions ORDER BY name")
        db_permissions = [row[0] for row in session.execute(query).fetchall()]
        
        print(f"\n📋 Total permissions in database: {len(db_permissions)}")
        print("\n✅ Permissions in database:")
        for perm in db_permissions:
            print(f"   - {perm}")
        
        # Check for any old permissions that shouldn't be there
        old_perms_found = [p for p in db_permissions if p in OLD_PERMISSIONS_TO_REMOVE]
        if old_perms_found:
            print(f"\n⚠️  Warning: Found {len(old_perms_found)} old permissions still in database:")
            for perm in old_perms_found:
                print(f"   - {perm}")
            return False
        else:
            print("\n✅ No old permissions found - cleanup successful!")
            return True
            
    except Exception as e:
        print(f"❌ Error during verification: {str(e)}")
        return False
        
    finally:
        session.close()


if __name__ == "__main__":
    print("="*60)
    print("🧹 OLD PERMISSIONS CLEANUP SCRIPT")
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
    
    # Confirm before proceeding
    print("⚠️  WARNING: This will remove old granular permissions from the database.")
    print("   Make sure you have run the migration to map old permissions to new ones.")
    print()
    response = input("Do you want to continue? (yes/no): ").strip().lower()
    
    if response not in ['yes', 'y']:
        print("❌ Cleanup cancelled.")
        sys.exit(0)
    
    # Cleanup permissions
    success = cleanup_old_permissions()
    
    if success:
        # Verify permissions
        verify_permissions()
        print("\n" + "="*60)
        print("🎉 Cleanup completed!")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("❌ Cleanup failed!")
        print("="*60)
        sys.exit(1)








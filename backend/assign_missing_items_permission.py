#!/usr/bin/env python3
"""
Assign can_create_missing_items permission to default user roles

This script assigns the can_create_missing_items permission to common user roles
so that regular users can access the report-missing-item feature.

Usage:
    python assign_missing_items_permission.py
"""

import os
import sys
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

# Roles that should have can_create_missing_items permission
ROLES_TO_UPDATE = ['student', 'external', 'staff', 'user']

def assign_permission_to_roles():
    """Assign can_create_missing_items permission to specified roles"""
    session = SessionLocal()
    assigned_count = 0
    skipped_count = 0
    errors = []
    
    try:
        print("🔄 Assigning can_create_missing_items permission to roles...")
        print(f"📋 Roles to update: {', '.join(ROLES_TO_UPDATE)}\n")
        
        # Get the permission ID
        perm_query = text("SELECT id FROM permissions WHERE name = 'can_create_missing_items'")
        perm_result = session.execute(perm_query).fetchone()
        
        if not perm_result:
            print("❌ Error: Permission 'can_create_missing_items' not found in database")
            print("   Please run setup_permissions.py first to create all permissions")
            return False
        
        permission_id = perm_result[0]
        print(f"✅ Found permission ID: {permission_id}\n")
        
        # Assign permission to each role
        for role_name in ROLES_TO_UPDATE:
            try:
                # Get role ID
                role_query = text("SELECT id FROM role WHERE name = :role_name")
                role_result = session.execute(role_query, {"role_name": role_name}).fetchone()
                
                if not role_result:
                    print(f"⏭️  Skipped: Role '{role_name}' not found")
                    skipped_count += 1
                    continue
                
                role_id = role_result[0]
                
                # Check if permission is already assigned
                check_query = text("""
                    SELECT id FROM role_permissions 
                    WHERE role_id = :role_id AND permission_id = :permission_id
                """)
                existing = session.execute(check_query, {
                    "role_id": role_id,
                    "permission_id": permission_id
                }).fetchone()
                
                if existing:
                    print(f"⏭️  Skipped: {role_name} (permission already assigned)")
                    skipped_count += 1
                    continue
                
                # Assign permission
                insert_query = text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                """)
                session.execute(insert_query, {
                    "role_id": role_id,
                    "permission_id": permission_id
                })
                
                print(f"✅ Assigned to: {role_name}")
                assigned_count += 1
                
            except Exception as e:
                error_msg = f"❌ Error processing {role_name}: {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        # Commit all changes
        session.commit()
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        print(f"✅ Assigned: {assigned_count} roles")
        print(f"⏭️  Skipped: {skipped_count} roles")
        print(f"❌ Errors: {len(errors)}")
        
        if errors:
            print("\n⚠️  Errors encountered:")
            for error in errors:
                print(f"   {error}")
        
        if assigned_count > 0:
            print(f"\n✨ Successfully assigned permission to {assigned_count} role(s)!")
        else:
            print("\n✨ All specified roles already have this permission.")
        
        return True
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Fatal error: {str(e)}")
        return False
        
    finally:
        session.close()


if __name__ == "__main__":
    print("="*60)
    print("🚀 ASSIGN MISSING ITEMS PERMISSION")
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
    
    # Assign permissions
    success = assign_permission_to_roles()
    
    if success:
        print("\n" + "="*60)
        print("🎉 Permission assignment completed!")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("❌ Permission assignment failed!")
        print("="*60)
        sys.exit(1)


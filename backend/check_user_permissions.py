#!/usr/bin/env python3
"""
Diagnostic Script: Check User Permissions

This script helps diagnose permission issues by checking:
1. If a user has the super_admin role assigned
2. If the role has all permissions
3. If permissions are being loaded correctly

Usage:
    python check_user_permissions.py [user_id]
    
If no user_id is provided, it will check all users with super_admin role.
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import sessionmaker, joinedload
from sqlalchemy.orm import Session

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

# Super Admin Role ID
SUPER_ADMIN_ROLE_ID = "3ddcf133-53ec-45ce-8f42-07317169a96f"


def check_user_permissions(user_id: str = None):
    """Check permissions for a specific user or all super_admin users"""
    session = SessionLocal()
    
    try:
        print("="*60)
        print("🔍 USER PERMISSIONS DIAGNOSTIC")
        print("="*60)
        print()
        
        # Get super_admin role info
        role_query = text("""
            SELECT id, name, description 
            FROM role 
            WHERE id = :role_id
        """)
        role = session.execute(role_query, {"role_id": SUPER_ADMIN_ROLE_ID}).fetchone()
        
        if not role:
            print(f"❌ Error: Super admin role with ID '{SUPER_ADMIN_ROLE_ID}' not found")
            return
        
        print(f"✅ Super Admin Role: {role[1]} (ID: {role[0]})")
        if role[2]:
            print(f"   Description: {role[2]}")
        print()
        
        # Get all permissions in system
        all_perms_query = text("SELECT id, name FROM permissions ORDER BY name")
        all_permissions = session.execute(all_perms_query).fetchall()
        all_permission_names = {perm[1] for perm in all_permissions}
        
        print(f"📋 Total permissions in system: {len(all_permissions)}")
        print()
        
        # Get permissions assigned to super_admin role
        role_perms_query = text("""
            SELECT p.id, p.name, p.description
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = :role_id
            ORDER BY p.name
        """)
        role_permissions = session.execute(role_perms_query, {"role_id": SUPER_ADMIN_ROLE_ID}).fetchall()
        role_permission_names = {perm[1] for perm in role_permissions}
        
        print(f"📊 Permissions assigned to super_admin role: {len(role_permissions)}")
        
        # Check for missing permissions
        missing_permissions = all_permission_names - role_permission_names
        if missing_permissions:
            print(f"⚠️  Missing {len(missing_permissions)} permissions:")
            for perm_name in sorted(missing_permissions):
                print(f"   - {perm_name}")
        else:
            print("✅ All permissions are assigned to super_admin role")
        print()
        
        # Get users with super_admin role
        if user_id:
            users_query = text("""
                SELECT id, email, first_name, last_name, role_id
                FROM "user"
                WHERE id = :user_id
            """)
            users = session.execute(users_query, {"user_id": user_id}).fetchall()
        else:
            users_query = text("""
                SELECT id, email, first_name, last_name, role_id
                FROM "user"
                WHERE role_id = :role_id
            """)
            users = session.execute(users_query, {"role_id": SUPER_ADMIN_ROLE_ID}).fetchall()
        
        if not users:
            if user_id:
                print(f"❌ User with ID '{user_id}' not found or doesn't have super_admin role")
            else:
                print("❌ No users found with super_admin role")
            return
        
        print(f"👥 Found {len(users)} user(s) with super_admin role:")
        print("-" * 60)
        
        for user in users:
            user_id_val = user[0]
            print(f"\n📧 User: {user[1]} ({user[2]} {user[3]})")
            print(f"   ID: {user_id_val}")
            print(f"   Role ID: {user[4]}")
            
            # Check if role_id matches
            if user[4] != SUPER_ADMIN_ROLE_ID:
                print(f"   ⚠️  WARNING: User's role_id ({user[4]}) doesn't match super_admin role_id ({SUPER_ADMIN_ROLE_ID})")
                continue
            
            # Get user's permissions through role (simulating the actual query)
            user_perms_query = text("""
                SELECT p.id, p.name
                FROM "user" u
                JOIN role r ON u.role_id = r.id
                JOIN role_permissions rp ON r.id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE u.id = :user_id
                ORDER BY p.name
            """)
            user_permissions = session.execute(user_perms_query, {"user_id": user_id_val}).fetchall()
            user_permission_names = {perm[1] for perm in user_permissions}
            
            print(f"   📋 Permissions loaded: {len(user_permissions)}")
            
            # Check if user has all permissions
            if user_permission_names == all_permission_names:
                print("   ✅ User has ALL permissions (full access)")
            else:
                missing = all_permission_names - user_permission_names
                print(f"   ⚠️  User is missing {len(missing)} permissions:")
                for perm_name in sorted(missing):
                    print(f"      - {perm_name}")
            
            # List all permissions
            print(f"   📝 All permissions:")
            for perm_name in sorted(user_permission_names):
                print(f"      • {perm_name}")
        
        print()
        print("="*60)
        print("💡 TROUBLESHOOTING TIPS")
        print("="*60)
        print("1. If user doesn't have super_admin role:")
        print("   UPDATE \"user\" SET role_id = '3ddcf133-53ec-45ce-8f42-07317169a96f' WHERE id = '<user_id>';")
        print()
        print("2. If role is missing permissions:")
        print("   Run: python assign_all_permissions_to_super_admin.py")
        print("   OR execute: backend/assign_all_permissions_to_super_admin.sql")
        print()
        print("3. If permissions are assigned but not loading:")
        print("   - Check database connection")
        print("   - Verify role_permissions table has correct data")
        print("   - Restart the backend server to clear any caches")
        print()
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()


if __name__ == "__main__":
    user_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    # Test database connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connection successful\n")
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        sys.exit(1)
    
    check_user_permissions(user_id)






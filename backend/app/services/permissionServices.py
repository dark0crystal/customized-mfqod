# services/permissionServices.py
from datetime import datetime, timezone
import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.models import Permission, Role, RolePermissions
from app.schemas.permission_schema import PermissionRequestSchema
from typing import List, Optional

# ============================= 
# Check Permission Existence by Name
# ============================= 
def check_permission_existence(session: Session, permission_name: str) -> Permission | None:
    """Check if a permission exists by name"""
    statement = select(Permission).where(Permission.name == permission_name)
    return session.execute(statement).scalars().first()

# ============================= 
# Check Permission Existence by ID
# ============================= 
def check_permission_existence_by_id(session: Session, permission_id: str) -> Permission | None:
    """Check if a permission exists by ID"""
    statement = select(Permission).where(Permission.id == permission_id)
    return session.execute(statement).scalars().first()

# ============================= 
# Get All Permissions
# ============================= 
def get_all_permissions(session: Session) -> List[Permission]:
    """Fetch all permissions from the Permission table"""
    statement = select(Permission)
    permissions = session.execute(statement).scalars().all()
    return permissions

# ============================= 
# Get Permission by ID
# ============================= 
def get_permission_by_id(session: Session, permission_id: str) -> Permission | None:
    """Get a specific permission by ID"""
    statement = select(Permission).where(Permission.id == permission_id)
    return session.execute(statement).scalars().first()

# ============================= 
# Create New Permission
# ============================= 
def create_permission(session: Session, permission_data: PermissionRequestSchema) -> Permission:
    """Create a new permission"""
    # Check if permission already exists
    existing_permission = check_permission_existence(session, permission_data.name)
    if existing_permission:
        raise HTTPException(status_code=409, detail="Permission already exists in the system.")
    
    # Create permission without timestamp fields if they don't exist in the model
    new_permission = Permission(
        id=str(uuid.uuid4()),
        name=permission_data.name,
        description=permission_data.description
    )
    
    session.add(new_permission)
    session.commit()
    session.refresh(new_permission)
    
    return new_permission

# ============================= 
# Update Permission
# ============================= 
def update_permission(session: Session, permission_id: str, permission_data: PermissionRequestSchema) -> Permission:
    """Update an existing permission"""
    permission = check_permission_existence_by_id(session, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found.")
    
    # Check if new name conflicts with existing permission (excluding current one)
    if permission_data.name != permission.name:
        existing_permission = check_permission_existence(session, permission_data.name)
        if existing_permission:
            raise HTTPException(status_code=409, detail="Permission name already exists in the system.")
    
    permission.name = permission_data.name
    permission.description = permission_data.description
    # Only update timestamp if the field exists
    if hasattr(permission, 'updated_at'):
        permission.updated_at = datetime.now(timezone.utc)
    
    session.commit()
    session.refresh(permission)
    
    return permission

# ============================= 
# Delete Permission
# ============================= 
def delete_permission(session: Session, permission_id: str):
    """Delete a permission and all its role associations"""
    permission = check_permission_existence_by_id(session, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found.")
    
    # First, remove all role-permission associations
    statement = delete(RolePermissions).where(RolePermissions.permission_id == permission_id)
    session.execute(statement)
    
    # Then delete the permission
    session.delete(permission)
    session.commit()
    
    return {"message": "Permission deleted successfully", "permission_id": permission_id}

# ============================= 
# Get Permissions with Roles
# ============================= 
def get_permissions_with_roles(session: Session) -> List[dict]:
    """Get all permissions with their associated roles"""
    statement = select(Permission).options(
        # This would require joinedload if you want to optimize
        # For now, we'll handle it in the route
    )
    permissions = session.execute(statement).scalars().all()
    
    result = []
    for permission in permissions:
        permission_dict = {
            "id": permission.id,
            "name": permission.name,
            "description": permission.description,
            "roles": [role.name for role in permission.roles] if hasattr(permission, 'roles') else []
        }
        # Add timestamp fields if they exist
        if hasattr(permission, 'created_at'):
            permission_dict["created_at"] = permission.created_at
        if hasattr(permission, 'updated_at'):
            permission_dict["updated_at"] = permission.updated_at
            
        result.append(permission_dict)
    
    return result

# ============================= 
# Assign Permission to Role
# ============================= 
def assign_permission_to_role(session: Session, role_id: str, permission_id: str):
    """Assign a permission to a role"""
    # Check if role exists
    role_statement = select(Role).where(Role.id == role_id)
    role = session.execute(role_statement).scalars().first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    
    # Check if permission exists
    permission = check_permission_existence_by_id(session, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found.")
    
    # Check if association already exists
    existing_association = session.execute(
        select(RolePermissions).where(
            RolePermissions.role_id == role_id,
            RolePermissions.permission_id == permission_id
        )
    ).scalars().first()
    
    if existing_association:
        raise HTTPException(status_code=409, detail="Permission is already assigned to this role.")
    
    # Create the association
    role_permission = RolePermissions(role_id=role_id, permission_id=permission_id)
    session.add(role_permission)
    session.commit()
    
    return {"message": "Permission assigned to role successfully", "role_id": role_id, "permission_id": permission_id}

# ============================= 
# Remove Permission from Role
# ============================= 
def remove_permission_from_role(session: Session, role_id: str, permission_id: str):
    """Remove a permission from a role"""
    # Check if association exists
    statement = select(RolePermissions).where(
        RolePermissions.role_id == role_id,
        RolePermissions.permission_id == permission_id
    )
    association = session.execute(statement).scalars().first()
    
    if not association:
        raise HTTPException(status_code=404, detail="Permission is not assigned to this role.")
    
    # Remove the association
    session.delete(association)
    session.commit()
    
    return {"message": "Permission removed from role successfully", "role_id": role_id, "permission_id": permission_id}

# ============================= 
# Assign Multiple Permissions to Role
# ============================= 
def assign_multiple_permissions_to_role(session: Session, role_id: str, permission_ids: List[str]):
    """Assign multiple permissions to a role"""
    # Check if role exists
    role_statement = select(Role).where(Role.id == role_id)
    role = session.execute(role_statement).scalars().first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    
    # Validate all permissions exist
    for permission_id in permission_ids:
        permission = check_permission_existence_by_id(session, permission_id)
        if not permission:
            raise HTTPException(status_code=404, detail=f"Permission with ID {permission_id} not found.")
    
    # Remove existing associations for this role
    delete_statement = delete(RolePermissions).where(RolePermissions.role_id == role_id)
    session.execute(delete_statement)
    
    # Add new associations
    for permission_id in permission_ids:
        role_permission = RolePermissions(role_id=role_id, permission_id=permission_id)
        session.add(role_permission)
    
    session.commit()
    
    return {"message": "Permissions assigned to role successfully", "role_id": role_id, "permission_count": len(permission_ids)}

# ============================= 
# Get Role Permissions
# ============================= 
def get_role_permissions(session: Session, role_id: str) -> List[Permission]:
    """Get all permissions for a specific role"""
    from sqlalchemy.orm import joinedload
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info(f"[PERMISSIONS] Fetching permissions for role_id: {role_id}")
    
    # Use eager loading to ensure permissions are loaded before session closes
    role_statement = select(Role).options(
        joinedload(Role.permissions)
    ).where(Role.id == role_id)
    role = session.execute(role_statement).unique().scalars().first()
    
    if not role:
        logger.warning(f"[PERMISSIONS] Role not found for role_id: {role_id}")
        raise HTTPException(status_code=404, detail="Role not found.")
    
    logger.info(f"[PERMISSIONS] Found role: {role.name} (id: {role.id})")
    permissions = role.permissions
    logger.info(f"[PERMISSIONS] Role has {len(permissions)} permissions")
    
    if len(permissions) == 0:
        logger.warning(f"[PERMISSIONS] WARNING: Role '{role.name}' has no permissions assigned!")
        logger.warning(f"[PERMISSIONS] This could mean permissions were not properly assigned to the role.")
    else:
        permission_names = [p.name for p in permissions]
        logger.info(f"[PERMISSIONS] Permission names: {', '.join(permission_names)}")
    
    return permissions

# ============================= 
# Get User Permissions
# ============================= 
def get_user_permissions(session: Session, user_id: str) -> List[Permission]:
    """Get all permissions for a user through their role"""
    from app.models import User, Role
    from sqlalchemy.orm import joinedload
    
    # Get user with role and permissions (eagerly loaded)
    user_statement = select(User).options(
        joinedload(User.role).joinedload(Role.permissions)
    ).where(User.id == user_id)
    user = session.execute(user_statement).unique().scalars().first()
    
    if not user or not user.role:
        return []
    
    return user.role.permissions

# ============================= 
# Check if User has Full Access
# ============================= 
def has_full_access(session: Session, user_id: str) -> bool:
    """Check if user has all permissions (full system access)
    
    Security: Determines if user is a super admin by checking if they have all permissions
    Super admins bypass all permission checks and have full system access
    """
    # Get all permissions in system
    all_permissions = get_all_permissions(session)
    
    # If no permissions exist in system, return False
    if not all_permissions:
        return False
    
    # Get user's permissions through their role
    user_permissions = get_user_permissions(session, user_id)
    
    # Convert to sets of permission names for comparison
    all_permission_names = {perm.name for perm in all_permissions}
    user_permission_names = {perm.name for perm in user_permissions}
    
    # Security: User has full access if they have all permissions
    return user_permission_names == all_permission_names and len(all_permission_names) > 0

# ============================= 
# Check User Permission
# ============================= 
def check_user_permission(session: Session, user_id: str, permission_name: str) -> bool:
    """Check if a user has a specific permission through their role
    
    Security: Core permission checking function used throughout the application
    Super admins (users with all permissions) automatically pass all checks
    Regular users are checked against their role's permissions
    """
    from app.models import User, Role
    from sqlalchemy.orm import joinedload
    
    # Eagerly load user with role and permissions to avoid lazy loading issues
    user_statement = select(User).options(
        joinedload(User.role).joinedload(Role.permissions)
    ).where(User.id == user_id)
    user = session.execute(user_statement).unique().scalars().first()
    
    if not user or not user.role:
        return False
    
    # Security: Super admins bypass all permission checks
    # This provides full system access without checking individual permissions
    if has_full_access(session, user_id):
        return True
    
    # Security: Check if user's role has the requested permission
    for permission in user.role.permissions:
        if permission.name == permission_name:
            return True
    
    return False
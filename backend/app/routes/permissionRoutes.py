# routes/permission_routes.py
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from app.services import permissionServices
from app.models import Permission
from app.db.database import get_session
from app.schemas.permission_schema import (
    PermissionRequestSchema, 
    PermissionSchema, 
    PermissionWithRolesSchema,
    AssignPermissionToRoleSchema,
    RolePermissionSchema
)
from typing import List

router = APIRouter()

# ==================================
# List All Permissions
# ==================================
@router.get(
    "/all",
    response_model=List[PermissionSchema],
    summary="List all permissions",
    description="""
Get a list of all permissions from the system.

### Returns:
- A list of permissions, each containing:
  - `id`: Unique identifier of the permission
  - `name`: The name of the permission (e.g., can_view_users, can_edit_posts)
  - `description`: Optional description of the permission
  - `created_at`: Timestamp when the permission was created
  - `updated_at`: Timestamp when the permission was last updated
"""
)
def list_permissions(session: Session = Depends(get_session)):
    """
    Fetch all permissions from the Permission table.
    
    - **No authentication** required for this endpoint.
    - Useful for forms or dashboards that require a list of permission options.
    """
    return permissionServices.get_all_permissions(session)

# ==================================
# Get Permissions with Roles
# ==================================
@router.get(
    "/with-roles",
    response_model=List[PermissionWithRolesSchema],
    summary="List all permissions with their assigned roles",
    description="""
Get a list of all permissions with the roles that have been assigned to them.

### Returns:
- A list of permissions with their associated roles
"""
)
def list_permissions_with_roles(session: Session = Depends(get_session)):
    """
    Fetch all permissions with their associated roles.
    
    - Shows which roles have been assigned to each permission
    - Useful for permission management dashboards
    """
    return permissionServices.get_permissions_with_roles(session)

# ==================================
# Get Permission by ID
# ==================================
@router.get(
    "/{permission_id}",
    response_model=PermissionSchema,
    summary="Get a specific permission",
    description="""
Get details of a specific permission by its ID.

### Path parameter:
- `permission_id`: ID of the permission to retrieve

### Returns:
- Permission details including id, name, description, and timestamps
"""
)
def get_permission(permission_id: str, session: Session = Depends(get_session)):
    """
    Get a specific permission by ID.
    
    - **Raises 404** if permission not found.
    """
    permission = permissionServices.get_permission_by_id(session, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found.")
    return permission

# ==================================
# Add New Permission
# ==================================
@router.post(
    "/add-new-permission",
    response_model=PermissionSchema,
    summary="Add a new permission",
    description="""
Create a new permission in the system.

### Request Body:
- `name`: The permission name (e.g., "can_view_users", "can_edit_posts")
- `description`: Optional description of what this permission allows

### Returns:
- The created permission with all its details
"""
)
def add_new_permission(
    permission: PermissionRequestSchema, 
    session: Session = Depends(get_session)
):
    """
    Create a new permission.
    
    - **Raises 409** if permission name already exists.
    - Permission names should follow the pattern: can_action_resource (e.g., can_view_users)
    """
    return permissionServices.create_permission(session, permission)

# ==================================
# Update Permission
# ==================================
@router.put(
    "/{permission_id}",
    response_model=PermissionSchema,
    summary="Update a permission",
    description="""
Update an existing permission.

### Path parameter:
- `permission_id`: ID of the permission to update

### Request Body:
- `name`: The new permission name
- `description`: Updated description

### Returns:
- The updated permission details
"""
)
def update_permission(
    permission_id: str,
    permission: PermissionRequestSchema,
    session: Session = Depends(get_session)
):
    """
    Update an existing permission.
    
    - **Raises 404** if permission not found.
    - **Raises 409** if new name conflicts with existing permission.
    """
    return permissionServices.update_permission(session, permission_id, permission)

# ==================================
# Delete Permission
# ==================================
@router.delete(
    "/{permission_id}",
    summary="Delete a permission",
    description="""
Remove a permission from the system by its ID.

### Path parameter:
- `permission_id`: ID of the permission to delete

### Returns:
- A confirmation message

### Note:
- This will also remove all role-permission associations for this permission
"""
)
def delete_permission(permission_id: str, session: Session = Depends(get_session)):
    """
    Remove a permission from the Permission table.
    
    - **Raises 404** if permission not found.
    - Automatically removes all role-permission associations.
    """
    return permissionServices.delete_permission(session, permission_id)

# ==================================
# Assign Permission to Role
# ==================================
@router.post(
    "/assign-to-role",
    summary="Assign a permission to a role",
    description="""
Assign a specific permission to a role.

### Request Body:
- `role_id`: ID of the role to assign the permission to
- `permission_id`: ID of the permission to assign

### Returns:
- A confirmation message
"""
)
def assign_permission_to_role(
    assignment: RolePermissionSchema,
    session: Session = Depends(get_session)
):
    """
    Assign a permission to a role.
    
    - **Raises 404** if role or permission not found.
    - **Raises 409** if permission is already assigned to the role.
    """
    return permissionServices.assign_permission_to_role(
        session, 
        assignment.role_id, 
        assignment.permission_id
    )

# ==================================
# Remove Permission from Role
# ==================================
@router.delete(
    "/remove-from-role",
    summary="Remove a permission from a role",
    description="""
Remove a specific permission from a role.

### Request Body:
- `role_id`: ID of the role to remove the permission from
- `permission_id`: ID of the permission to remove

### Returns:
- A confirmation message
"""
)
def remove_permission_from_role(
    assignment: RolePermissionSchema,
    session: Session = Depends(get_session)
):
    """
    Remove a permission from a role.
    
    - **Raises 404** if the permission is not assigned to the role.
    """
    return permissionServices.remove_permission_from_role(
        session, 
        assignment.role_id, 
        assignment.permission_id
    )

# ==================================
# Assign Multiple Permissions to Role
# ==================================
@router.post(
    "/assign-multiple-to-role",
    summary="Assign multiple permissions to a role",
    description="""
Assign multiple permissions to a role. This will replace all existing permissions for the role.

### Request Body:
- `role_id`: ID of the role
- `permission_ids`: List of permission IDs to assign

### Returns:
- A confirmation message with the count of assigned permissions

### Note:
- This replaces ALL existing permissions for the role
- Use this for bulk permission assignment
"""
)
def assign_multiple_permissions_to_role(
    assignment: AssignPermissionToRoleSchema,
    session: Session = Depends(get_session)
):
    """
    Assign multiple permissions to a role.
    
    - **Raises 404** if role or any permission not found.
    - Replaces existing permissions for the role.
    """
    return permissionServices.assign_multiple_permissions_to_role(
        session, 
        assignment.role_id, 
        assignment.permission_ids
    )

# ==================================
# Get Role Permissions
# ==================================
@router.get(
    "/role/{role_id}",
    response_model=List[PermissionSchema],
    summary="Get all permissions for a specific role",
    description="""
Get all permissions that have been assigned to a specific role.

### Path parameter:
- `role_id`: ID of the role to get permissions for

### Returns:
- A list of permissions assigned to the role
"""
)
def get_role_permissions(role_id: str, session: Session = Depends(get_session)):
    """
    Get all permissions for a specific role.
    
    - **Raises 404** if role not found.
    - Returns empty list if role has no permissions.
    """
    return permissionServices.get_role_permissions(session, role_id)

# ==================================
# Check User Permission
# ==================================
@router.get(
    "/check-user-permission/{user_id}/{permission_name}",
    summary="Check if a user has a specific permission",
    description="""
Check if a user has a specific permission through their assigned role.

### Path parameters:
- `user_id`: ID of the user to check
- `permission_name`: Name of the permission to check for

### Returns:
- Boolean indicating whether the user has the permission
"""
)
def check_user_permission(
    user_id: str, 
    permission_name: str, 
    session: Session = Depends(get_session)
):
    """
    Check if a user has a specific permission.
    
    - Returns True if user has the permission through their role
    - Returns False if user doesn't have the permission or has no role
    """
    has_permission = permissionServices.check_user_permission(session, user_id, permission_name)
    return {"user_id": user_id, "permission_name": permission_name, "has_permission": has_permission}
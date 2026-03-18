# routes/permission_routes.py
"""
Permission API Routes

Endpoints for managing permissions and role–permission assignments.
- List and retrieve permissions (with or without role associations).
- Create, update, and delete permissions (requires `can_manage_permissions`).
- Assign or remove permissions to/from roles.
- Check whether a user has a specific permission.

Permissions follow the naming pattern: `can_<action>_<resource>` (e.g. `can_view_users`, `can_manage_roles`).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlmodel import Session
from app.services import permissionServices
from app.db.database import get_session
from app.schemas.permission_schema import (
    PermissionRequestSchema,
    PermissionSchema,
    PermissionWithRolesSchema,
    AssignPermissionToRoleSchema,
    RolePermissionSchema
)
from typing import List
from app.utils.permission_decorator import require_permission

router = APIRouter(tags=["Permissions"])

# ===========================
# List All Permissions
# ===========================
@router.get(
    "/all",
    response_model=List[PermissionSchema],
    summary="List all permissions",
    operation_id="list_permissions",
    description="""
Return all permissions in the system. No authentication required.

**Use cases:** Permission dropdowns, role-editing forms, admin dashboards.

**Response:** List of permissions with `id`, `name`, `description`, `created_at`, `updated_at`.
""",
    responses={200: {"description": "List of all permissions."}},
)
def list_permissions(session: Session = Depends(get_session)):
    """Fetch all permissions from the Permission table."""
    return permissionServices.get_all_permissions(session)

# ===========================
# Get Permissions with Roles
# ===========================
@router.get(
    "/with-roles",
    response_model=List[PermissionWithRolesSchema],
    summary="List permissions with assigned roles",
    operation_id="list_permissions_with_roles",
    description="""
Return all permissions including the list of role names that have each permission. No authentication required.

**Use cases:** Permission management UI, auditing which roles have which permissions.

**Response:** Each item includes `id`, `name`, `description`, `roles` (list of role names), `created_at`, `updated_at`.
""",
    responses={200: {"description": "Permissions with their assigned roles."}},
)
def list_permissions_with_roles(session: Session = Depends(get_session)):
    """Fetch all permissions with their associated roles."""
    return permissionServices.get_permissions_with_roles(session)

# ===========================
# Get Permission by ID
# ===========================
@router.get(
    "/{permission_id}",
    response_model=PermissionSchema,
    summary="Get permission by ID",
    operation_id="get_permission",
    description="""
Return a single permission by its ID. No authentication required.

**Path:** `permission_id` — UUID of the permission.

**Response:** Permission with `id`, `name`, `description`, `created_at`, `updated_at`.
""",
    responses={
        200: {"description": "Permission found."},
        404: {"description": "Permission not found."},
    },
)
def get_permission(permission_id: str, session: Session = Depends(get_session)):
    """Get a specific permission by ID. Raises 404 if not found."""
    permission = permissionServices.get_permission_by_id(session, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found.")
    return permission

# ===========================
# Add New Permission
# ===========================
@router.post(
    "/add-new-permission",
    response_model=PermissionSchema,
    summary="Create a new permission",
    operation_id="add_new_permission",
    description="""
Create a new permission. Requires `can_manage_permissions`.

**Request body:** `name` (required), `description` (optional). Names should follow `can_<action>_<resource>` (e.g. `can_view_users`).

**Response:** The created permission with `id`, `name`, `description`, `created_at`, `updated_at`.
""",
    responses={
        200: {"description": "Permission created."},
        403: {"description": "Forbidden — missing can_manage_permissions."},
        409: {"description": "Conflict — permission name already exists."},
    },
)
@require_permission("can_manage_permissions")
def add_new_permission(
    request: Request,
    permission: PermissionRequestSchema,
    session: Session = Depends(get_session)
):
    """Create a new permission. Raises 409 if name already exists."""
    return permissionServices.create_permission(session, permission)

# ===========================
# Update Permission
# ===========================
@router.put(
    "/{permission_id}",
    response_model=PermissionSchema,
    summary="Update a permission",
    operation_id="update_permission",
    description="""
Update an existing permission by ID. Requires `can_manage_permissions`.

**Path:** `permission_id` — UUID of the permission to update.

**Request body:** `name` (optional), `description` (optional). Provide only fields to change.

**Response:** The updated permission.
""",
    responses={
        200: {"description": "Permission updated."},
        403: {"description": "Forbidden — missing can_manage_permissions."},
        404: {"description": "Permission not found."},
        409: {"description": "Conflict — new name already in use."},
    },
)
@require_permission("can_manage_permissions")
def update_permission(
    request: Request,
    permission_id: str,
    permission: PermissionRequestSchema,
    session: Session = Depends(get_session)
):
    """Update an existing permission. Raises 404 if not found, 409 if name conflicts."""
    return permissionServices.update_permission(session, permission_id, permission)

# ===========================
# Delete Permission
# ===========================
@router.delete(
    "/{permission_id}",
    summary="Delete a permission",
    operation_id="delete_permission",
    description="""
Delete a permission by ID. Requires `can_manage_permissions`.

**Path:** `permission_id` — UUID of the permission to delete.

**Side effect:** All role–permission associations for this permission are removed. Roles that had only this permission may end up with no permissions.
""",
    responses={
        200: {"description": "Permission deleted."},
        403: {"description": "Forbidden — missing can_manage_permissions."},
        404: {"description": "Permission not found."},
    },
)
@require_permission("can_manage_permissions")
def delete_permission(request: Request, permission_id: str, session: Session = Depends(get_session)):
    """Remove a permission and all its role associations. Raises 404 if not found."""
    return permissionServices.delete_permission(session, permission_id)

# ===========================
# Assign Permission to Role
# ===========================
@router.post(
    "/assign-to-role",
    summary="Assign one permission to a role",
    operation_id="assign_permission_to_role",
    description="""
Assign a single permission to a role. Requires `can_manage_permissions`.

**Request body:** `role_id` (UUID), `permission_id` (UUID).

**Response:** Success message. Idempotent in effect (already-assigned returns 409).
""",
    responses={
        200: {"description": "Permission assigned to role."},
        403: {"description": "Forbidden — missing can_manage_permissions."},
        404: {"description": "Role or permission not found."},
        409: {"description": "Permission already assigned to this role."},
    },
)
@require_permission("can_manage_permissions")
def assign_permission_to_role(
    request: Request,
    assignment: RolePermissionSchema,
    session: Session = Depends(get_session)
):
    """Assign a permission to a role. Raises 404 if role/permission missing, 409 if already assigned."""
    return permissionServices.assign_permission_to_role(
        session, 
        assignment.role_id, 
        assignment.permission_id
    )

# ===========================
# Remove Permission from Role
# ===========================
@router.delete(
    "/remove-from-role",
    summary="Remove a permission from a role",
    operation_id="remove_permission_from_role",
    description="""
Remove a permission from a role. Requires `can_manage_permissions`.

**Request body:** `role_id` (UUID), `permission_id` (UUID). The permission must currently be assigned to the role.
""",
    responses={
        200: {"description": "Permission removed from role."},
        403: {"description": "Forbidden — missing can_manage_permissions."},
        404: {"description": "Role not found or permission not assigned to this role."},
    },
)
@require_permission("can_manage_permissions")
def remove_permission_from_role(
    request: Request,
    assignment: RolePermissionSchema,
    session: Session = Depends(get_session)
):
    """Remove a permission from a role. Raises 404 if not assigned."""
    return permissionServices.remove_permission_from_role(
        session, 
        assignment.role_id, 
        assignment.permission_id
    )

# ===========================
# Assign Multiple Permissions to Role
# ===========================
@router.post(
    "/assign-multiple-to-role",
    summary="Set all permissions for a role (replace existing)",
    operation_id="assign_multiple_permissions_to_role",
    description="""
Set the full set of permissions for a role. Requires `can_manage_permissions`.

**Request body:** `role_id` (UUID), `permission_ids` (list of UUIDs). This **replaces** all current permissions for the role; it does not add to them. Use an empty list to clear all permissions.

**Response:** Confirmation with count of permissions now assigned.
""",
    responses={
        200: {"description": "Role permissions updated."},
        403: {"description": "Forbidden — missing can_manage_permissions."},
        404: {"description": "Role not found or one or more permission IDs invalid."},
    },
)
@require_permission("can_manage_permissions")
def assign_multiple_permissions_to_role(
    request: Request,
    assignment: AssignPermissionToRoleSchema,
    session: Session = Depends(get_session)
):
    """Replace all permissions for a role. Raises 404 if role or any permission not found."""
    return permissionServices.assign_multiple_permissions_to_role(
        session, 
        assignment.role_id, 
        assignment.permission_ids
    )

# ===========================
# Get Role Permissions
# ===========================
@router.get(
    "/role/{role_id}",
    response_model=List[PermissionSchema],
    summary="List permissions for a role",
    operation_id="get_role_permissions",
    description="""
Return all permissions assigned to a role. No authentication required.

**Path:** `role_id` — UUID of the role.

**Response:** List of permission objects. Empty list if the role has no permissions.
""",
    responses={
        200: {"description": "List of permissions for the role (may be empty)."},
        404: {"description": "Role not found."},
    },
)
def get_role_permissions(role_id: str, session: Session = Depends(get_session)):
    """Get all permissions for a role. Returns empty list if none; 404 if role not found."""
    return permissionServices.get_role_permissions(session, role_id)

# ===========================
# Check User Permission
# ===========================
@router.get(
    "/check-user-permission/{user_id}/{permission_name}",
    summary="Check if user has a permission",
    operation_id="check_user_permission",
    description="""
Check whether a user has a given permission (via their role). No authentication required.

**Path:** `user_id` (UUID), `permission_name` (e.g. `can_manage_users`). The permission is resolved by name, not ID.

**Response:** `user_id`, `permission_name`, and `has_permission` (boolean). `has_permission` is false if the user has no role or their role does not include this permission.
""",
    responses={200: {"description": "Check result: user_id, permission_name, has_permission."}},
)
def check_user_permission(
    user_id: str,
    permission_name: str,
    session: Session = Depends(get_session)
):
    """Return whether the user has the given permission via their role."""
    has_permission = permissionServices.check_user_permission(session, user_id, permission_name)
    return {"user_id": user_id, "permission_name": permission_name, "has_permission": has_permission}
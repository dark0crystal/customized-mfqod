# Permissions (RBAC) — Current Overview

This document describes the current Role-Based Access Control (RBAC) permissions used in the project: canonical permissions, their descriptions, where they are enforced (frontend/back-end), how to check or modify them, and a few recommendations.

---

## 1) Where permissions live

- Permissions are stored in the `permissions` table (see `backend/setup_permissions.sql`). The project uses consolidated "manage" permissions (e.g., `can_manage_items`) rather than many granular flags.
- Permission logic and utilities are implemented in `backend/app/services/permissionServices.py`.
- Routes that require permissions use the `@require_permission("<permission_name>")` decorator defined in `backend/app/utils/permission_decorator.py`.
- The frontend maps a small set of routes to required permissions (see `frontend/src/lib/server/routePermissions.ts`) to hide/show UI links and control server-side route access.

---

## 2) Canonical permissions (current)

These are the consolidated permissions inserted by `setup_permissions.sql` (names and short descriptions):

- `can_manage_items` — Full item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own items.
- `can_manage_missing_items` — Full missing item management (create, view, edit, delete, approve, restore, bulk operations).
- `can_manage_item_types` — Full item type management (create, view, edit, delete).
- `can_manage_branches` — Full branch management (create, view, edit, delete, manage managers).
- `can_manage_addresses` — Full address management (create, view, edit, delete).
- `can_manage_organizations` — Full organization management (create, view, edit, delete).
- `can_manage_users` — Full user management access (create, view, edit, delete).
- `can_manage_claims` — Full claim management (view, create, process/approve/reject).
- `can_view_system_logs` — Can view system logs / audit logs.
- `can_manage_roles` — Can create/edit/delete roles.
- `can_manage_permissions` — Can create/edit/delete permissions and assign them to roles.
- `can_view_analytics` — Can view system analytics and statistics.
- `can_configure_system` — Can configure system settings.
- `can_manage_transfer_requests` — Full transfer request management (create, view, approve, reject).

Note: there are a few additional helper/legacy names floating in example files, but these are covered by the consolidated permissions above.

---

## 3) Where permissions are enforced (selected mapping)

Backend (examples):

- Items & Search: `backend/app/routes/itemRoutes.py` — `@require_permission("can_manage_items")` used on most admin & search endpoints.
- Missing items: `backend/app/routes/missingItemRoutes.py` — `@require_permission("can_manage_missing_items")`.
- Branches: `backend/app/routes/branchRoutes.py` — `@require_permission("can_manage_branches")` on create/update/delete.
- Users: `backend/app/routes/userRoutes.py` — `@require_permission("can_manage_users")` on mutating endpoints (update/delete/role/status changes).
- Permissions management: `backend/app/routes/permissionRoutes.py` — `@require_permission("can_manage_permissions")` required for adding/updating/deleting or assigning permissions to roles.

Frontend (examples):

- `frontend/src/lib/server/routePermissions.ts` maps dashboard routes to permissions used to render the UI (examples):
  - `/dashboard/branch` → `can_manage_branches`
  - `/dashboard/manage-users` → `can_manage_users`
  - `/dashboard/items` → `can_manage_items`
  - `/dashboard/claims` → `can_manage_claims`
  - `/dashboard/analytics` → `can_view_analytics`

Middleware & helpers:

- `permissionServices.check_user_permission(session, user_id, permission_name)` is used per-request when a decision must be made programmatically (examples: branch manager assignment checks, image service access checks).
- `permissionServices.has_full_access(session, user_id)` checks whether the user has ALL permissions and is used as a full-access bypass (admin-like behaviour).

---

## 4) How to inspect & modify permissions

- List all permissions via API: `GET /api/permissions/all` (returns permission records).
- Check whether a user has a permission via API: `GET /api/permissions/check-user-permission/{user_id}/{permission_name}`.
- Manage permissions via API (requires `can_manage_permissions`):
  - Add: `POST /api/permissions/add-new-permission` (body: `name`, `description`)
  - Update: `PUT /api/permissions/{permission_id}`
  - Delete: `DELETE /api/permissions/{permission_id}`
  - Assign to role: `POST /api/permissions/assign-to-role`

Developer tools:

- Use `permissionServices` functions in the code to get or modify permissions programmatically.
- There is a cleanup script to remove legacy granular permissions: `backend/cleanup_old_permissions.py`.

---

## 5) Legacy / Consolidation notes

- The repo historically had many granular `can_create_*`, `can_view_*`, `can_edit_*`, etc. permissions. They have been consolidated into `can_manage_*` permissions for simplicity.
- `backend/cleanup_old_permissions.py` lists the older granular permission names and includes a helper to remove them from the DB if desired.

---



## Expanded guide

For a deeper look at how permission checks are executed at runtime (request flow, decorator vs programmatic checks, testing guidance and examples), see **`docs/permissions-access.md`**. This new guide provides examples, debugging tips, and best practices for adding or modifying permission checks.

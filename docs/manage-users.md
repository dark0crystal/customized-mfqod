# Manage Users — Documentation

This document describes the Manage Users page functionality, the related frontend components, backend routes and services, permissions, important behaviors (search, role and status management), and findings from a code scan.

## 1. Page Overview (Frontend)

- Path: `/dashboard/manage-users`
- Component: `frontend/src/app/[locale]/(protected)/dashboard/manage-users/ManageUsers.tsx`
- Purpose: Search, view, and navigate to user details; manage roles, statuses, and branch manager assignments on the user detail page.
- Key UI components:
  - `ManageUsers` — Search users by email and show results.
  - `frontend/src/app/[locale]/(protected)/dashboard/manage-users/[userId]/page.tsx` — User detail page that composes several sub-components.
  - `EditUserManagement` — Assign / remove branch management roles for a user, deactivate or permanently delete accounts, and perform destructive actions (danger zone).

## 2. Frontend Behavior & Flows

- Search flow:
  - Search by email: form posts to `/api/users/search?email=...` and shows results.
  - Results link to `/dashboard/manage-users/{userId}` for user detail and management.

- User detail flows (`EditUserManagement`):
  - Assign a user as branch manager: POST `/api/branches/{branchId}/managers/{userId}`
  - Remove branch manager: DELETE `/api/branches/{branchId}/managers/{userId}`
  - Fetch user managed branches: GET `/api/branches/users/{userId}/managed-branches/` or `/api/users/{userId}/managed-branches/` (both are used in different places)
  - Deactivate (soft delete): DELETE `/api/users/{userId}`
  - Permanently delete: DELETE `/api/users/{userId}/permanent`
  - Update role: PUT `/api/users/{userId}/role` (role-specific checks enforced server-side)
  - Update status: PUT `/api/users/{userId}/status`
  - Update activate/deactivate: PUT `/api/users/{userId}/activate` / `/deactivate`

## 3. Backend Routes & Services

- Main router: `backend/app/routes/userRoutes.py` (registered under `/api/users` in `main.py`).
  - `GET /api/users/search` — search users (pagination, filters: email, name, role, status)
  - `GET /api/users/` — list users (paginated)
  - `GET /api/users/{user_id}` — get user details
  - `GET /api/users/email/{email}` — get user by email
  - `PUT /api/users/{user_id}` — update user (requires `can_manage_users`)
  - `DELETE /api/users/{user_id}` — deactivate user (requires `can_manage_users`)
  - `DELETE /api/users/{user_id}/permanent` — permanent delete (requires `can_manage_users` and extra caution)
  - `PUT /api/users/{user_id}/role` — update role (extra role escalation checks)
  - `PUT /api/users/{user_id}/status` — update status
  - `PUT /api/users/{user_id}/activate` / `deactivate`
  - `POST /api/users/bulk-action` — bulk operations (activate, deactivate, delete)

- Branch manager endpoints (in `backend/app/routes/branchRoutes.py`):
  - `POST /api/branches/{branch_id}/managers/{user_id}` — assign manager
  - `DELETE /api/branches/{branch_id}/managers/{user_id}` — remove manager
  - `GET /api/branches/users/{user_id}/managed-branches/` — get branches managed by a user

## 4. Permissions & Security

- UI route protection: `/dashboard/manage-users` requires `can_manage_users` (see `frontend/src/lib/server/routePermissions.ts`).
- Backend enforcement: Many routes use `@require_permission("can_manage_users")` for mutating operations.
- Special checks:
  - Role assignment (`PUT /role`) prevents role escalation by verifying the acting user has `can_manage_roles` or full access and prevents users from elevating their own role to full-access.
  - Permanent deletes rely on `can_manage_users` and should be limited to super_admin/very restricted roles in practice.

## 5. Data Model / Important Fields

- `User` (not exhaustive): `id`, `email`, `first_name`, `last_name`, `role_id`/`role_name`, `status_id`/`status_name`, `active`, `created_at`, `updated_at`.
- Search responses: page, limit, total_count, total_pages and `users` array.

## 6. Findings — Unused Functions / Unreferenced Statuses


- Frontend:
  - `ManageUsers.tsx` and `EditUserManagement.tsx` are actively used; no obvious unused functions remain in these components.
  - Some endpoints are fetched from different paths in floating places (e.g., both `/api/branches/users/{userId}/managed-branches/` and `/api/users/{userId}/managed-branches/` are used); consider standardizing on a single canonical endpoint to reduce confusion.

- Backend:
  - `userRoutes.py` contains comprehensive endpoints; no unused route functions detected.
  - `userStatusRoutes.py` provides management endpoints for user statuses; make sure statuses registered via that route are actually used by clients — currently userRoutes supports filtering by status and userStatuses appear to be a maintained resource.



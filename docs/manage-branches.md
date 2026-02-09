# Manage Branches — Documentation

This document details the Manage Branches page and related backend APIs, permissions,and behaviors

## 1. Page Overview (Frontend)

- Path: `/dashboard/branch`
- Component: `frontend/src/app/[locale]/(protected)/dashboard/branch/page.tsx`
- Purpose: Create, list, edit, delete branches; manage branch addresses and assign managers.
- Key UI components:
  - `BranchFormModal` — Create / Edit branch
  - `BranchCard` — Display branch info with Edit/Delete actions
  - Search, organization filter, and branch list

## 2. Frontend API Usage

Endpoints used by the Manage Branches page:

- GET `/api/branches/public/` — list branches (public view) — used for initial listing and public map
- GET `/api/branches/` — list branches (authenticated) — used in some pages when auth is present
- GET `/api/branches/{branchId}` — get branch details
- POST `/api/branches/` — create branch
- PUT `/api/branches/{branchId}` — update branch
- DELETE `/api/branches/{branchId}` — delete branch
- GET `/api/branches/{branchId}/addresses` — list addresses of a branch
- POST `/api/addresses` — create address
- DELETE `/api/addresses/{addressId}` — delete address

Notes:
- `BranchFormModal` fetches organizations using `/api/organizations` to populate the organization dropdown.

## 3. Backend Routes & Services

- File: `backend/app/routes/branchRoutes.py`
  - Endpoints: create, get public branches, get branches (auth), get branch by id, update, delete, addresses endpoints, manager assignment endpoints, `my-managed-branches`.

- File: `backend/app/services/branchService.py`
  - Contains business logic: creation, update, deletion, assignment of branch managers, address management.

## 4. Permissions

- Route permissions mapping includes `/dashboard/branch` -> `can_manage_branches` (see `frontend/src/lib/server/routePermissions.ts`).
- Backend route decorators use `@require_permission("can_manage_branches")` for protected endpoints.
- Manager assignment requires `can_be_branch_manager` permission for the user being assigned (enforced in `BranchService.assign_branch_manager`).

## 5. Findings — Unused Functions / Unreferenced Statuses

I scanned both frontend and backend for unused functions and statuses related to branch management. Findings:

- Frontend:
  - `getSelectedOrganizationName` was removed/commented (the modal notes it was removed). No other obviously unused functions referenced in the page component.
  - Branch page uses `branches/public` for listings and `branches` for admin listings; both are used across the app.

- Backend:
  - No unused branch-related functions detected in `branchService.py` or `branchRoutes.py` — all functions are referenced by routes or other services (e.g., `assign_branch_manager`, `remove_branch_manager`, `get_branch_managers`, `get_user_managed_branches`).
  
- Permissions `can_assign_branch_managers`, `can_remove_branch_managers`, `can_view_branch_managers` exist in `cleanup_old_permissions.py` migration and may be legacy; however, the current access control consolidates them into `can_manage_branches`, which is the rule used in routes.

## 6. Statuses

- Branch entity statuses are not a first-class concept in the branch model; branches do not have multiple lifecycle statuses similar to `items`. The closest `status_id` appears on `User` for manager status but not on `Branch`.






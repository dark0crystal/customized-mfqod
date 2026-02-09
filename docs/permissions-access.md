# Permissions-based access — how it is used (Developer guide)

This guide explains how permission checks are performed across the codebase (backend + frontend), typical request flows, example usages, how to add or inspect permissions, and suggestions for testing and debugging.

---

## Overview 🔒

- The project uses a consolidated RBAC model: roles are granted permissions (like `can_manage_items`), and users are assigned roles.
- Permissions are authoritative and enforced in two ways:
  1. **Route decorators** (declarative): `@require_permission("<permission>")` applied at FastAPI route handlers.
 2. **Programmatic checks** (imperative): calls to `permissionServices.check_user_permission(...)` in code paths that need conditional logic.

Backend helpers live in `backend/app/services/permissionServices.py`. The decorator is implemented in `backend/app/utils/permission_decorator.py`.

---

## Typical request lifecycle (how permission checks happen) 🔁

1. Client sends request (e.g., `GET /api/items`) with authentication (session or JWT cookie).
2. Authentication middleware validates the user and attaches `current_user` / session to the request.
3. If a route has `@require_permission("X")`, the decorator runs before the route handler:
   - It calls `permissionServices.check_user_permission(session, user_id, "X")` (or similar).
   - If the check passes, the request proceeds; otherwise a 403 Forbidden is returned.
4. For flows that need granular logic (e.g., a branch manager may only act on branches they manage), the handler performs a programmatic check and enforces business rules.

> Note: `permissionServices.has_full_access(session, user_id)` provides an admin-style bypass when a user effectively has all permissions.

---

## Implementation patterns & examples 🔧

### 1) Declarative: route decorator

Example (Python / FastAPI):

```py
from backend.app.utils.permission_decorator import require_permission

@router.post("/items/approve")
@require_permission("can_manage_items")
def approve_item(...):
    # Handler runs only when the caller has the permission
    ...
```

This keeps authorization co-located and simple to reason about.

### 2) Programmatic: explicit check in code

Use this when decisions depend on additional context (which item, branch, or role):

```py
from backend.app.services.permissionServices import check_user_permission

if not await check_user_permission(db_session, current_user.id, "can_manage_branches"):
    raise HTTPException(status_code=403, detail="Forbidden")

# Additional domain checks (e.g., branch ownership) can follow
```

### 3) Frontend: route visibility & server-side rendering

- The frontend keeps a server-side mapping of routes → permissions (`frontend/src/lib/server/routePermissions.ts`) to hide links or UI elements from users who don't have the required permissions.
- Always treat frontend checks as UX-only: the backend enforces actual security.

---

## How to add a new permission (steps) ➕

1. Add a new permission row in `backend/setup_permissions.sql` (or via the `POST /api/permissions/add-new-permission` API protected by `can_manage_permissions`). Include a short description.
2. Add a migration or seed to insert the permission to existing environments.
3. Update any role fixtures to include the permission if desired (e.g., admin role).
4. Use `@require_permission("new_permission_name")` on the routes you want to protect, or add code-level `check_user_permission` checks where appropriate.
5. Add unit/integration tests to assert that users with the permission can access and others cannot.

---







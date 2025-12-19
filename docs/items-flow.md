# Items Flow — Full Documentation

This document describes the full lifecycle of items in the system: statuses, allowed transitions, claim assignment rules, actors/roles involved, API endpoints, UI screens, and example workflows.

## 1. Overview

An "item" is the central entity that users submit, reviewers approve/ reject, and agents or assignees work on. Items move through a set of statuses that reflect where they are in the process. Claims (or claim assignments) link items to a responsible person or team.

## 2. Actors / Roles

- Admin: Full system control; can change any status, reassign, override approvals.
- BranchAdmin: Manages items and assignments for a specific branch.
- Assignee / Agent: Works on assigned items (may be an employee or a team account).
- Requester / User: Creates/submits items and sees their item status.
- Approver: Reviews and approves/rejects submitted items.
- System / Automation: Background processes that may auto-assign or escalate items.

## 3. Item Statuses (canonical list)

The actual statuses implemented in the system:

- `pending` — Item is pending review/approval. This is the default status when an item is created.
- `approved` — Item has been approved and is eligible to be assigned to a claim. Approved items may be linked to missing items or assigned to users.
- `cancelled` — Item was cancelled and removed from active flow. Cancelled items are no longer available for assignment.

## 4. Allowed Status Transitions

The system supports the following status transitions:

- `pending` -> `approved` or `cancelled`
- `approved` -> `pending` or `cancelled`
- `cancelled` -> `pending` or `approved`

Notes:
- Only users with `can_manage_items` permission can perform status transitions.
- Status changes are enforced server-side (API and business logic). UI should disable invalid actions.
- When an item is approved, it can be linked to a claim via the `approved_claim_id` field.
- Status transitions are logged in the audit log for compliance and debugging.

## 5. Claim & Assignment Rules

Claims in this system represent ownership or assignment of an item to a person or team. Assignment rules below are configurable — implement them as pluggable policies.

Common assignment strategies:

- Manual assignment: BranchAdmin or Admin assigns an item to a user/claim via UI or API.
- Automatic branch-based assignment: Items are assigned to the default claim owner for the item's branch.
- Round-robin: Distribute assignments evenly among available agents.
- Skill/availability-based: Assign to an agent that matches item requirements (tags/skills) and is available.
- Escalation: If unassigned for X hours/days, escalate to BranchAdmin or next-level team.

Assignment constraints & checks:

- Permission check: The assignee must have the correct role/permission to accept items.
- Branch match: Unless cross-branch assignment is allowed, ensure assignee belongs to the same branch.
- Capacity limit: Optional per-agent open-work limit.

Reassignment rules:

- Only Admin or BranchAdmin can reassign by default, unless the assignee requests transfer.
- Reassignment should be audited: store previous `assigned_to`, `assigned_by`, `assigned_at`, and reason.

When an item becomes `assigned`:

- `assigned_to` (claim/user id) is set.
- `assigned_at` timestamp is set.
- A notification is sent to the assignee.
- Audit log entry is created.

## 6. Notifications & Audit

- Notify Requester on major state changes: approved, cancelled.
- Notify Claim users when their claim is approved and linked to an item.
- Record all status transitions in the `audit_logs` table with fields: `action_type` (ITEM_STATUS_CHANGED), `entity_type`, `entity_id`, `user_id`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_at`.

## 7. Suggested API Endpoints

Below are example endpoints and payloads. Adapt to your actual routes (see `backend/app/routes/claimRoutes.py`, `claimRoutes`, `claim` files in the repository).

- GET `/api/items` — list items (filters: status, branch, assigned_to, created_by)
  - Query params: `status`, `branch_id`, `assigned_to`, `limit`, `offset`

- POST `/api/items` — create an item
  - Body: `{ title, description, branch_id, metadata, created_by }

- PATCH `/api/items/:id/approve` — approve an item (changes status from pending to approved, requires approved claim)

- PATCH `/api/items/:id/status` — change status
  - Query param: `new_status` (one of: `pending`, `approved`, `cancelled`)
  - Authorization: Requires `can_manage_items` permission.
  - Creates audit log entry for status change.

- POST `/api/items/:id/assign` — assign item to a claim/user
  - Body: `{ assigned_to: <user_id>, assigned_by: <user_id>, reason?: string }

- GET `/api/items/:id/history` — return audit trail for the item

- POST `/api/items/:id/reassign` — reassign with reason

Security notes:
- All mutating endpoints must verify caller roles and branch scope.
- Log who performed the action and when.

## 8. UI Screens / UX

- Item Create screen — create items with default `pending` status.
- Items Dashboard — list items filtered by status (`pending`, `approved`, `cancelled`).
- Item Detail screen — view item details, change status, manage claims.
- Claims Management — approve/reject claims and link approved claims to items.
- Item Timeline / Activity — show audit log history for status changes.

UX guidelines:

- Show current status prominently on item header with color-coded badges (pending: orange, approved: green, cancelled: red).
- Disable invalid status transitions based on current status and user permissions.
- Status dropdown should only show valid transitions based on current status.
- Show approved claim information when an item has an `approved_claim_id`.

## 9. Example Workflows

1) Create → Pending → Approve → Assign Claim

- User creates an item via `POST /api/items`. Item is created with `pending` status by default.
- Admin or BranchAdmin reviews the item and approves it via `PATCH /api/items/:id/status` with status `approved`.
- When a claim is approved for the item, the system sets `approved_claim_id` linking the item to the approved claim.
- Item can be cancelled via `PATCH /api/items/:id/status` with status `cancelled` if needed.

2) Approve → Cancel → Re-approve

- Admin approves an item via `PATCH /api/items/:id/status` with status `approved`.
- Later, admin cancels the item via `PATCH /api/items/:id/status` with status `cancelled`.
- If needed, admin can change status back to `pending` or `approved` via status update endpoint.

3) Claim Assignment Flow

- Item starts with `pending` status.
- User submits a claim for the item.
- Admin approves the item (status becomes `approved`).
- Admin approves a claim and links it to the item via `approved_claim_id`.
- The item remains `approved` but is now associated with an approved claim.

## 10. Data Model (fields to include)

- `id` (uuid or int)
- `title`, `description`
- `status` (enum)
- `branch_id`
- `created_by`, `created_at`
- `approved_by`, `approved_at`
- `assigned_to`, `assigned_at`
- `claim_id` (if applicable)
- `metadata` (json)
- `priority`, `tags`

## 11. Implementation Notes / Best Practices

- Enforce transitions server-side using a state machine pattern or a transitions map.
- Keep assignment logic separate from status transitions. For example, only change status to `assigned` after successfully creating assignment and sending notifications.
- Make assignment strategies pluggable (manual, round-robin, skill-based).
- Keep an immutable audit trail for compliance and debugging.
- Add metrics for SLA: time-to-approve, time-to-assign, time-to-complete.

## 12. Implementation Status

- ✅ Status names have been confirmed: `pending`, `approved`, `cancelled` (as defined in `backend/app/models.py` and `backend/app/schemas/item_schema.py`).
- ✅ API endpoints are documented and match the actual implementation in `backend/app/routes/itemRoutes.py`.
- ✅ Status transitions are enforced server-side with proper permission checks.
- ✅ Audit logging is implemented for status changes via `AuditLog` model.



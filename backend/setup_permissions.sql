-- ============================================================
-- PERMISSIONS & ROLES SETUP
-- ============================================================
--
-- This script:
--   1. Inserts all required permissions into the database
--   2. Creates three roles: super_admin, moderator, user
--   3. Assigns ALL permissions to super_admin
--   4. Assigns item-management permissions to moderator
--   5. Assigns NO permissions to user (basic authenticated user)
--
-- ============================================================
-- HOW TO RUN
-- ============================================================
--
-- Option 1: Using psql command line
--   psql -U your_username -d your_database_name -f setup_permissions.sql
--
-- Option 2: Using connection string
--   psql "postgresql://user:password@localhost:5432/dbname" -f setup_permissions.sql
--
-- Option 3: From within psql
--   \i /path/to/setup_permissions.sql
--
-- Option 4: Using Python (if you have a run script)
--   python run_migration.py  # if it supports SQL files
--
-- Prerequisites:
--   - Database must exist and migrations must be applied
--   - Tables: permissions, role, role_permissions must exist
--
-- ============================================================
-- SCRIPT CONTENTS
-- ============================================================

-- ------------------------------------------------------------
-- SECTION 1: PERMISSIONS
-- ------------------------------------------------------------
-- All permissions used by the application. Uses ON CONFLICT to skip
-- duplicates if run multiple times.

-- Item management
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_items', 'Full item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own items.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_missing_items', 'Full missing item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own missing items.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_item_types', 'Full item type management (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Claims & transfer requests
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_claims', 'Full claim management (view, create, process/approve/reject)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_transfer_requests', 'Full transfer request management (create, view, approve, reject)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Organizations, branches, addresses
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_branches', 'Full branch management (create, view, edit, delete, manage managers)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_addresses', 'Full address management (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_organizations', 'Full organization management (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- User management
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_users', 'Full user management access (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- System & admin
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_view_system_logs', 'Can view system logs', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_audit_logs', 'Can view audit logs and audit trail', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_roles', 'Can create, edit, delete roles', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_permissions', 'Can manage permission assignments to roles', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_analytics', 'Can view system analytics and statistics', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_configure_system', 'Can configure system settings', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;


-- ------------------------------------------------------------
-- SECTION 2: ROLES
-- ------------------------------------------------------------
-- Creates super_admin, moderator, and user roles if they do not exist.

INSERT INTO role (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'super_admin', 'Full system access. All permissions granted.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO role (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'moderator', 'Content moderator. Can manage items, missing items, claims, item types, transfer requests, and view analytics.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO role (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'user', 'Basic authenticated user. No admin permissions. Can report items and claim their own.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;


-- ------------------------------------------------------------
-- SECTION 3: SUPER_ADMIN - ALL PERMISSIONS
-- ------------------------------------------------------------
-- Assigns every permission to the super_admin role.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ------------------------------------------------------------
-- SECTION 4: MODERATOR - ITEM MANAGEMENT PERMISSIONS
-- ------------------------------------------------------------
-- Assigns permissions needed to manage items, claims, and related content.
-- Does NOT include: user management, branches, organizations, roles,
-- permissions, system config, or system logs.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permissions p
WHERE r.name = 'moderator'
  AND p.name IN (
    'can_manage_items',
    'can_manage_missing_items',
    'can_manage_item_types',
    'can_manage_claims',
    'can_manage_transfer_requests',
    'can_view_analytics'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ------------------------------------------------------------
-- SECTION 5: USER ROLE - NO PERMISSIONS
-- ------------------------------------------------------------
-- The user role receives no permissions. Regular users can still:
-- - Report found items
-- - Report missing items
-- - Claim items they reported
-- - View their own dashboard
-- These actions do not require special permissions.
-- (No INSERT needed - user role has zero role_permissions)


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after the script to verify the setup:
--
-- 1. Count permissions (expected: 15):
--    SELECT COUNT(*) FROM permissions;
--
-- 2. List all permissions:
--    SELECT name, description FROM permissions ORDER BY name;
--
-- 3. Permissions per role:
--    SELECT r.name AS role_name, COUNT(rp.permission_id) AS permission_count
--    FROM role r
--    LEFT JOIN role_permissions rp ON r.id = rp.role_id
--    WHERE r.name IN ('super_admin', 'moderator', 'user')
--    GROUP BY r.name;
--
-- 4. Permissions assigned to super_admin:
--    SELECT p.name FROM role_permissions rp
--    JOIN role r ON r.id = rp.role_id
--    JOIN permissions p ON p.id = rp.permission_id
--    WHERE r.name = 'super_admin' ORDER BY p.name;
--
-- 5. Permissions assigned to moderator:
--    SELECT p.name FROM role_permissions rp
--    JOIN role r ON r.id = rp.role_id
--    JOIN permissions p ON p.id = rp.permission_id
--    WHERE r.name = 'moderator' ORDER BY p.name;
--
-- ============================================================

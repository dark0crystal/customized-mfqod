-- ============================================================
-- Production Setup: Initialize Permissions
-- ============================================================
-- This SQL script adds all required permissions to the database.
-- Run this script once during production deployment.
--
-- Usage:
--   psql -U your_user -d your_database -f setup_permissions.sql
--   OR
--   mysql -u your_user -p your_database < setup_permissions.sql
--
-- Note: This script uses INSERT ... ON CONFLICT (PostgreSQL) or 
-- INSERT IGNORE (MySQL) to skip duplicates.
-- ============================================================

-- PostgreSQL version (use this for PostgreSQL)
-- ============================================================

-- Items Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_items', 'Full item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own items.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Missing Items Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_missing_items', 'Full missing item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own missing items.', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Item Types Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_item_types', 'Full item type management (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Branches Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_branches', 'Full branch management (create, view, edit, delete, manage managers)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Addresses Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_addresses', 'Full address management (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Organizations Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_organizations', 'Full organization management (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Users Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_users', 'Full user management access (create, view, edit, delete)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Claims Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_claims', 'Full claim management (view, create, process/approve/reject)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- System & Admin Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'admin', 'Admin access - full system access', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_system_logs', 'Can view system logs', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_roles', 'Can create/edit/delete roles', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_permissions', 'Can manage permission assignments', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_analytics', 'Can view system analytics and statistics', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_configure_system', 'Can configure system settings', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_access_admin', 'Can access admin panel', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Transfer Requests Permissions (Consolidated)
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_manage_transfer_requests', 'Full transfer request management (create, view, approve, reject)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- MySQL version (use this for MySQL/MariaDB)
-- ============================================================
-- Uncomment the section below if using MySQL instead of PostgreSQL

/*
-- Items Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_items', 'Full item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own items.', NOW(), NOW());

-- Missing Items Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_missing_items', 'Full missing item management (create, view, edit, delete, approve, restore, bulk operations). Users can always access their own missing items.', NOW(), NOW());

-- Item Types Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_item_types', 'Full item type management (create, view, edit, delete)', NOW(), NOW());

-- Branches Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_branches', 'Full branch management (create, view, edit, delete, manage managers)', NOW(), NOW());

-- Addresses Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_addresses', 'Full address management (create, view, edit, delete)', NOW(), NOW());

-- Organizations Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_organizations', 'Full organization management (create, view, edit, delete)', NOW(), NOW());

-- Users Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_users', 'Full user management access (create, view, edit, delete)', NOW(), NOW());

-- Claims Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_claims', 'Full claim management (view, create, process/approve/reject)', NOW(), NOW());

-- System & Admin Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'admin', 'Admin access - full system access', NOW(), NOW()),
    (UUID(), 'can_view_system_logs', 'Can view system logs', NOW(), NOW()),
    (UUID(), 'can_manage_roles', 'Can create/edit/delete roles', NOW(), NOW()),
    (UUID(), 'can_manage_permissions', 'Can manage permission assignments', NOW(), NOW()),
    (UUID(), 'can_view_analytics', 'Can view system analytics and statistics', NOW(), NOW()),
    (UUID(), 'can_configure_system', 'Can configure system settings', NOW(), NOW()),
    (UUID(), 'can_access_admin', 'Can access admin panel', NOW(), NOW());

-- Transfer Requests Permissions (Consolidated)
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_manage_transfer_requests', 'Full transfer request management (create, view, approve, reject)', NOW(), NOW());
*/

-- ============================================================
-- Verification Query
-- ============================================================
-- Run this query to verify all permissions were inserted:
-- SELECT COUNT(*) as total_permissions FROM permissions;
-- Expected: 20 permissions (consolidated from 50+ granular permissions)

-- To see all permissions:
-- SELECT name, description FROM permissions ORDER BY name;


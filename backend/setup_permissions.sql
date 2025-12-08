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

-- Items Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_items', 'Can create new lost/found items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_items', 'Can view lost/found items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_own_items', 'Can view own lost/found items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_items', 'Can edit item details', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_approve_items', 'Can approve/reject item reports', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_items', 'Can delete items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_restore_items', 'Can restore deleted items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_bulk_delete_items', 'Can delete multiple items at once', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_bulk_edit_items', 'Can edit multiple items at once', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_claims', 'Can manage item claims', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_statistics', 'Can view system statistics and analytics', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Missing Items Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_missing_items', 'Can report missing items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_missing_items', 'Can view missing items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_own_missing_items', 'Can view own missing items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_missing_items', 'Can edit missing item details', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_approve_missing_items', 'Can approve/reject missing item reports', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_missing_items', 'Can manage missing items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_missing_items', 'Can delete missing items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_restore_missing_items', 'Can restore deleted missing items', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_bulk_delete_missing_items', 'Can delete multiple missing items at once', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_bulk_edit_missing_items', 'Can edit multiple missing items at once', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Item Types Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_item_types', 'Can create new item types', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_item_types', 'Can view item types', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_item_types', 'Can edit item types', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_item_types', 'Can delete item types', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_item_types', 'Full item type management access', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Branches Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_branches', 'Can create new branches', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_branches', 'Can view branches', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_branches', 'Can edit branch details', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_branches', 'Can delete branches', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_own_branches', 'Can view own managed branches', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_user_branches', 'Can view user branch assignments', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_assign_branch_managers', 'Can assign branch managers', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_remove_branch_managers', 'Can remove branch managers', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_branch_managers', 'Can view branch managers', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Addresses Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_addresses', 'Can create addresses', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_addresses', 'Can view addresses', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_addresses', 'Can edit addresses', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_addresses', 'Can delete addresses', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Organizations Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_organizations', 'Can create new organizations', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_organizations', 'Can view organizations', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_organizations', 'Can edit organization details', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_organizations', 'Can delete organizations', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Users Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_view_users', 'Can view user profiles and lists', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_create_users', 'Can create new user accounts', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_edit_users', 'Can edit user profiles and settings', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_delete_users', 'Can delete user accounts', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_users', 'Full user management access', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Claims Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_view_claims', 'Can view item claims', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_create_claims', 'Can create item claims', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_process_claims', 'Can approve/reject claims', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- System & Admin Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'admin', 'Admin access - full system access', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_system_logs', 'Can view system logs', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_roles', 'Can create/edit/delete roles', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_permissions', 'Can manage permission assignments', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_analytics', 'Can view system analytics and reports', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_configure_system', 'Can configure system settings', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_access_admin', 'Can access admin panel', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Transfer Requests Permissions
INSERT INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (gen_random_uuid()::text, 'can_create_transfer_requests', 'Can create branch transfer requests', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_view_transfer_requests', 'Can view transfer requests', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_approve_transfer_requests', 'Can approve transfer requests', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_reject_transfer_requests', 'Can reject transfer requests', NOW(), NOW()),
    (gen_random_uuid()::text, 'can_manage_transfer_requests', 'Can manage all transfer requests', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- MySQL version (use this for MySQL/MariaDB)
-- ============================================================
-- Uncomment the section below if using MySQL instead of PostgreSQL

/*
-- Items Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_items', 'Can create new lost/found items', NOW(), NOW()),
    (UUID(), 'can_view_items', 'Can view lost/found items', NOW(), NOW()),
    (UUID(), 'can_view_own_items', 'Can view own lost/found items', NOW(), NOW()),
    (UUID(), 'can_edit_items', 'Can edit item details', NOW(), NOW()),
    (UUID(), 'can_approve_items', 'Can approve/reject item reports', NOW(), NOW()),
    (UUID(), 'can_delete_items', 'Can delete items', NOW(), NOW()),
    (UUID(), 'can_restore_items', 'Can restore deleted items', NOW(), NOW()),
    (UUID(), 'can_bulk_delete_items', 'Can delete multiple items at once', NOW(), NOW()),
    (UUID(), 'can_bulk_edit_items', 'Can edit multiple items at once', NOW(), NOW()),
    (UUID(), 'can_manage_claims', 'Can manage item claims', NOW(), NOW()),
    (UUID(), 'can_view_statistics', 'Can view system statistics and analytics', NOW(), NOW());

-- Missing Items Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_missing_items', 'Can report missing items', NOW(), NOW()),
    (UUID(), 'can_view_missing_items', 'Can view missing items', NOW(), NOW()),
    (UUID(), 'can_view_own_missing_items', 'Can view own missing items', NOW(), NOW()),
    (UUID(), 'can_edit_missing_items', 'Can edit missing item details', NOW(), NOW()),
    (UUID(), 'can_approve_missing_items', 'Can approve/reject missing item reports', NOW(), NOW()),
    (UUID(), 'can_manage_missing_items', 'Can manage missing items', NOW(), NOW()),
    (UUID(), 'can_delete_missing_items', 'Can delete missing items', NOW(), NOW()),
    (UUID(), 'can_restore_missing_items', 'Can restore deleted missing items', NOW(), NOW()),
    (UUID(), 'can_bulk_delete_missing_items', 'Can delete multiple missing items at once', NOW(), NOW()),
    (UUID(), 'can_bulk_edit_missing_items', 'Can edit multiple missing items at once', NOW(), NOW());

-- Item Types Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_item_types', 'Can create new item types', NOW(), NOW()),
    (UUID(), 'can_view_item_types', 'Can view item types', NOW(), NOW()),
    (UUID(), 'can_edit_item_types', 'Can edit item types', NOW(), NOW()),
    (UUID(), 'can_delete_item_types', 'Can delete item types', NOW(), NOW()),
    (UUID(), 'can_manage_item_types', 'Full item type management access', NOW(), NOW());

-- Branches Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_branches', 'Can create new branches', NOW(), NOW()),
    (UUID(), 'can_view_branches', 'Can view branches', NOW(), NOW()),
    (UUID(), 'can_edit_branches', 'Can edit branch details', NOW(), NOW()),
    (UUID(), 'can_delete_branches', 'Can delete branches', NOW(), NOW()),
    (UUID(), 'can_view_own_branches', 'Can view own managed branches', NOW(), NOW()),
    (UUID(), 'can_view_user_branches', 'Can view user branch assignments', NOW(), NOW()),
    (UUID(), 'can_assign_branch_managers', 'Can assign branch managers', NOW(), NOW()),
    (UUID(), 'can_remove_branch_managers', 'Can remove branch managers', NOW(), NOW()),
    (UUID(), 'can_view_branch_managers', 'Can view branch managers', NOW(), NOW());

-- Addresses Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_addresses', 'Can create addresses', NOW(), NOW()),
    (UUID(), 'can_view_addresses', 'Can view addresses', NOW(), NOW()),
    (UUID(), 'can_edit_addresses', 'Can edit addresses', NOW(), NOW()),
    (UUID(), 'can_delete_addresses', 'Can delete addresses', NOW(), NOW());

-- Organizations Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_organizations', 'Can create new organizations', NOW(), NOW()),
    (UUID(), 'can_view_organizations', 'Can view organizations', NOW(), NOW()),
    (UUID(), 'can_edit_organizations', 'Can edit organization details', NOW(), NOW()),
    (UUID(), 'can_delete_organizations', 'Can delete organizations', NOW(), NOW());

-- Users Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_view_users', 'Can view user profiles and lists', NOW(), NOW()),
    (UUID(), 'can_create_users', 'Can create new user accounts', NOW(), NOW()),
    (UUID(), 'can_edit_users', 'Can edit user profiles and settings', NOW(), NOW()),
    (UUID(), 'can_delete_users', 'Can delete user accounts', NOW(), NOW()),
    (UUID(), 'can_manage_users', 'Full user management access', NOW(), NOW());

-- Claims Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_view_claims', 'Can view item claims', NOW(), NOW()),
    (UUID(), 'can_create_claims', 'Can create item claims', NOW(), NOW()),
    (UUID(), 'can_process_claims', 'Can approve/reject claims', NOW(), NOW());

-- System & Admin Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'admin', 'Admin access - full system access', NOW(), NOW()),
    (UUID(), 'can_view_system_logs', 'Can view system logs', NOW(), NOW()),
    (UUID(), 'can_manage_roles', 'Can create/edit/delete roles', NOW(), NOW()),
    (UUID(), 'can_manage_permissions', 'Can manage permission assignments', NOW(), NOW()),
    (UUID(), 'can_view_analytics', 'Can view system analytics and reports', NOW(), NOW()),
    (UUID(), 'can_configure_system', 'Can configure system settings', NOW(), NOW()),
    (UUID(), 'can_access_admin', 'Can access admin panel', NOW(), NOW());

-- Transfer Requests Permissions
INSERT IGNORE INTO permissions (id, name, description, created_at, updated_at)
VALUES 
    (UUID(), 'can_create_transfer_requests', 'Can create branch transfer requests', NOW(), NOW()),
    (UUID(), 'can_view_transfer_requests', 'Can view transfer requests', NOW(), NOW()),
    (UUID(), 'can_approve_transfer_requests', 'Can approve transfer requests', NOW(), NOW()),
    (UUID(), 'can_reject_transfer_requests', 'Can reject transfer requests', NOW(), NOW()),
    (UUID(), 'can_manage_transfer_requests', 'Can manage all transfer requests', NOW(), NOW());
*/

-- ============================================================
-- Verification Query
-- ============================================================
-- Run this query to verify all permissions were inserted:
-- SELECT COUNT(*) as total_permissions FROM permissions;
-- Expected: 70 permissions

-- To see all permissions:
-- SELECT name, description FROM permissions ORDER BY name;


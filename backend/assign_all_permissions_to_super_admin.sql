-- ============================================================
-- Assign All Permissions to Super Admin Role
-- ============================================================
-- This SQL script assigns all available permissions to the super_admin role.
-- 
-- Super Admin Role ID: 3ddcf133-53ec-45ce-8f42-07317169a96f
--
-- Usage:
--   psql -U your_user -d your_database -f assign_all_permissions_to_super_admin.sql
--   OR execute directly in your database client
--
-- Note: This script uses INSERT ... ON CONFLICT DO NOTHING to skip duplicates
-- ============================================================

-- First, ensure all permissions exist in the database
-- (This is a safety check - permissions should already exist from setup_permissions.py)

-- Assign all permissions to super_admin role
-- This query will:
-- 1. Get the super_admin role ID
-- 2. Get all permission IDs from the permissions table
-- 3. Insert them into role_permissions table
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    '3ddcf133-53ec-45ce-8f42-07317169a96f' AS role_id,
    p.id AS permission_id
FROM permissions p
WHERE NOT EXISTS (
    SELECT 1 
    FROM role_permissions rp 
    WHERE rp.role_id = '3ddcf133-53ec-45ce-8f42-07317169a96f'
    AND rp.permission_id = p.id
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Verification Query
-- Run this query to verify all permissions were assigned:
-- 
-- SELECT 
--     COUNT(*) as total_permissions_assigned,
--     (SELECT COUNT(*) FROM permissions) as total_permissions_available
-- FROM role_permissions 
-- WHERE role_id = '3ddcf133-53ec-45ce-8f42-07317169a96f';
--
-- Expected: total_permissions_assigned should equal total_permissions_available

-- To see all permissions assigned to super_admin:
-- 
-- SELECT 
--     p.name AS permission_name,
--     p.description
-- FROM role_permissions rp
-- JOIN permissions p ON rp.permission_id = p.id
-- WHERE rp.role_id = '3ddcf133-53ec-45ce-8f42-07317169a96f'
-- ORDER BY p.name;

-- ============================================================
-- List of all permissions that should be assigned:
-- ============================================================
-- 1. can_manage_items
-- 2. can_manage_missing_items
-- 3. can_manage_item_types
-- 4. can_manage_branches
-- 5. can_manage_addresses
-- 6. can_manage_organizations
-- 7. can_manage_users
-- 8. can_manage_claims
-- 9. can_manage_transfer_requests
-- 10. admin
-- 11. can_view_system_logs
-- 12. can_manage_roles
-- 13. can_manage_permissions
-- 14. can_view_analytics
-- 15. can_configure_system
-- ============================================================


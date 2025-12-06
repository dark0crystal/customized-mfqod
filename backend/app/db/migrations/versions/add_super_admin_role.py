"""Add super_admin role

Revision ID: add_super_admin_role
Revises: auth_system_001
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_super_admin_role'
down_revision = 'auth_system_001'
branch_labels = None
depends_on = None

def upgrade():
    """Add super_admin role"""
    # Insert super_admin role if it doesn't exist
    op.execute("""
        INSERT INTO role (id, name, description, created_at, updated_at) 
        VALUES 
            (gen_random_uuid()::text, 'super_admin', 'Super Administrator with full system access', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
    """)
    
    # Assign all permissions to super_admin role
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id 
        FROM role r, permissions p 
        WHERE r.name = 'super_admin'
        ON CONFLICT DO NOTHING;
    """)

def downgrade():
    """Remove super_admin role"""
    # Remove super_admin role permissions
    op.execute("""
        DELETE FROM role_permissions 
        WHERE role_id IN (SELECT id FROM role WHERE name = 'super_admin');
    """)
    
    # Remove super_admin role
    op.execute("""
        DELETE FROM role WHERE name = 'super_admin';
    """)

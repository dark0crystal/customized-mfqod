"""Enhanced Authentication System Migration

Revision ID: auth_system_001
Revises: f7e97a89ad49
Create Date: 2025-01-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'auth_system_001'
down_revision = 'f7e97a89ad49'
branch_labels = None
depends_on = None

def upgrade():
    """Upgrade to enhanced authentication system"""
    
    # Create enum types
    op.execute("CREATE TYPE usertype AS ENUM ('internal', 'external')")
    op.execute("CREATE TYPE loginattempttstatus AS ENUM ('success', 'failed', 'blocked')")
    
    # Add new columns to existing user table
    op.add_column('user', sa.Column('username', sa.String(), nullable=True))
    op.add_column('user', sa.Column('user_type', sa.Enum('internal', 'external', name='usertype'), nullable=False, server_default='external'))
    op.add_column('user', sa.Column('ad_sync_date', sa.DateTime(), nullable=True))
    op.add_column('user', sa.Column('is_locked', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('user', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user', sa.Column('locked_until', sa.DateTime(), nullable=True))
    op.add_column('user', sa.Column('last_login', sa.DateTime(), nullable=True))
    
    # Create unique index on username
    op.create_index('ix_user_username', 'user', ['username'], unique=True)
    
    # Create login_attempts table
    op.create_table(
        'login_attempts',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=True),
        sa.Column('email_or_username', sa.String(), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('success', 'failed', 'blocked', name='loginattempttstatus'), nullable=False),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    
    # Create indexes for login_attempts
    op.create_index('ix_login_attempts_email_or_username', 'login_attempts', ['email_or_username'])
    op.create_index('ix_login_attempts_ip_address', 'login_attempts', ['ip_address'])
    op.create_index('ix_login_attempts_created_at', 'login_attempts', ['created_at'])
    op.create_index('ix_login_attempts_status', 'login_attempts', ['status'])
    
    # Create user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('session_token', sa.String(), nullable=False, unique=True),
        sa.Column('ip_address', sa.String(), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    
    # Create indexes for user_sessions
    op.create_index('ix_user_sessions_session_token', 'user_sessions', ['session_token'], unique=True)
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_expires_at', 'user_sessions', ['expires_at'])
    op.create_index('ix_user_sessions_is_active', 'user_sessions', ['is_active'])
    
    # Create ad_sync_logs table
    op.create_table(
        'ad_sync_logs',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('sync_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('users_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('users_updated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('users_deactivated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now())
    )
    
    # Create indexes for ad_sync_logs
    op.create_index('ix_ad_sync_logs_sync_type', 'ad_sync_logs', ['sync_type'])
    op.create_index('ix_ad_sync_logs_status', 'ad_sync_logs', ['status'])
    op.create_index('ix_ad_sync_logs_started_at', 'ad_sync_logs', ['started_at'])
    
    # Insert default roles if they don't exist
    op.execute("""
        INSERT INTO role (id, name, description, created_at, updated_at) 
        VALUES 
            (gen_random_uuid()::text, 'admin', 'System Administrator with full access', NOW(), NOW()),
            (gen_random_uuid()::text, 'staff', 'University Staff with elevated privileges', NOW(), NOW()),
            (gen_random_uuid()::text, 'student', 'University Student with basic access', NOW(), NOW()),
            (gen_random_uuid()::text, 'external', 'External User with limited access', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
    """)
    
    # Insert default permissions
    op.execute("""
        INSERT INTO permissions (id, name, description, created_at, updated_at) 
        VALUES 
            (gen_random_uuid()::text, 'read_items', 'Read lost and found items', NOW(), NOW()),
            (gen_random_uuid()::text, 'create_items', 'Create lost and found items', NOW(), NOW()),
            (gen_random_uuid()::text, 'update_items', 'Update lost and found items', NOW(), NOW()),
            (gen_random_uuid()::text, 'delete_items', 'Delete lost and found items', NOW(), NOW()),
            (gen_random_uuid()::text, 'approve_items', 'Approve/reject items', NOW(), NOW()),
            (gen_random_uuid()::text, 'manage_users', 'Manage user accounts', NOW(), NOW()),
            (gen_random_uuid()::text, 'manage_roles', 'Manage roles and permissions', NOW(), NOW()),
            (gen_random_uuid()::text, 'view_reports', 'View system reports', NOW(), NOW()),
            (gen_random_uuid()::text, 'manage_branches', 'Manage branch locations', NOW(), NOW()),
            (gen_random_uuid()::text, 'system_admin', 'Full system administration', NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
    """)
    
    # Assign permissions to roles
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id 
        FROM role r, permissions p 
        WHERE r.name = 'admin' 
        ON CONFLICT DO NOTHING;
    """)
    
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id 
        FROM role r, permissions p 
        WHERE r.name = 'staff' AND p.name IN ('read_items', 'create_items', 'update_items', 'approve_items', 'view_reports')
        ON CONFLICT DO NOTHING;
    """)
    
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id 
        FROM role r, permissions p 
        WHERE r.name = 'student' AND p.name IN ('read_items', 'create_items')
        ON CONFLICT DO NOTHING;
    """)
    
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id 
        FROM role r, permissions p 
        WHERE r.name = 'external' AND p.name IN ('read_items')
        ON CONFLICT DO NOTHING;
    """)
    
    # Update existing users to have default external role if no role assigned
    op.execute("""
        UPDATE "user" 
        SET role_id = (SELECT id FROM role WHERE name = 'external' LIMIT 1)
        WHERE role_id IS NULL;
    """)

def downgrade():
    """Downgrade from enhanced authentication system"""
    
    # Drop new tables
    op.drop_table('ad_sync_logs')
    op.drop_table('user_sessions')
    op.drop_table('login_attempts')
    
    # Remove new columns from user table
    op.drop_index('ix_user_username', 'user')
    op.drop_column('user', 'last_login')
    op.drop_column('user', 'locked_until')
    op.drop_column('user', 'failed_login_attempts')
    op.drop_column('user', 'is_locked')
    op.drop_column('user', 'ad_sync_date')
    op.drop_column('user', 'user_type')
    op.drop_column('user', 'username')
    
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS loginattempttstatus")
    op.execute("DROP TYPE IF EXISTS usertype")
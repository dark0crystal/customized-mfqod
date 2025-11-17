"""Add EmailVerification table

Revision ID: add_email_verification
Revises: auth_system_001
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_email_verification'
down_revision = 'auth_system_001'
branch_labels = None
depends_on = None


def upgrade():
    """Create email_verifications table"""
    op.create_table(
        'email_verifications',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('otp_code', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
    )
    
    # Create indexes
    op.create_index('ix_email_verifications_email', 'email_verifications', ['email'])
    op.create_index('ix_email_verifications_expires_at', 'email_verifications', ['expires_at'])


def downgrade():
    """Drop email_verifications table"""
    op.drop_index('ix_email_verifications_expires_at', table_name='email_verifications')
    op.drop_index('ix_email_verifications_email', table_name='email_verifications')
    op.drop_table('email_verifications')



"""Add branch transfer requests

Revision ID: add_branch_transfer_requests
Revises: add_missing_item_model
Create Date: 2024-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_branch_transfer_requests'
down_revision = 'add_missing_item_model'
branch_labels = None
depends_on = None


def upgrade():
    # Create TransferStatus enum type
    op.execute("CREATE TYPE transferstatus AS ENUM ('pending', 'approved', 'rejected', 'completed')")
    
    # Create branch_transfer_requests table
    op.create_table('branch_transfer_requests',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('item_id', sa.String(), nullable=False),
        sa.Column('from_branch_id', sa.String(), nullable=False),
        sa.Column('to_branch_id', sa.String(), nullable=False),
        sa.Column('requested_by', sa.String(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'approved', 'rejected', 'completed', name='transferstatus'), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['item.id'], ),
        sa.ForeignKeyConstraint(['from_branch_id'], ['branch.id'], ),
        sa.ForeignKeyConstraint(['to_branch_id'], ['branch.id'], ),
        sa.ForeignKeyConstraint(['requested_by'], ['user.id'], ),
        sa.ForeignKeyConstraint(['approved_by'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_branch_transfer_requests_id'), 'branch_transfer_requests', ['id'], unique=False)
    op.create_index(op.f('ix_branch_transfer_requests_item_id'), 'branch_transfer_requests', ['item_id'], unique=False)
    op.create_index(op.f('ix_branch_transfer_requests_from_branch_id'), 'branch_transfer_requests', ['from_branch_id'], unique=False)
    op.create_index(op.f('ix_branch_transfer_requests_to_branch_id'), 'branch_transfer_requests', ['to_branch_id'], unique=False)
    op.create_index(op.f('ix_branch_transfer_requests_requested_by'), 'branch_transfer_requests', ['requested_by'], unique=False)
    op.create_index(op.f('ix_branch_transfer_requests_status'), 'branch_transfer_requests', ['status'], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index(op.f('ix_branch_transfer_requests_status'), table_name='branch_transfer_requests')
    op.drop_index(op.f('ix_branch_transfer_requests_requested_by'), table_name='branch_transfer_requests')
    op.drop_index(op.f('ix_branch_transfer_requests_to_branch_id'), table_name='branch_transfer_requests')
    op.drop_index(op.f('ix_branch_transfer_requests_from_branch_id'), table_name='branch_transfer_requests')
    op.drop_index(op.f('ix_branch_transfer_requests_item_id'), table_name='branch_transfer_requests')
    op.drop_index(op.f('ix_branch_transfer_requests_id'), table_name='branch_transfer_requests')
    
    # Drop table
    op.drop_table('branch_transfer_requests')
    
    # Drop enum type
    op.execute("DROP TYPE transferstatus")


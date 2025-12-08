"""Add approved_claim_id to item table

Revision ID: add_approved_claim_id_to_item
Revises: add_branch_transfer_requests
Create Date: 2024-01-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_approved_claim_id_to_item'
down_revision = 'add_branch_transfer_requests'
branch_labels = None
depends_on = None


def upgrade():
    # Add approved_claim_id column to item table
    op.add_column('item', sa.Column('approved_claim_id', sa.String(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_item_approved_claim',
        'item',
        'claim',
        ['approved_claim_id'],
        ['id']
    )
    
    # Create index for better query performance
    op.create_index(
        op.f('ix_item_approved_claim_id'),
        'item',
        ['approved_claim_id'],
        unique=False
    )


def downgrade():
    # Drop index
    op.drop_index(op.f('ix_item_approved_claim_id'), table_name='item')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_item_approved_claim', 'item', type_='foreignkey')
    
    # Drop column
    op.drop_column('item', 'approved_claim_id')


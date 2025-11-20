"""Add MissingItem model

Revision ID: add_missing_item_model
Revises: 2d886e1946c2
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_missing_item_model'
down_revision = '2d886e1946c2'
branch_labels = None
depends_on = None


def upgrade():
    # Create missingitem table
    op.create_table('missingitem',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('approval', sa.Boolean(), nullable=False),
        sa.Column('temporary_deletion', sa.Boolean(), nullable=False),
        sa.Column('item_type_id', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['item_type_id'], ['itemtype.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_missingitem_id'), 'missingitem', ['id'], unique=False)
    op.create_index(op.f('ix_missingitem_item_type_id'), 'missingitem', ['item_type_id'], unique=False)
    op.create_index(op.f('ix_missingitem_user_id'), 'missingitem', ['user_id'], unique=False)
    
    # Update address table to support missing items
    op.add_column('address', sa.Column('missing_item_id', sa.String(), nullable=True))
    op.create_foreign_key('fk_address_missing_item', 'address', 'missingitem', ['missing_item_id'], ['id'])
    op.create_index(op.f('ix_address_missing_item_id'), 'address', ['missing_item_id'], unique=False)
    
    # Make item_id nullable in address table
    op.alter_column('address', 'item_id', nullable=True)


def downgrade():
    # Remove missing item support from address table
    op.drop_constraint('fk_address_missing_item', 'address', type_='foreignkey')
    op.drop_index(op.f('ix_address_missing_item_id'), table_name='address')
    op.drop_column('address', 'missing_item_id')
    
    # Make item_id not nullable again
    op.alter_column('address', 'item_id', nullable=False)
    
    # Drop missingitem table
    op.drop_index(op.f('ix_missingitem_user_id'), table_name='missingitem')
    op.drop_index(op.f('ix_missingitem_item_type_id'), table_name='missingitem')
    op.drop_index(op.f('ix_missingitem_id'), table_name='missingitem')
    op.drop_table('missingitem')

"""add_localization_fields_to_organization_itemtype_branch

Revision ID: localization_001
Revises: f7e97a89ad49
Create Date: 2025-09-22 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'localization_001'
down_revision = 'f7e97a89ad49'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add localization fields to organization table
    op.add_column('organization', sa.Column('name_ar', sa.String(), nullable=True))
    op.add_column('organization', sa.Column('name_en', sa.String(), nullable=True))
    op.add_column('organization', sa.Column('description_ar', sa.Text(), nullable=True))
    op.add_column('organization', sa.Column('description_en', sa.Text(), nullable=True))
    
    # Add localization fields to itemtype table
    op.add_column('itemtype', sa.Column('name_ar', sa.String(), nullable=True))
    op.add_column('itemtype', sa.Column('name_en', sa.String(), nullable=True))
    op.add_column('itemtype', sa.Column('description_ar', sa.Text(), nullable=True))
    op.add_column('itemtype', sa.Column('description_en', sa.Text(), nullable=True))
    
    # Add localization fields to branch table
    op.add_column('branch', sa.Column('branch_name_ar', sa.String(), nullable=True))
    op.add_column('branch', sa.Column('branch_name_en', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove localization fields from branch table
    op.drop_column('branch', 'branch_name_en')
    op.drop_column('branch', 'branch_name_ar')
    
    # Remove localization fields from itemtype table
    op.drop_column('itemtype', 'description_en')
    op.drop_column('itemtype', 'description_ar')
    op.drop_column('itemtype', 'name_en')
    op.drop_column('itemtype', 'name_ar')
    
    # Remove localization fields from organization table
    op.drop_column('organization', 'description_en')
    op.drop_column('organization', 'description_ar')
    op.drop_column('organization', 'name_en')
    op.drop_column('organization', 'name_ar')
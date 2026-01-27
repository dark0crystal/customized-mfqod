"""add_disposal_note_to_item

Revision ID: 7941967ced93
Revises: a1b2c3d4e5f6
Create Date: 2025-12-25 19:37:57.127400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7941967ced93'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add disposal_note column to item table
    op.add_column('item', sa.Column('disposal_note', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove disposal_note column from item table
    op.drop_column('item', 'disposal_note')

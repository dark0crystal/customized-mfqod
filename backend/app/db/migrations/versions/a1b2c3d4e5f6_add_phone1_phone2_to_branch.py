"""add phone1 and phone2 to branch

Revision ID: a1b2c3d4e5f6
Revises: 9081ea90b1f4
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9081ea90b1f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('branch', sa.Column('phone1', sa.String(), nullable=True))
    op.add_column('branch', sa.Column('phone2', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('branch', 'phone2')
    op.drop_column('branch', 'phone1')


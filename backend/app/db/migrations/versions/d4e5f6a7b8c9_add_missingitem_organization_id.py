"""add organization_id to missingitem

Revision ID: d4e5f6a7b8c9
Revises: 44416e7a1f85
Create Date: 2026-04-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "44416e7a1f85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "missingitem",
        sa.Column("organization_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "fk_missingitem_organization_id",
        "missingitem",
        "organization",
        ["organization_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_missingitem_organization_id", "missingitem", type_="foreignkey")
    op.drop_column("missingitem", "organization_id")

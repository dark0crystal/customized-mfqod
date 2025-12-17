"""Add visit status and new lifecycle values for missing items.

Replaces legacy statuses (lost/found/returned) with the new lifecycle
pending/approved/cancelled/visit and sets the default to pending.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "visit_status_for_missing_items"
down_revision = "make_branch_id_nullable_for_missing_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Normalize existing status values to the new lifecycle
    connection = op.get_bind()
    status_mapping = {
        "lost": "pending",
        "found": "approved",
        "returned": "approved",
        None: "pending",
        "": "pending",
    }

    for old, new in status_mapping.items():
        if old is None:
            connection.execute(
                sa.text(
                    "UPDATE missingitem SET status = :new_status WHERE status IS NULL"
                ),
                {"new_status": new},
            )
        else:
            connection.execute(
                sa.text(
                    "UPDATE missingitem SET status = :new_status WHERE status = :old_status"
                ),
                {"new_status": new, "old_status": old},
            )

    # Ensure default is pending going forward
    op.alter_column("missingitem", "status", server_default=sa.text("'pending'"))


def downgrade() -> None:
    # Best-effort rollback to legacy values
    connection = op.get_bind()
    rollback_mapping = {
        "pending": "lost",
        "approved": "found",
        "visit": "found",
        "cancelled": "lost",
    }

    for new, old in rollback_mapping.items():
        connection.execute(
            sa.text(
                "UPDATE missingitem SET status = :old_status WHERE status = :new_status"
            ),
            {"old_status": old, "new_status": new},
        )

    op.alter_column("missingitem", "status", server_default=sa.text("'lost'"))







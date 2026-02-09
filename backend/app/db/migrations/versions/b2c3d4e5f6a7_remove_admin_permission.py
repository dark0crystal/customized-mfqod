"""remove admin permission

Revision ID: b2c3d4e5f6a7
Revises: 7941967ced93
Create Date: 2025-02-06 12:00:00.000000

Removes the 'admin' permission from the system. APIs previously protected by
'admin' are now protected by: can_manage_claims (claims) and can_configure_system (notifications).
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '7941967ced93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove admin permission from role_permissions and permissions tables."""
    # Remove admin from role_permissions first (foreign key constraint)
    op.execute("""
        DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'admin')
    """)
    # Remove admin permission
    op.execute("DELETE FROM permissions WHERE name = 'admin'")


def downgrade() -> None:
    """Re-add admin permission. Note: Role assignments are not restored."""
    op.execute("""
        INSERT INTO permissions (id, name, description, created_at, updated_at)
        SELECT gen_random_uuid()::text, 'admin', 'Admin access - full system access', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'admin')
    """)

"""Add subscription_tier to organizations table.

Revision ID: 002_add_subscription_tier
Revises: 001_initial
Create Date: 2026-04-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_add_subscription_tier"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("subscription_tier", sa.String(20), nullable=False, server_default="free"),
    )


def downgrade() -> None:
    op.drop_column("organizations", "subscription_tier")

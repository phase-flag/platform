"""Add usage_records table for monthly tracked users (MTU) metering.

Revision ID: 003_add_usage_records
Revises: 002_add_subscription_tier
Create Date: 2026-04-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_usage_records"
down_revision: Union[str, None] = "002_add_subscription_tier"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usage_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("org_id", sa.String(36), nullable=False, index=True),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("unique_users", sa.Text, nullable=False, server_default="[]"),
        sa.Column("count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_usage_records_org_month", "usage_records", ["org_id", "month"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_usage_records_org_month", table_name="usage_records")
    op.drop_table("usage_records")

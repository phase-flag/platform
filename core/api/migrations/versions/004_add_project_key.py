"""Add project_key column to all primary tables."""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feature_flags", sa.Column("project_key", sa.String(255), nullable=True, index=True))
    op.add_column("segments", sa.Column("project_key", sa.String(255), nullable=True))
    op.add_column("experiments", sa.Column("project_key", sa.String(255), nullable=True))
    op.add_column("pipelines", sa.Column("project_key", sa.String(255), nullable=True))
    op.add_column("remote_configs", sa.Column("project_key", sa.String(255), nullable=True))
    op.create_index("ix_feature_flags_project_key", "feature_flags", ["project_key"])
    op.create_index("ix_segments_project_key", "segments", ["project_key"])
    op.create_index("ix_experiments_project_key", "experiments", ["project_key"])
    op.create_index("ix_pipelines_project_key", "pipelines", ["project_key"])
    op.create_index("ix_remote_configs_project_key", "remote_configs", ["project_key"])


def downgrade() -> None:
    op.drop_index("ix_remote_configs_project_key", table_name="remote_configs")
    op.drop_index("ix_pipelines_project_key", table_name="pipelines")
    op.drop_index("ix_experiments_project_key", table_name="experiments")
    op.drop_index("ix_segments_project_key", table_name="segments")
    op.drop_index("ix_feature_flags_project_key", table_name="feature_flags")
    op.drop_column("remote_configs", "project_key")
    op.drop_column("pipelines", "project_key")
    op.drop_column("experiments", "project_key")
    op.drop_column("segments", "project_key")
    op.drop_column("feature_flags", "project_key")

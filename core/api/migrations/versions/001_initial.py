"""Initial migration — create all Phase Flag tables.

Revision ID: 001_initial
Revises: None
Create Date: 2026-03-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Users ---
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- Organizations ---
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- Organization Members ---
    op.create_table(
        "org_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "org_id",
            sa.String(36),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
    )

    # --- Projects ---
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "org_id",
            sa.String(36),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- Environments ---
    op.create_table(
        "environments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(255), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("api_key", sa.String(255), nullable=False, unique=True),
        sa.Column("is_production", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("frozen", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("frozen_reason", sa.Text(), nullable=True),
        sa.Column("settings", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- Feature Flags ---
    op.create_table(
        "feature_flags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("flag_type", sa.String(20), nullable=False, server_default="boolean"),
        sa.Column("status", sa.String(20), nullable=False, server_default="inactive"),
        sa.Column(
            "environment", sa.String(20), nullable=False, server_default="development"
        ),
        sa.Column("default_variation_id", sa.String(36), nullable=False),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("scheduled_on", sa.DateTime(), nullable=True),
        sa.Column("scheduled_status", sa.String(20), nullable=True),
        sa.Column("prerequisites", sa.Text(), nullable=False, server_default="[]"),
        sa.Column(
            "lifecycle_stage",
            sa.String(20),
            nullable=False,
            server_default="development",
        ),
        sa.Column(
            "flag_classification",
            sa.String(20),
            nullable=False,
            server_default="release",
        ),
        sa.Column("is_permanent", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("ticket_url", sa.String(2048), nullable=True),
        sa.Column("runbook_url", sa.String(2048), nullable=True),
        sa.Column("owner_team", sa.String(255), nullable=True),
        sa.Column("namespace", sa.String(255), nullable=True, index=True),
        sa.Column(
            "created_by", sa.String(255), nullable=False, server_default="system"
        ),
        sa.Column("owner", sa.String(255), nullable=False, server_default="system"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_evaluated_at", sa.DateTime(), nullable=True),
        sa.Column("evaluation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("targeting_rules", sa.Text(), nullable=False, server_default="[]"),
    )

    # --- Variations ---
    op.create_table(
        "variations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "flag_id",
            sa.String(36),
            sa.ForeignKey("feature_flags.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    # --- Segments ---
    op.create_table(
        "segments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("conditions", sa.Text(), nullable=False, server_default="[]"),
        sa.Column(
            "created_by", sa.String(255), nullable=False, server_default="system"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Audit Logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False, server_default="flag"),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("entity_key", sa.String(255), nullable=False, index=True),
        sa.Column("actor", sa.String(255), nullable=False, server_default="system"),
        sa.Column("changes", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )

    # --- Evaluation Events ---
    op.create_table(
        "evaluation_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("flag_key", sa.String(255), nullable=False, index=True),
        sa.Column("variation_key", sa.String(255), nullable=True),
        sa.Column("user_id", sa.String(255), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, index=True),
        sa.Column("metadata", sa.Text(), nullable=False, server_default="{}"),
    )

    # --- Webhooks ---
    op.create_table(
        "webhooks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("secret", sa.String(255), nullable=False),
        sa.Column("events", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Exclusion Groups ---
    op.create_table(
        "exclusion_groups",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("flag_keys", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Change Requests ---
    op.create_table(
        "change_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False, server_default="flag"),
        sa.Column("entity_key", sa.String(255), nullable=False),
        sa.Column("change_type", sa.String(20), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("requested_by", sa.String(255), nullable=False),
        sa.Column("reviewed_by", sa.String(255), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("environment", sa.String(255), nullable=True),
        sa.Column(
            "requires_approval_count", sa.Integer(), nullable=False, server_default="1"
        ),
        sa.Column("approval_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )

    # --- Service Accounts ---
    op.create_table(
        "service_accounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("api_key", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("scopes", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Freeze Windows ---
    op.create_table(
        "freeze_windows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("environment", sa.String(255), nullable=True),
        sa.Column("starts_at", sa.DateTime(), nullable=False),
        sa.Column("ends_at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Break Glass Events ---
    op.create_table(
        "break_glass_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("flag_key", sa.String(255), nullable=False, index=True),
        sa.Column("environment", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("performed_by", sa.String(255), nullable=False),
        sa.Column("approved_by", sa.String(255), nullable=True),
        sa.Column("changes_json", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("reverted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Pipelines ---
    op.create_table(
        "pipelines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("flag_key", sa.String(255), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "current_stage_index", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("environment", sa.String(255), nullable=True),
        sa.Column("template", sa.String(50), nullable=True),
        sa.Column(
            "created_by", sa.String(255), nullable=False, server_default="system"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )

    # --- Pipeline Stages ---
    op.create_table(
        "pipeline_stages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "pipeline_id",
            sa.String(36),
            sa.ForeignKey("pipelines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("rollout_percentage", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "rollback_on_failure", sa.Boolean(), nullable=False, server_default="1"
        ),
        sa.Column("health_check_url", sa.String(2048), nullable=True),
        sa.Column("success_threshold", sa.Float(), nullable=True),
    )

    # --- Rollback Rules ---
    op.create_table(
        "rollback_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("flag_key", sa.String(255), nullable=False, index=True),
        sa.Column("metric_name", sa.String(255), nullable=False),
        sa.Column("operator", sa.String(10), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("window_minutes", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("action", sa.String(20), nullable=False, server_default="disable"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("last_triggered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- Remote Config ---
    op.create_table(
        "remote_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("value_type", sa.String(20), nullable=False, server_default="string"),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("schema_json", sa.Text(), nullable=True),
        sa.Column(
            "environment", sa.String(255), nullable=False, server_default="development"
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- Experiments ---
    op.create_table(
        "experiments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("flag_key", sa.String(255), nullable=False, index=True),
        sa.Column("hypothesis", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column(
            "experiment_type", sa.String(20), nullable=False, server_default="ab"
        ),
        sa.Column(
            "traffic_percentage", sa.Integer(), nullable=False, server_default="100"
        ),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("winner_variation_id", sa.String(36), nullable=True),
        sa.Column(
            "created_by", sa.String(255), nullable=False, server_default="system"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- Experiment Goals ---
    op.create_table(
        "experiment_goals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "experiment_id",
            sa.String(36),
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metric_key", sa.String(255), nullable=False),
        sa.Column(
            "goal_type", sa.String(20), nullable=False, server_default="conversion"
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("min_sample_size", sa.Integer(), nullable=True),
    )

    # --- Experiment Results ---
    op.create_table(
        "experiment_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "experiment_id",
            sa.String(36),
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("variation_key", sa.String(255), nullable=False),
        sa.Column("goal_id", sa.String(36), nullable=True),
        sa.Column("sample_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conversions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("conversion_rate", sa.Float(), nullable=True),
        sa.Column("confidence_level", sa.Float(), nullable=True),
        sa.Column("is_significant", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_winner", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("lift", sa.Float(), nullable=True),
        sa.Column("computed_at", sa.DateTime(), nullable=False),
    )

    # --- Migration Flags ---
    op.create_table(
        "migration_flags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("flag_key", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("source_system", sa.String(255), nullable=False),
        sa.Column("target_system", sa.String(255), nullable=False),
        sa.Column("stage", sa.String(50), nullable=False, server_default="shadow"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- Sticky Assignments ---
    op.create_table(
        "sticky_assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("flag_key", sa.String(255), nullable=False, index=True),
        sa.Column("user_id", sa.String(255), nullable=False, index=True),
        sa.Column("variation_id", sa.String(36), nullable=False),
        sa.Column("experiment_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sticky_assignments")
    op.drop_table("migration_flags")
    op.drop_table("experiment_results")
    op.drop_table("experiment_goals")
    op.drop_table("experiments")
    op.drop_table("remote_configs")
    op.drop_table("rollback_rules")
    op.drop_table("pipeline_stages")
    op.drop_table("pipelines")
    op.drop_table("break_glass_events")
    op.drop_table("freeze_windows")
    op.drop_table("service_accounts")
    op.drop_table("change_requests")
    op.drop_table("exclusion_groups")
    op.drop_table("webhooks")
    op.drop_table("evaluation_events")
    op.drop_table("audit_logs")
    op.drop_table("segments")
    op.drop_table("variations")
    op.drop_table("feature_flags")
    op.drop_table("environments")
    op.drop_table("projects")
    op.drop_table("org_members")
    op.drop_table("organizations")
    op.drop_table("users")

"""Import all model modules so SQLAlchemy Base.metadata discovers all tables."""

from phaseflag_api.models.flags import FeatureFlagDB, VariationDB  # noqa: F401
from phaseflag_api.models.segments import SegmentDB  # noqa: F401
from phaseflag_api.models.audit import AuditLogDB, EvaluationEventDB  # noqa: F401
from phaseflag_api.models.users import UserDB  # noqa: F401
from phaseflag_api.models.webhooks import WebhookDB, ExclusionGroupDB  # noqa: F401
from phaseflag_api.models.projects import OrganizationDB, ProjectDB, OrgMemberDB  # noqa: F401
from phaseflag_api.models.environments import EnvironmentDB  # noqa: F401
from phaseflag_api.models.governance import ChangeRequestDB, ServiceAccountDB, FreezeWindowDB, BreakGlassEventDB  # noqa: F401
from phaseflag_api.models.pipelines import PipelineDB, PipelineStageDB, RollbackRuleDB  # noqa: F401
from phaseflag_api.models.remote_config import RemoteConfigDB  # noqa: F401
from phaseflag_api.models.experiments import ExperimentDB, ExperimentGoalDB, ExperimentResultDB  # noqa: F401
from phaseflag_api.models.migrations import MigrationFlagDB  # noqa: F401
from phaseflag_api.models.assignments import StickyAssignmentDB  # noqa: F401

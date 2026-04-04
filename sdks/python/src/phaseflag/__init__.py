"""Phase Flag Python SDK -- feature flag evaluation with local caching."""

from phaseflag.client import PhaseFlagClient
from phaseflag.types import (
    EvaluationContext,
    EvaluationEvent,
    EvaluationResult,
    FlagDefinition,
    PercentageRollout,
    PercentageRolloutEntry,
    TargetingCondition,
    TargetingRule,
    Variation,
)

__all__ = [
    "PhaseFlagClient",
    "EvaluationContext",
    "EvaluationEvent",
    "EvaluationResult",
    "FlagDefinition",
    "PercentageRollout",
    "PercentageRolloutEntry",
    "TargetingCondition",
    "TargetingRule",
    "Variation",
]

__version__ = "0.1.0"

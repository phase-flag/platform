"""Type definitions for the Phase Flag Python SDK.

Mirrors the server-side models used by the Phase Flag API so that
flag definitions, variations, evaluation results, and contexts can
be represented in a type-safe manner on the client side.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Evaluation context
# ---------------------------------------------------------------------------

@dataclass
class EvaluationContext:
    """User/request attributes sent to targeting-rule evaluation.

    Attributes:
        user_id:    Stable user identifier used for percentage rollouts.
        session_id: Fallback identifier when ``user_id`` is unavailable.
        attributes: Arbitrary key-value pairs checked by targeting conditions.
    """

    user_id: Optional[str] = None
    session_id: Optional[str] = None
    attributes: Dict[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        """Look up a value by *key* -- checks standard fields first,
        then falls back to ``attributes``."""
        if key == "user_id":
            return self.user_id
        if key == "session_id":
            return self.session_id
        return self.attributes.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "session_id": self.session_id,
            "attributes": self.attributes,
        }


# ---------------------------------------------------------------------------
# Flag & variation structures (as returned by GET /sdk/ruleset)
# ---------------------------------------------------------------------------

@dataclass
class Variation:
    """A single variation of a feature flag."""

    id: str
    key: str
    name: str
    value: Any
    description: Optional[str] = None


@dataclass
class TargetingCondition:
    """A single condition within a targeting rule."""

    attribute: str
    operator: str
    value: Any


@dataclass
class PercentageRolloutEntry:
    """One slice of a percentage rollout."""

    variation_id: str
    weight: int


@dataclass
class PercentageRollout:
    """Percentage-based traffic allocation among variations."""

    variations: List[PercentageRolloutEntry] = field(default_factory=list)


@dataclass
class TargetingRule:
    """A targeting rule with conditions, an optional explicit variation,
    and an optional percentage rollout."""

    priority: int = 0
    conditions: List[TargetingCondition] = field(default_factory=list)
    variation_id: Optional[str] = None
    percentage_rollout: Optional[PercentageRollout] = None
    segment_id: Optional[str] = None


@dataclass
class FlagDefinition:
    """A complete flag definition as received from the API ruleset."""

    id: str
    key: str
    name: str
    flag_type: str
    status: str
    environment: str
    default_variation_id: str
    variations: List[Variation] = field(default_factory=list)
    targeting_rules: List[TargetingRule] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Evaluation result (returned by POST /evaluate)
# ---------------------------------------------------------------------------

@dataclass
class EvaluationResult:
    """The result of evaluating a flag."""

    flag_key: str
    variation_id: Optional[str] = None
    variation_key: Optional[str] = None
    value: Any = None
    reason: str = "default"


# ---------------------------------------------------------------------------
# Event types (sent to POST /sdk/events)
# ---------------------------------------------------------------------------

@dataclass
class EvaluationEvent:
    """An evaluation event to be sent for analytics."""

    flag_key: str
    variation_key: Optional[str] = None
    user_id: Optional[str] = None
    timestamp: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "flag_key": self.flag_key,
            "variation_key": self.variation_key,
            "user_id": self.user_id,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }

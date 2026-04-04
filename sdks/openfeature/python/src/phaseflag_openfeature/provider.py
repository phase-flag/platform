"""
Phase Flag OpenFeature Provider (Python)

Implements the OpenFeature Provider interface using the Phase Flag SDK
for flag evaluation. Supports boolean, string, integer, float, and object
flags with full targeting and percentage rollout support.

Usage:
    from openfeature import api
    from phaseflag_openfeature import PhaseFlagProvider

    provider = PhaseFlagProvider(
        base_url="https://api.example.com/api/v1",
        api_key="your-api-key",
    )
    api.set_provider(provider)

    client = api.get_client()
    dark_mode = client.get_boolean_value("dark-mode", False, {"targetingKey": "user-123"})
"""

from __future__ import annotations

import hashlib
import json
import re
import threading
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Union


# ---------------------------------------------------------------------------
# Models (inline to avoid dependency on the main Python SDK)
# ---------------------------------------------------------------------------

@dataclass
class Variation:
    id: str
    key: str
    name: str
    value: Any = None
    description: Optional[str] = None


@dataclass
class TargetingCondition:
    attribute: str
    operator: str
    value: Any = None


@dataclass
class PercentageRolloutEntry:
    variation_id: str
    weight: int


@dataclass
class PercentageRollout:
    variations: List[PercentageRolloutEntry] = field(default_factory=list)


@dataclass
class TargetingRule:
    priority: int = 0
    conditions: List[TargetingCondition] = field(default_factory=list)
    variation_id: Optional[str] = None
    percentage_rollout: Optional[PercentageRollout] = None
    segment_id: Optional[str] = None


@dataclass
class FlagDefinition:
    id: str
    key: str
    name: str
    flag_type: str = "boolean"
    status: str = "active"
    environment: str = "development"
    default_variation_id: str = ""
    variations: List[Variation] = field(default_factory=list)
    targeting_rules: List[TargetingRule] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)


@dataclass
class EvaluationResult:
    flag_key: str
    variation_id: Optional[str] = None
    variation_key: Optional[str] = None
    value: Any = None
    reason: str = "default"


# ---------------------------------------------------------------------------
# DJB2 hashing
# ---------------------------------------------------------------------------

def _djb2_hash(s: str) -> int:
    h = 5381
    for c in s.encode("utf-8"):
        h = ((h << 5) + h + c) & 0xFFFFFFFF
    return h


def _normalized_hash(flag_key: str, user_id: str) -> int:
    return _djb2_hash(f"{flag_key}:{user_id}") % 100


# ---------------------------------------------------------------------------
# Evaluation engine
# ---------------------------------------------------------------------------

def _coerce_numeric(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return None


def _match_condition(cond: TargetingCondition, ctx: Dict[str, Any]) -> bool:
    actual = ctx.get(cond.attribute)
    op = cond.operator
    target = cond.value

    if actual is None:
        return op in ("is_not", "not_contains", "not_one_of")

    actual_str = str(actual)
    target_str = str(target) if target is not None else ""

    if op == "is":
        return actual_str == target_str
    elif op == "is_not":
        return actual_str != target_str
    elif op == "contains":
        return target_str in actual_str
    elif op == "not_contains":
        return target_str not in actual_str
    elif op == "one_of":
        values = [str(v) for v in target] if isinstance(target, list) else [target_str]
        return actual_str in values
    elif op == "not_one_of":
        values = [str(v) for v in target] if isinstance(target, list) else [target_str]
        return actual_str not in values
    elif op == "gt":
        a, b = _coerce_numeric(actual), _coerce_numeric(target)
        return a is not None and b is not None and a > b
    elif op == "lt":
        a, b = _coerce_numeric(actual), _coerce_numeric(target)
        return a is not None and b is not None and a < b
    elif op == "matches_regex":
        try:
            return bool(re.search(target_str, actual_str))
        except re.error:
            return False
    return False


def _resolve_percentage_rollout(
    rollout: PercentageRollout, flag_key: str, user_id: str
) -> Optional[str]:
    if not user_id:
        return None
    bucket = _normalized_hash(flag_key, user_id)
    cumulative = 0
    for entry in rollout.variations:
        cumulative += entry.weight
        if bucket < cumulative:
            return entry.variation_id
    return None


def _evaluate(flag: FlagDefinition, ctx: Dict[str, Any]) -> EvaluationResult:
    variations_by_id = {v.id: v for v in flag.variations}

    def make_result(variation_id: str, reason: str) -> EvaluationResult:
        v = variations_by_id.get(variation_id)
        return EvaluationResult(
            flag_key=flag.key,
            variation_id=variation_id,
            variation_key=v.key if v else None,
            value=v.value if v else None,
            reason=reason,
        )

    rules = sorted(flag.targeting_rules, key=lambda r: r.priority)

    for rule in rules:
        if not all(_match_condition(c, ctx) for c in rule.conditions):
            continue

        if rule.variation_id:
            return make_result(rule.variation_id, "targeting_match")

        if rule.percentage_rollout:
            user_id = ctx.get("user_id", "") or ctx.get("session_id", "") or ""
            vid = _resolve_percentage_rollout(rule.percentage_rollout, flag.key, user_id)
            if vid:
                return make_result(vid, "percentage_rollout")

    return make_result(flag.default_variation_id, "default")


# ---------------------------------------------------------------------------
# Flag parsing
# ---------------------------------------------------------------------------

def _parse_flag(raw: Dict[str, Any]) -> FlagDefinition:
    variations = [
        Variation(
            id=v.get("id", ""),
            key=v.get("key", ""),
            name=v.get("name", v.get("key", "")),
            value=v.get("value"),
            description=v.get("description"),
        )
        for v in raw.get("variations", [])
    ]

    targeting_rules = []
    for r in raw.get("targeting_rules", []):
        conditions = [
            TargetingCondition(
                attribute=c.get("attribute", ""),
                operator=c.get("operator", ""),
                value=c.get("value"),
            )
            for c in r.get("conditions", [])
        ]

        rollout = None
        pr = r.get("percentage_rollout")
        if pr:
            entries = [
                PercentageRolloutEntry(
                    variation_id=e.get("variation_id", ""),
                    weight=e.get("weight", 0),
                )
                for e in pr.get("variations", [])
            ]
            rollout = PercentageRollout(variations=entries)

        targeting_rules.append(TargetingRule(
            priority=r.get("priority", 0),
            conditions=conditions,
            variation_id=r.get("variation_id"),
            percentage_rollout=rollout,
            segment_id=r.get("segment_id"),
        ))

    return FlagDefinition(
        id=raw.get("id", ""),
        key=raw.get("key", ""),
        name=raw.get("name", raw.get("key", "")),
        flag_type=raw.get("flag_type", "boolean"),
        status=raw.get("status", "active"),
        environment=raw.get("environment", "development"),
        default_variation_id=raw.get("default_variation_id", ""),
        variations=variations,
        targeting_rules=targeting_rules,
        tags=raw.get("tags", []),
    )


# ---------------------------------------------------------------------------
# OpenFeature Provider
# ---------------------------------------------------------------------------

# OpenFeature reason constants
class _Reason:
    DEFAULT = "DEFAULT"
    TARGETING_MATCH = "TARGETING_MATCH"
    SPLIT = "SPLIT"
    STATIC = "STATIC"
    UNKNOWN = "UNKNOWN"
    ERROR = "ERROR"


class _ErrorCode:
    FLAG_NOT_FOUND = "FLAG_NOT_FOUND"
    GENERAL = "GENERAL"


@dataclass
class _ResolutionDetails:
    value: Any
    variant: Optional[str] = None
    reason: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class PhaseFlagProvider:
    """
    OpenFeature provider backed by the Phase Flag platform.

    Fetches the flag ruleset from the Phase Flag API and evaluates flags
    locally using the same DJB2 hashing algorithm as the server.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        polling_interval: float = 30.0,
    ):
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._polling_interval = polling_interval
        self._flags: Dict[str, FlagDefinition] = {}
        self._lock = threading.RLock()
        self._polling_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    @property
    def name(self) -> str:
        return "phaseflag"

    def initialize(self, context: Optional[Dict[str, Any]] = None) -> None:
        """Fetch the initial ruleset and start background polling."""
        self._fetch_ruleset()
        self._stop_event.clear()
        self._polling_thread = threading.Thread(
            target=self._polling_loop, daemon=True, name="phaseflag-polling"
        )
        self._polling_thread.start()

    def shutdown(self) -> None:
        """Stop background polling."""
        self._stop_event.set()
        if self._polling_thread:
            self._polling_thread.join(timeout=5)
            self._polling_thread = None

    def resolve_boolean_details(
        self, flag_key: str, default_value: bool, context: Optional[Dict[str, Any]] = None
    ) -> _ResolutionDetails:
        result = self._resolve(flag_key, context)
        if result is None:
            return _ResolutionDetails(
                value=default_value,
                reason=_Reason.ERROR,
                error_code=_ErrorCode.FLAG_NOT_FOUND,
                error_message=f'Flag "{flag_key}" not found',
            )
        value = result.value if isinstance(result.value, bool) else default_value
        return _ResolutionDetails(
            value=value,
            variant=result.variation_key,
            reason=self._map_reason(result.reason),
        )

    def resolve_string_details(
        self, flag_key: str, default_value: str, context: Optional[Dict[str, Any]] = None
    ) -> _ResolutionDetails:
        result = self._resolve(flag_key, context)
        if result is None:
            return _ResolutionDetails(
                value=default_value,
                reason=_Reason.ERROR,
                error_code=_ErrorCode.FLAG_NOT_FOUND,
                error_message=f'Flag "{flag_key}" not found',
            )
        value = result.value if isinstance(result.value, str) else default_value
        return _ResolutionDetails(
            value=value,
            variant=result.variation_key,
            reason=self._map_reason(result.reason),
        )

    def resolve_integer_details(
        self, flag_key: str, default_value: int, context: Optional[Dict[str, Any]] = None
    ) -> _ResolutionDetails:
        result = self._resolve(flag_key, context)
        if result is None:
            return _ResolutionDetails(
                value=default_value,
                reason=_Reason.ERROR,
                error_code=_ErrorCode.FLAG_NOT_FOUND,
                error_message=f'Flag "{flag_key}" not found',
            )
        value = int(result.value) if isinstance(result.value, (int, float)) else default_value
        return _ResolutionDetails(
            value=value,
            variant=result.variation_key,
            reason=self._map_reason(result.reason),
        )

    def resolve_float_details(
        self, flag_key: str, default_value: float, context: Optional[Dict[str, Any]] = None
    ) -> _ResolutionDetails:
        result = self._resolve(flag_key, context)
        if result is None:
            return _ResolutionDetails(
                value=default_value,
                reason=_Reason.ERROR,
                error_code=_ErrorCode.FLAG_NOT_FOUND,
                error_message=f'Flag "{flag_key}" not found',
            )
        value = float(result.value) if isinstance(result.value, (int, float)) else default_value
        return _ResolutionDetails(
            value=value,
            variant=result.variation_key,
            reason=self._map_reason(result.reason),
        )

    def resolve_object_details(
        self, flag_key: str, default_value: Any, context: Optional[Dict[str, Any]] = None
    ) -> _ResolutionDetails:
        result = self._resolve(flag_key, context)
        if result is None:
            return _ResolutionDetails(
                value=default_value,
                reason=_Reason.ERROR,
                error_code=_ErrorCode.FLAG_NOT_FOUND,
                error_message=f'Flag "{flag_key}" not found',
            )
        value = result.value if isinstance(result.value, (dict, list)) else default_value
        return _ResolutionDetails(
            value=value,
            variant=result.variation_key,
            reason=self._map_reason(result.reason),
        )

    # -- Internal --

    def _resolve(
        self, flag_key: str, context: Optional[Dict[str, Any]] = None
    ) -> Optional[EvaluationResult]:
        with self._lock:
            flag = self._flags.get(flag_key)
        if flag is None:
            return None

        ctx = self._to_eval_context(context or {})
        return _evaluate(flag, ctx)

    def _to_eval_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Convert OpenFeature context to Phase Flag evaluation context."""
        result: Dict[str, Any] = {}
        targeting_key = context.get("targetingKey") or context.get("targeting_key")
        if targeting_key:
            result["user_id"] = targeting_key

        for k, v in context.items():
            if k not in ("targetingKey", "targeting_key"):
                result[k] = v

        return result

    def _map_reason(self, reason: str) -> str:
        mapping = {
            "targeting_match": _Reason.TARGETING_MATCH,
            "percentage_rollout": _Reason.SPLIT,
            "default": _Reason.DEFAULT,
            "override": _Reason.STATIC,
        }
        return mapping.get(reason, _Reason.UNKNOWN)

    def _fetch_ruleset(self) -> None:
        try:
            url = f"{self._base_url}/sdk/ruleset"
            req = urllib.request.Request(
                url,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self._api_key,
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status != 200:
                    return
                data = json.loads(resp.read().decode("utf-8"))

            new_flags: Dict[str, FlagDefinition] = {}
            for raw in data.get("flags", []):
                flag = _parse_flag(raw)
                new_flags[flag.key] = flag

            with self._lock:
                self._flags = new_flags
        except Exception:
            # Network errors are swallowed; stale flags preferred
            pass

    def _polling_loop(self) -> None:
        while not self._stop_event.wait(self._polling_interval):
            self._fetch_ruleset()

"""Phase Flag Python SDK client.

Provides feature flag evaluation with local caching, background polling,
event batching, bootstrap loading, offline mode, and flag mocking --
all backed by simple threads (no asyncio dependency).
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

import threading

import httpx

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

logger = logging.getLogger("phaseflag")

T = TypeVar("T")

FlagChangeListener = Callable[[Dict[str, FlagDefinition]], None]


# ---------------------------------------------------------------------------
# DJB2 hashing (mirrors server-side implementation)
# ---------------------------------------------------------------------------

def _djb2_hash(value: str) -> int:
    """DJB2 string hash returning an unsigned 32-bit integer."""
    h: int = 5381
    for ch in value:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h


def _normalised_hash(flag_key: str, user_id: str) -> int:
    """Return a value in [0, 100) deterministically for a user/flag pair."""
    raw = _djb2_hash(f"{flag_key}:{user_id}")
    return raw % 100


# ---------------------------------------------------------------------------
# Local evaluation engine (mirrors server-side evaluation_service)
# ---------------------------------------------------------------------------

def _coerce_numeric(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _evaluate_condition(condition: TargetingCondition, context: EvaluationContext) -> bool:
    """Evaluate a single targeting condition against an evaluation context.

    Supported operators: is, is_not, contains, not_contains, one_of,
    not_one_of, gt, lt, matches_regex.
    """
    actual = context.get(condition.attribute)
    operator = condition.operator
    target_value = condition.value

    # Missing attribute never matches (except negation operators)
    if actual is None:
        return operator in ("is_not", "not_contains", "not_one_of")

    if operator == "is":
        return str(actual) == str(target_value)
    if operator == "is_not":
        return str(actual) != str(target_value)
    if operator == "contains":
        return str(target_value) in str(actual)
    if operator == "not_contains":
        return str(target_value) not in str(actual)
    if operator == "one_of":
        if isinstance(target_value, list):
            return str(actual) in [str(v) for v in target_value]
        return str(actual) == str(target_value)
    if operator == "not_one_of":
        if isinstance(target_value, list):
            return str(actual) not in [str(v) for v in target_value]
        return str(actual) != str(target_value)
    if operator == "gt":
        a, b = _coerce_numeric(actual), _coerce_numeric(target_value)
        return a is not None and b is not None and a > b
    if operator == "lt":
        a, b = _coerce_numeric(actual), _coerce_numeric(target_value)
        return a is not None and b is not None and a < b
    if operator == "matches_regex":
        try:
            pattern = str(target_value)
            if len(pattern) > 500:
                return False
            # Truncate input to limit backtracking on very long strings
            return re.search(pattern, str(actual)[:10_000]) is not None
        except re.error:
            return False

    return False


def _evaluate_conditions(conditions: List[TargetingCondition], context: EvaluationContext) -> bool:
    """All conditions in a rule must match (AND logic)."""
    return all(_evaluate_condition(c, context) for c in conditions)


def _resolve_percentage_rollout(
    rollout: PercentageRollout,
    flag_key: str,
    context: EvaluationContext,
) -> Optional[str]:
    """Determine the variation ID via percentage rollout using DJB2."""
    user_id = context.user_id or context.session_id or ""
    if not user_id:
        return None

    bucket = _normalised_hash(flag_key, user_id)
    cumulative = 0
    for entry in rollout.variations:
        cumulative += entry.weight
        if bucket < cumulative:
            return entry.variation_id
    return None


def _evaluate_flag(flag: FlagDefinition, context: EvaluationContext) -> EvaluationResult:
    """Evaluate a flag definition locally against a context."""
    variations_by_id: Dict[str, Variation] = {v.id: v for v in flag.variations}

    def _make_result(variation_id: str, reason: str) -> EvaluationResult:
        v = variations_by_id.get(variation_id)
        return EvaluationResult(
            flag_key=flag.key,
            variation_id=variation_id,
            variation_key=v.key if v else None,
            value=v.value if v else None,
            reason=reason,
        )

    # Sort targeting rules by priority (lower number = higher priority)
    rules = sorted(flag.targeting_rules, key=lambda r: r.priority)

    for rule in rules:
        if not _evaluate_conditions(rule.conditions, context):
            continue

        # 1. Explicit variation
        if rule.variation_id:
            return _make_result(rule.variation_id, "targeting_match")

        # 2. Percentage rollout
        if rule.percentage_rollout:
            vid = _resolve_percentage_rollout(rule.percentage_rollout, flag.key, context)
            if vid:
                return _make_result(vid, "percentage_rollout")

    # No rule matched -- return default variation
    return _make_result(flag.default_variation_id, "default")


# ---------------------------------------------------------------------------
# Parsing helpers: raw API dicts -> dataclasses
# ---------------------------------------------------------------------------

def _parse_variation(raw: Dict[str, Any]) -> Variation:
    return Variation(
        id=raw["id"],
        key=raw["key"],
        name=raw.get("name", raw["key"]),
        value=raw.get("value"),
        description=raw.get("description"),
    )


def _parse_targeting_rule(raw: Dict[str, Any]) -> TargetingRule:
    conditions = [
        TargetingCondition(
            attribute=c.get("attribute", ""),
            operator=c.get("operator", ""),
            value=c.get("value"),
        )
        for c in raw.get("conditions", [])
    ]

    rollout_raw = raw.get("percentage_rollout")
    rollout: Optional[PercentageRollout] = None
    if rollout_raw:
        entries = [
            PercentageRolloutEntry(
                variation_id=e.get("variation_id", ""),
                weight=e.get("weight", 0),
            )
            for e in rollout_raw.get("variations", [])
        ]
        rollout = PercentageRollout(variations=entries)

    return TargetingRule(
        priority=raw.get("priority", 0),
        conditions=conditions,
        variation_id=raw.get("variation_id"),
        percentage_rollout=rollout,
        segment_id=raw.get("segment_id"),
    )


def _parse_flag(raw: Dict[str, Any]) -> FlagDefinition:
    return FlagDefinition(
        id=raw["id"],
        key=raw["key"],
        name=raw.get("name", raw["key"]),
        flag_type=raw.get("flag_type", "boolean"),
        status=raw.get("status", "active"),
        environment=raw.get("environment", "development"),
        default_variation_id=raw.get("default_variation_id", ""),
        variations=[_parse_variation(v) for v in raw.get("variations", [])],
        targeting_rules=[_parse_targeting_rule(r) for r in raw.get("targeting_rules", [])],
        tags=raw.get("tags", []),
    )


def _parse_flags_from_data(data: Dict[str, Any]) -> Dict[str, FlagDefinition]:
    """Parse a ruleset/bootstrap response into a flag dictionary."""
    flags: Dict[str, FlagDefinition] = {}
    for raw_flag in data.get("flags", []):
        flag = _parse_flag(raw_flag)
        flags[flag.key] = flag
    return flags


# ---------------------------------------------------------------------------
# PhaseFlagClient
# ---------------------------------------------------------------------------

class PhaseFlagClient:
    """Feature flag client with local evaluation, background polling,
    event batching, bootstrap loading, offline mode, and flag mocking.

    Usage::

        client = PhaseFlagClient(
            base_url="https://api.example.com/api/v1",
            api_key="your-api-key",
        )
        client.start()
        client.wait_until_ready()

        if client.get_boolean_value("dark-mode", False):
            enable_dark_mode()

        client.stop()

    The client can also be used as a context manager::

        with PhaseFlagClient(base_url=..., api_key=...) as client:
            client.wait_until_ready()
            value = client.get_boolean_value("dark-mode", False)

    Bootstrap loading::

        # From a local file
        client = PhaseFlagClient(
            base_url=..., api_key=...,
            bootstrap_file="/path/to/bootstrap.json",
        )

        # From a URL
        client = PhaseFlagClient(
            base_url=..., api_key=...,
            bootstrap_url="https://cdn.example.com/bootstrap.json",
        )

    Offline mode::

        client = PhaseFlagClient(
            base_url=..., api_key=...,
            offline_mode=True,
            bootstrap_file="/path/to/bootstrap.json",
        )

    Flag mocking for tests::

        client = PhaseFlagClient(base_url="", api_key="")
        client.set_override("my-flag", True)
        assert client.get_boolean_value("my-flag", False) is True
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        polling_interval: float = 30.0,
        event_flush_interval: float = 30.0,
        event_batch_size: int = 100,
        bootstrap_file: Optional[Union[str, Path]] = None,
        bootstrap_url: Optional[str] = None,
        bootstrap_data: Optional[Dict[str, Any]] = None,
        offline_mode: bool = False,
    ) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._api_key = api_key
        self._polling_interval = polling_interval
        self._event_flush_interval = event_flush_interval
        self._event_batch_size = event_batch_size
        self._offline_mode = offline_mode
        self._bootstrap_file = Path(bootstrap_file) if bootstrap_file else None
        self._bootstrap_url = bootstrap_url
        self._bootstrap_data = bootstrap_data

        # HTTP client (only created if we have a base URL)
        self._http: Optional[httpx.Client] = None
        if self._base_url:
            self._http = httpx.Client(
                base_url=self._base_url,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self._api_key,
                },
                timeout=10.0,
            )

        # Flag store (protected by lock)
        self._lock = threading.Lock()
        self._flags: Dict[str, FlagDefinition] = {}

        # Flag overrides for testing
        self._overrides: Dict[str, Any] = {}
        self._overrides_lock = threading.Lock()

        # Readiness
        self._ready = threading.Event()

        # Change listeners
        self._listeners: List[FlagChangeListener] = []
        self._listeners_lock = threading.Lock()

        # Event queue
        self._event_queue: List[EvaluationEvent] = []
        self._event_lock = threading.Lock()

        # Background threads
        self._polling_thread: Optional[threading.Thread] = None
        self._flush_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    # -- Context manager support -------------------------------------------

    def __enter__(self) -> "PhaseFlagClient":
        self.start()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.stop()

    # -- Lifecycle ---------------------------------------------------------

    def start(self) -> None:
        """Fetch the initial ruleset and begin background polling and
        event flushing. Loads bootstrap data first if configured."""
        # Load bootstrap data
        self._load_bootstrap()

        # First fetch is synchronous so the client becomes ready quickly
        if self._http:
            try:
                self._fetch_ruleset()
            except Exception:
                if not self._offline_mode:
                    raise
                logger.warning(
                    "Initial ruleset fetch failed; running in offline mode with "
                    "%d bootstrapped flags",
                    len(self._flags),
                )
                # Mark ready with bootstrap data
                self._ready.set()
        else:
            # No HTTP client (mock/offline mode), mark ready immediately
            self._ready.set()

        self._stop_event.clear()

        self._polling_thread = threading.Thread(
            target=self._polling_loop,
            name="phaseflag-polling",
            daemon=True,
        )
        self._polling_thread.start()

        self._flush_thread = threading.Thread(
            target=self._flush_loop,
            name="phaseflag-flush",
            daemon=True,
        )
        self._flush_thread.start()

    def stop(self) -> None:
        """Stop background threads and flush any remaining events."""
        self._stop_event.set()

        if self._polling_thread is not None:
            self._polling_thread.join(timeout=5)
            self._polling_thread = None

        if self._flush_thread is not None:
            self._flush_thread.join(timeout=5)
            self._flush_thread = None

        # Final flush
        try:
            self.flush_events()
        except Exception:
            logger.warning("Failed to flush events during shutdown", exc_info=True)

        if self._http:
            self._http.close()

    def wait_until_ready(self, timeout: float = 10.0) -> bool:
        """Block until the first ruleset fetch completes.

        Returns ``True`` if the client became ready within *timeout*
        seconds, ``False`` otherwise.
        """
        return self._ready.wait(timeout=timeout)

    @property
    def is_ready(self) -> bool:
        """Whether the client has successfully fetched at least one ruleset."""
        return self._ready.is_set()

    # -- Flag mocking (test support) ---------------------------------------

    def set_override(self, flag_key: str, value: Any) -> None:
        """Set a flag override for testing.

        When an override is set, the client returns the override value
        instead of evaluating the flag normally. No server connection
        is required.
        """
        with self._overrides_lock:
            self._overrides[flag_key] = value

    def clear_override(self, flag_key: str) -> None:
        """Remove a single flag override."""
        with self._overrides_lock:
            self._overrides.pop(flag_key, None)

    def clear_all_overrides(self) -> None:
        """Remove all flag overrides."""
        with self._overrides_lock:
            self._overrides.clear()

    # -- Local evaluation --------------------------------------------------

    def get_boolean_value(
        self,
        flag_key: str,
        default: bool,
        context: Optional[EvaluationContext] = None,
    ) -> bool:
        """Evaluate a boolean flag locally.

        Returns *default* if the flag is not found, is not active,
        or the resolved value is not a boolean.
        """
        # Check overrides first
        with self._overrides_lock:
            if flag_key in self._overrides:
                v = self._overrides[flag_key]
                return v if isinstance(v, bool) else default

        result = self._resolve(flag_key, context)
        if result is None or not isinstance(result.value, bool):
            return default
        return result.value

    def get_string_value(
        self,
        flag_key: str,
        default: str,
        context: Optional[EvaluationContext] = None,
    ) -> str:
        """Evaluate a string flag locally.

        Returns *default* if the flag is not found, is not active,
        or the resolved value is not a string.
        """
        with self._overrides_lock:
            if flag_key in self._overrides:
                v = self._overrides[flag_key]
                return v if isinstance(v, str) else default

        result = self._resolve(flag_key, context)
        if result is None or not isinstance(result.value, str):
            return default
        return result.value

    def get_json_value(
        self,
        flag_key: str,
        default: T,
        context: Optional[EvaluationContext] = None,
    ) -> T:
        """Evaluate a JSON (arbitrary) flag locally.

        Returns *default* if the flag is not found or is not active.
        """
        with self._overrides_lock:
            if flag_key in self._overrides:
                return self._overrides[flag_key]  # type: ignore[return-value]

        result = self._resolve(flag_key, context)
        if result is None:
            return default
        return result.value  # type: ignore[return-value]

    def get_variation(
        self,
        flag_key: str,
        context: Optional[EvaluationContext] = None,
    ) -> Optional[EvaluationResult]:
        """Get the full evaluation result for a flag, or ``None``."""
        with self._overrides_lock:
            if flag_key in self._overrides:
                return EvaluationResult(
                    flag_key=flag_key,
                    value=self._overrides[flag_key],
                    reason="override",
                )

        return self._resolve(flag_key, context)

    def get_all_flags(self) -> List[FlagDefinition]:
        """Return all currently loaded flag definitions."""
        with self._lock:
            return list(self._flags.values())

    # -- Remote evaluation -------------------------------------------------

    def evaluate(
        self,
        flag_key: str,
        context: Optional[EvaluationContext] = None,
    ) -> EvaluationResult:
        """Evaluate a flag server-side via ``POST /evaluate``.

        This delegates evaluation to the API and is useful when targeting
        rules require server-side data that the SDK does not have.
        """
        if not self._http:
            raise RuntimeError("Cannot perform remote evaluation without a base URL")

        ctx = context or EvaluationContext()
        payload = {
            "flag_key": flag_key,
            "context": ctx.to_dict(),
        }
        resp = self._http.post("/evaluate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return EvaluationResult(
            flag_key=data.get("flag_key", flag_key),
            variation_id=data.get("variation_id"),
            variation_key=data.get("variation_key"),
            value=data.get("value"),
            reason=data.get("reason", "default"),
        )

    # -- Event tracking ----------------------------------------------------

    def track_event(
        self,
        flag_key: str,
        variation_key: Optional[str] = None,
        context: Optional[EvaluationContext] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Queue an evaluation event for later batched submission.

        Events are flushed automatically on a periodic interval, when the
        batch size threshold is reached, or when :meth:`stop` is called.
        """
        event = EvaluationEvent(
            flag_key=flag_key,
            variation_key=variation_key,
            user_id=context.user_id if context else None,
            timestamp=datetime.now(timezone.utc).isoformat(),
            metadata=metadata or {},
        )
        flush_now = False
        with self._event_lock:
            self._event_queue.append(event)
            if len(self._event_queue) >= self._event_batch_size:
                flush_now = True

        if flush_now:
            self.flush_events()

    def flush_events(self) -> None:
        """Send all queued events to ``POST /sdk/events`` immediately."""
        if not self._http:
            # No HTTP client; discard events silently in mock/offline mode
            with self._event_lock:
                self._event_queue.clear()
            return

        with self._event_lock:
            if not self._event_queue:
                return
            batch = list(self._event_queue)
            self._event_queue.clear()

        payload = {"events": [e.to_dict() for e in batch]}
        try:
            resp = self._http.post("/sdk/events", json=payload)
            resp.raise_for_status()
            logger.debug("Flushed %d events", len(batch))
        except Exception:
            # Re-enqueue on failure so events are not lost
            logger.warning("Failed to flush %d events; re-enqueuing", len(batch), exc_info=True)
            with self._event_lock:
                self._event_queue = batch + self._event_queue

    # -- Listeners ---------------------------------------------------------

    def on_flags_changed(self, callback: FlagChangeListener) -> Callable[[], None]:
        """Register a callback invoked whenever the flag set changes.

        Returns a function that, when called, removes the listener.
        """
        with self._listeners_lock:
            self._listeners.append(callback)

        def remove() -> None:
            with self._listeners_lock:
                try:
                    self._listeners.remove(callback)
                except ValueError:
                    pass

        return remove

    # -- Internal ----------------------------------------------------------

    def _resolve(
        self,
        flag_key: str,
        context: Optional[EvaluationContext],
    ) -> Optional[EvaluationResult]:
        """Resolve a flag locally using the cached ruleset."""
        with self._lock:
            flag = self._flags.get(flag_key)

        if flag is None:
            return None

        ctx = context or EvaluationContext()
        return _evaluate_flag(flag, ctx)

    def _load_bootstrap(self) -> None:
        """Load bootstrap data from configured sources."""
        # Priority: explicit data > file > URL
        if self._bootstrap_data:
            flags = _parse_flags_from_data(self._bootstrap_data)
            with self._lock:
                self._flags = flags
            logger.debug("Loaded %d flags from bootstrap data", len(flags))
            return

        if self._bootstrap_file and self._bootstrap_file.exists():
            try:
                raw = self._bootstrap_file.read_text(encoding="utf-8")
                data = json.loads(raw)
                flags = _parse_flags_from_data(data)
                with self._lock:
                    self._flags = flags
                logger.debug("Loaded %d flags from bootstrap file: %s", len(flags), self._bootstrap_file)
                return
            except Exception:
                logger.warning("Failed to load bootstrap file: %s", self._bootstrap_file, exc_info=True)

        if self._bootstrap_url and self._http:
            try:
                resp = self._http.get(self._bootstrap_url)
                resp.raise_for_status()
                data = resp.json()
                flags = _parse_flags_from_data(data)
                with self._lock:
                    self._flags = flags
                logger.debug("Loaded %d flags from bootstrap URL: %s", len(flags), self._bootstrap_url)
            except Exception:
                logger.warning("Failed to load bootstrap URL: %s", self._bootstrap_url, exc_info=True)

    def _fetch_ruleset(self) -> None:
        """Fetch the ruleset from the API and update the local cache."""
        if not self._http:
            return

        try:
            resp = self._http.get("/sdk/ruleset")
            resp.raise_for_status()
            data = resp.json()

            new_flags = _parse_flags_from_data(data)

            with self._lock:
                self._flags = new_flags

            # Mark ready after first successful fetch
            self._ready.set()

            # Notify listeners
            self._notify_listeners()

            logger.debug("Fetched ruleset: %d flags", len(new_flags))

        except Exception:
            if self._offline_mode and self._flags:
                # In offline mode with cached data, swallow the error
                logger.debug("Ruleset fetch failed; using cached flags (offline mode)")
                self._ready.set()
            else:
                logger.warning("Failed to fetch ruleset", exc_info=True)
                raise

    def _notify_listeners(self) -> None:
        """Call all registered change listeners with the current flags."""
        with self._listeners_lock:
            listeners = list(self._listeners)

        with self._lock:
            flags_snapshot = dict(self._flags)

        for listener in listeners:
            try:
                listener(flags_snapshot)
            except Exception:
                logger.warning("Flag change listener raised an exception", exc_info=True)

    def _polling_loop(self) -> None:
        """Background thread that periodically fetches the ruleset."""
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=self._polling_interval)
            if self._stop_event.is_set():
                break
            try:
                self._fetch_ruleset()
            except Exception:
                # Swallow errors in polling; stale flags are better than crashing
                logger.debug("Polling fetch failed", exc_info=True)

    def _flush_loop(self) -> None:
        """Background thread that periodically flushes queued events."""
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=self._event_flush_interval)
            if self._stop_event.is_set():
                break
            try:
                self.flush_events()
            except Exception:
                logger.warning("Periodic event flush failed", exc_info=True)

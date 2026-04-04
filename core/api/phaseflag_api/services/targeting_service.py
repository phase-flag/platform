"""Targeting resolution service — condition and segment evaluation helpers.

Provides a clean interface for resolving targeting rules against evaluation
contexts, including segment reference expansion.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.repositories import segment_repository
from phaseflag_api.services.evaluation_engine import _evaluate_conditions


async def resolve_segment_conditions(
    session: AsyncSession,
    targeting_rules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Expand segment references in targeting rules.

    If a rule has a segment_id, fetch the segment and inject its
    conditions into the rule.
    """
    for rule in targeting_rules:
        seg_id = rule.get("segment_id")
        if seg_id:
            seg = await segment_repository.get_segment_by_id(session, seg_id)
            if seg:
                segment_conditions = seg.get_conditions()
                rule.setdefault("conditions", []).extend(segment_conditions)
    return targeting_rules


def evaluate_context_against_conditions(
    conditions: list[dict[str, Any]],
    context: dict[str, Any],
) -> bool:
    """Evaluate a list of conditions (AND logic) against a context dict."""
    return _evaluate_conditions(conditions, context)

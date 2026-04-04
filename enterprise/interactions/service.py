"""Interactions service — chi-squared test for flag interaction detection.

Detects whether the combined effect of two flags differs from what you'd
expect if they were independent.
"""

from __future__ import annotations

import hashlib
import json
import math
import uuid
from collections import Counter
from datetime import datetime
from itertools import combinations
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import InteractionResult, InteractionTest


# ---------------------------------------------------------------------------
# Statistical helpers
# ---------------------------------------------------------------------------

def _chi_squared_p_value(chi2: float, df: int) -> float:
    """Approximate chi-squared p-value using the Wilson-Hilferty normal approx.

    Good approximation for df >= 1.
    """
    if df <= 0 or chi2 <= 0:
        return 1.0
    # Wilson-Hilferty transformation
    z = (((chi2 / df) ** (1 / 3)) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    # Standard normal CDF
    p = 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
    return max(0.0, 1.0 - p)


def _chi_squared_test(
    observations: List[Dict[str, Any]], flag_a: str, flag_b: str
) -> Tuple[float, int, float, float]:
    """Run a chi-squared test of independence between two flags.

    Each observation has flag assignments like:
    {"flags": {"flag_a": "on", "flag_b": "off"}, "outcome": 1}

    Returns (chi2, df, p_value, cramers_v).
    """
    # Build contingency table: (variation_a, variation_b) -> count
    contingency: Dict[Tuple[str, str], int] = Counter()
    for obs in observations:
        flags = obs.get("flags", {})
        va = str(flags.get(flag_a, "unknown"))
        vb = str(flags.get(flag_b, "unknown"))
        contingency[(va, vb)] += 1

    if not contingency:
        return 0.0, 0, 1.0, 0.0

    # Unique categories
    cats_a = sorted({k[0] for k in contingency})
    cats_b = sorted({k[1] for k in contingency})

    r = len(cats_a)
    c = len(cats_b)
    n = sum(contingency.values())

    if r <= 1 or c <= 1 or n == 0:
        return 0.0, 0, 1.0, 0.0

    # Row and column totals
    row_totals = {a: sum(contingency.get((a, b), 0) for b in cats_b) for a in cats_a}
    col_totals = {b: sum(contingency.get((a, b), 0) for a in cats_a) for b in cats_b}

    # Chi-squared statistic
    chi2 = 0.0
    for a in cats_a:
        for b in cats_b:
            observed = contingency.get((a, b), 0)
            expected = (row_totals[a] * col_totals[b]) / n if n > 0 else 0
            if expected > 0:
                chi2 += (observed - expected) ** 2 / expected

    df = (r - 1) * (c - 1)
    p_value = _chi_squared_p_value(chi2, df)

    # Cramer's V
    min_dim = min(r, c) - 1
    cramers_v = math.sqrt(chi2 / (n * min_dim)) if n > 0 and min_dim > 0 else 0.0

    return chi2, df, p_value, cramers_v


def _effect_size_label(cramers_v: float) -> str:
    if cramers_v < 0.1:
        return "negligible"
    elif cramers_v < 0.3:
        return "small"
    elif cramers_v < 0.5:
        return "medium"
    else:
        return "large"


async def detect_interactions(
    session: AsyncSession,
    flag_keys: List[str],
    observations: List[Dict[str, Any]],
    metric_name: str = "conversion",
    environment: str = "production",
    significance_level: float = 0.05,
) -> Tuple[InteractionTest, List[InteractionResult]]:
    """Detect pairwise interactions between flags using chi-squared tests."""

    data_str = json.dumps(observations, sort_keys=True)
    data_hash = hashlib.sha256(data_str.encode()).hexdigest()[:64]

    test = InteractionTest(
        id=str(uuid.uuid4()),
        environment=environment,
        metric_name=metric_name,
        num_observations=len(observations),
        flag_keys=json.dumps(flag_keys),
        data_hash=data_hash,
        status="completed",
        created_at=datetime.utcnow(),
    )
    session.add(test)
    await session.flush()

    results: List[InteractionResult] = []

    for fa, fb in combinations(flag_keys, 2):
        chi2, df, p_val, cv = _chi_squared_test(observations, fa, fb)
        sig = p_val < significance_level
        effect = _effect_size_label(cv)

        summary = (
            f"Chi-squared={chi2:.4f}, df={df}, p={p_val:.4f}, Cramer's V={cv:.4f}. "
            f"{'Significant' if sig else 'Not significant'} interaction ({effect} effect)."
        )

        ir = InteractionResult(
            id=str(uuid.uuid4()),
            test_id=test.id,
            flag_a=fa,
            flag_b=fb,
            chi_squared=chi2,
            degrees_of_freedom=df,
            p_value=p_val,
            cramers_v=cv,
            is_significant=1 if sig else 0,
            effect_size=effect,
            summary=summary,
            created_at=datetime.utcnow(),
        )
        session.add(ir)
        results.append(ir)

    await session.flush()
    return test, results


async def get_results(
    session: AsyncSession, test_id: str
) -> List[InteractionResult]:
    stmt = (
        select(InteractionResult)
        .where(InteractionResult.test_id == test_id)
        .order_by(InteractionResult.p_value)
    )
    rows = await session.execute(stmt)
    return list(rows.scalars().all())

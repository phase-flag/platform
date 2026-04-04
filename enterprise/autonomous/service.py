"""Autonomous service — Thompson Sampling with Beta-Bernoulli bandits."""

from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import BanditArm, BanditReward


async def ensure_arms(
    session: AsyncSession,
    flag_key: str,
    variations: List[str],
) -> List[BanditArm]:
    """Ensure bandit arms exist for the given flag/variations. Creates missing ones."""
    stmt = select(BanditArm).where(BanditArm.flag_key == flag_key)
    result = await session.execute(stmt)
    existing = {a.variation: a for a in result.scalars().all()}

    arms = []
    for var in variations:
        if var in existing:
            arms.append(existing[var])
        else:
            arm = BanditArm(
                id=str(uuid.uuid4()),
                flag_key=flag_key,
                variation=var,
                alpha=1.0,
                beta=1.0,
                total_selections=0,
                total_rewards=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(arm)
            arms.append(arm)
    await session.flush()
    return arms


async def select_arm(
    session: AsyncSession,
    flag_key: str,
    variations: Optional[List[str]] = None,
) -> BanditArm:
    """Select an arm using Thompson Sampling (Beta-Bernoulli).

    Draws a sample from each arm's Beta(alpha, beta) posterior and picks
    the arm with the highest sample.
    """
    if variations:
        arms = await ensure_arms(session, flag_key, variations)
    else:
        stmt = select(BanditArm).where(BanditArm.flag_key == flag_key)
        result = await session.execute(stmt)
        arms = list(result.scalars().all())

    if not arms:
        raise ValueError(f"No arms configured for flag '{flag_key}'")

    # Thompson Sampling: sample from Beta posterior for each arm
    best_arm = arms[0]
    best_sample = -1.0

    for arm in arms:
        sample = random.betavariate(max(arm.alpha, 0.01), max(arm.beta, 0.01))
        if sample > best_sample:
            best_sample = sample
            best_arm = arm

    # Update selection count
    best_arm.total_selections += 1
    best_arm.updated_at = datetime.utcnow()
    await session.flush()

    return best_arm


async def record_reward(
    session: AsyncSession,
    flag_key: str,
    variation: str,
    reward: float,
    user_id: Optional[str] = None,
) -> BanditReward:
    """Record a reward (0 or 1 for Bernoulli) and update the arm's posterior."""
    stmt = select(BanditArm).where(
        BanditArm.flag_key == flag_key,
        BanditArm.variation == variation,
    )
    result = await session.execute(stmt)
    arm = result.scalar_one_or_none()

    if arm is None:
        raise ValueError(f"Arm '{variation}' not found for flag '{flag_key}'")

    # Clamp reward to [0, 1] for Beta-Bernoulli
    clamped = max(0.0, min(1.0, reward))

    arm.alpha += clamped
    arm.beta += (1.0 - clamped)
    arm.total_rewards += int(round(clamped))
    arm.updated_at = datetime.utcnow()

    event = BanditReward(
        id=str(uuid.uuid4()),
        arm_id=arm.id,
        flag_key=flag_key,
        user_id=user_id,
        reward=clamped,
        created_at=datetime.utcnow(),
    )
    session.add(event)
    await session.flush()

    return event


async def get_arm_stats(
    session: AsyncSession, flag_key: str
) -> List[Dict]:
    """Return statistics for all arms of a given flag."""
    stmt = select(BanditArm).where(BanditArm.flag_key == flag_key).order_by(BanditArm.variation)
    result = await session.execute(stmt)
    arms = result.scalars().all()

    stats = []
    for arm in arms:
        mean = arm.alpha / (arm.alpha + arm.beta) if (arm.alpha + arm.beta) > 0 else 0.0
        stats.append({
            "id": arm.id,
            "variation": arm.variation,
            "alpha": arm.alpha,
            "beta": arm.beta,
            "mean_reward": round(mean, 6),
            "total_selections": arm.total_selections,
            "total_rewards": arm.total_rewards,
            "updated_at": arm.updated_at.isoformat(),
        })
    return stats

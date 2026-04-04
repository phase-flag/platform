"""Experimentation service — layer management and mutual exclusion."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ExperimentLayer, MutualExclusionGroup


def _hash_user_to_bucket(user_id: str, layer_name: str) -> float:
    """Deterministically map a user to a 0-100 bucket within a layer."""
    key = f"{layer_name}:{user_id}"
    digest = hashlib.sha256(key.encode()).hexdigest()
    return (int(digest[:8], 16) % 10000) / 100.0


async def create_layer(
    session: AsyncSession,
    name: str,
    description: Optional[str] = None,
    total_traffic: float = 100.0,
) -> ExperimentLayer:
    layer = ExperimentLayer(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        total_traffic=total_traffic,
        allocated_traffic=0.0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(layer)
    await session.flush()
    return layer


async def get_layer(session: AsyncSession, layer_id: str) -> Optional[ExperimentLayer]:
    stmt = select(ExperimentLayer).where(ExperimentLayer.id == layer_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_layers(session: AsyncSession) -> List[ExperimentLayer]:
    stmt = select(ExperimentLayer).order_by(ExperimentLayer.created_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def assign_to_layer(
    session: AsyncSession,
    layer_id: str,
    experiment_id: str,
    name: str,
    traffic_percent: float,
) -> MutualExclusionGroup:
    """Assign an experiment to a layer, consuming `traffic_percent`% of the layer."""
    layer = await get_layer(session, layer_id)
    if layer is None:
        raise ValueError(f"Layer {layer_id} not found")

    remaining = layer.total_traffic - layer.allocated_traffic
    if traffic_percent > remaining:
        raise ValueError(
            f"Requested {traffic_percent}% but only {remaining}% available in layer '{layer.name}'"
        )

    traffic_start = layer.allocated_traffic
    traffic_end = traffic_start + traffic_percent

    group = MutualExclusionGroup(
        id=str(uuid.uuid4()),
        layer_id=layer_id,
        experiment_id=experiment_id,
        name=name,
        traffic_start=traffic_start,
        traffic_end=traffic_end,
        status="active",
        created_at=datetime.utcnow(),
    )
    session.add(group)

    layer.allocated_traffic = traffic_end
    layer.updated_at = datetime.utcnow()
    await session.flush()
    return group


async def check_exclusion(
    session: AsyncSession, layer_id: str, user_id: str
) -> Optional[MutualExclusionGroup]:
    """Return the experiment group a user falls into for a given layer (or None)."""
    layer = await get_layer(session, layer_id)
    if layer is None:
        return None

    bucket = _hash_user_to_bucket(user_id, layer.name)

    stmt = select(MutualExclusionGroup).where(
        MutualExclusionGroup.layer_id == layer_id,
        MutualExclusionGroup.status == "active",
    )
    result = await session.execute(stmt)
    groups = result.scalars().all()

    for g in groups:
        if g.traffic_start <= bucket < g.traffic_end:
            return g
    return None


async def list_groups_in_layer(
    session: AsyncSession, layer_id: str
) -> List[MutualExclusionGroup]:
    stmt = (
        select(MutualExclusionGroup)
        .where(MutualExclusionGroup.layer_id == layer_id)
        .order_by(MutualExclusionGroup.traffic_start)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())

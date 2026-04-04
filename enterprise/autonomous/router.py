"""Autonomous router — Thompson Sampling bandit endpoints."""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class SelectRequest(BaseModel):
    flag_key: str
    variations: Optional[List[str]] = None


class SelectResponse(BaseModel):
    arm_id: str
    flag_key: str
    variation: str
    total_selections: int


class RewardRequest(BaseModel):
    flag_key: str
    variation: str
    reward: float  # 0.0 or 1.0
    user_id: Optional[str] = None


class RewardResponse(BaseModel):
    reward_id: str
    arm_id: str
    reward: float


class ArmStats(BaseModel):
    id: str
    variation: str
    alpha: float
    beta: float
    mean_reward: float
    total_selections: int
    total_rewards: int
    updated_at: str


@router.post("/select", response_model=SelectResponse)
async def select_arm(body: SelectRequest, session=Depends(_get_session)):
    try:
        arm = await service.select_arm(session, body.flag_key, body.variations)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await session.commit()
    return SelectResponse(
        arm_id=arm.id,
        flag_key=arm.flag_key,
        variation=arm.variation,
        total_selections=arm.total_selections,
    )


@router.post("/reward", response_model=RewardResponse)
async def record_reward(body: RewardRequest, session=Depends(_get_session)):
    try:
        event = await service.record_reward(
            session, body.flag_key, body.variation, body.reward, body.user_id,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await session.commit()
    return RewardResponse(
        reward_id=event.id,
        arm_id=event.arm_id,
        reward=event.reward,
    )


@router.get("/stats/{flag_key}", response_model=List[ArmStats])
async def get_stats(flag_key: str, session=Depends(_get_session)):
    stats = await service.get_arm_stats(session, flag_key)
    return [ArmStats(**s) for s in stats]

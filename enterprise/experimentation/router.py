"""Experimentation router — layer and mutual-exclusion CRUD."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


# -- Schemas --

class LayerCreate(BaseModel):
    name: str
    description: Optional[str] = None
    total_traffic: float = 100.0


class LayerResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    total_traffic: float
    allocated_traffic: float
    created_at: str


class GroupAssign(BaseModel):
    experiment_id: str
    name: str
    traffic_percent: float


class GroupResponse(BaseModel):
    id: str
    layer_id: str
    experiment_id: str
    name: str
    traffic_start: float
    traffic_end: float
    status: str
    created_at: str


class ExclusionCheck(BaseModel):
    user_id: str


# -- Endpoints --

@router.post("/layers", response_model=LayerResponse)
async def create_layer(body: LayerCreate, session=Depends(_get_session)):
    layer = await service.create_layer(session, body.name, body.description, body.total_traffic)
    await session.commit()
    return LayerResponse(
        id=layer.id, name=layer.name, description=layer.description,
        total_traffic=layer.total_traffic, allocated_traffic=layer.allocated_traffic,
        created_at=layer.created_at.isoformat(),
    )


@router.get("/layers", response_model=List[LayerResponse])
async def list_layers(session=Depends(_get_session)):
    layers = await service.list_layers(session)
    return [
        LayerResponse(
            id=l.id, name=l.name, description=l.description,
            total_traffic=l.total_traffic, allocated_traffic=l.allocated_traffic,
            created_at=l.created_at.isoformat(),
        )
        for l in layers
    ]


@router.get("/layers/{layer_id}", response_model=LayerResponse)
async def get_layer(layer_id: str, session=Depends(_get_session)):
    layer = await service.get_layer(session, layer_id)
    if not layer:
        raise HTTPException(404, "Layer not found")
    return LayerResponse(
        id=layer.id, name=layer.name, description=layer.description,
        total_traffic=layer.total_traffic, allocated_traffic=layer.allocated_traffic,
        created_at=layer.created_at.isoformat(),
    )


@router.post("/layers/{layer_id}/groups", response_model=GroupResponse)
async def assign_group(layer_id: str, body: GroupAssign, session=Depends(_get_session)):
    try:
        group = await service.assign_to_layer(
            session, layer_id, body.experiment_id, body.name, body.traffic_percent,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await session.commit()
    return GroupResponse(
        id=group.id, layer_id=group.layer_id, experiment_id=group.experiment_id,
        name=group.name, traffic_start=group.traffic_start, traffic_end=group.traffic_end,
        status=group.status, created_at=group.created_at.isoformat(),
    )


@router.get("/layers/{layer_id}/groups", response_model=List[GroupResponse])
async def list_groups(layer_id: str, session=Depends(_get_session)):
    groups = await service.list_groups_in_layer(session, layer_id)
    return [
        GroupResponse(
            id=g.id, layer_id=g.layer_id, experiment_id=g.experiment_id,
            name=g.name, traffic_start=g.traffic_start, traffic_end=g.traffic_end,
            status=g.status, created_at=g.created_at.isoformat(),
        )
        for g in groups
    ]


@router.post("/layers/{layer_id}/check-exclusion")
async def check_exclusion(layer_id: str, body: ExclusionCheck, session=Depends(_get_session)):
    group = await service.check_exclusion(session, layer_id, body.user_id)
    if group is None:
        return {"assigned": False, "group": None}
    return {
        "assigned": True,
        "group": GroupResponse(
            id=group.id, layer_id=group.layer_id, experiment_id=group.experiment_id,
            name=group.name, traffic_start=group.traffic_start, traffic_end=group.traffic_end,
            status=group.status, created_at=group.created_at.isoformat(),
        ),
    }

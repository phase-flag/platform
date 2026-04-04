"""Licensing router — license validation endpoints."""

from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class ValidateRequest(BaseModel):
    organization_id: str
    license_key: str
    hmac_secret: Optional[str] = None


class LicenseResponse(BaseModel):
    id: str
    organization_id: str
    license_id: Optional[str]
    plan: str
    is_valid: bool
    validation_error: Optional[str]
    features: List[str]
    max_seats: Optional[int]
    max_flags: Optional[int]
    max_environments: Optional[int]
    issued_at: Optional[str]
    expires_at: Optional[str]
    validated_at: str


class EntitlementCheck(BaseModel):
    feature: str


@router.post("/validate", response_model=LicenseResponse)
async def validate_license(body: ValidateRequest, session=Depends(_get_session)):
    record = await service.validate_license(
        session, body.organization_id, body.license_key, body.hmac_secret,
    )
    await session.commit()
    return LicenseResponse(
        id=record.id,
        organization_id=record.organization_id,
        license_id=record.license_id,
        plan=record.plan,
        is_valid=bool(record.is_valid),
        validation_error=record.validation_error,
        features=json.loads(record.features),
        max_seats=record.max_seats,
        max_flags=record.max_flags,
        max_environments=record.max_environments,
        issued_at=record.issued_at.isoformat() if record.issued_at else None,
        expires_at=record.expires_at.isoformat() if record.expires_at else None,
        validated_at=record.validated_at.isoformat(),
    )


@router.get("/features", response_model=List[str])
async def get_features(organization_id: str = Query(...), session=Depends(_get_session)):
    return await service.get_features(session, organization_id)


@router.post("/entitlement")
async def check_entitlement(
    body: EntitlementCheck,
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    entitled = await service.check_entitlement(session, organization_id, body.feature)
    return {"feature": body.feature, "entitled": entitled}


@router.get("/license", response_model=Optional[LicenseResponse])
async def get_license(organization_id: str = Query(...), session=Depends(_get_session)):
    record = await service.get_license(session, organization_id)
    if not record:
        raise HTTPException(404, "No license found for this organization")
    return LicenseResponse(
        id=record.id,
        organization_id=record.organization_id,
        license_id=record.license_id,
        plan=record.plan,
        is_valid=bool(record.is_valid),
        validation_error=record.validation_error,
        features=json.loads(record.features),
        max_seats=record.max_seats,
        max_flags=record.max_flags,
        max_environments=record.max_environments,
        issued_at=record.issued_at.isoformat() if record.issued_at else None,
        expires_at=record.expires_at.isoformat() if record.expires_at else None,
        validated_at=record.validated_at.isoformat(),
    )

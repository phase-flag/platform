"""Webhook CRUD endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.services import webhook_service

router = APIRouter(prefix="/webhooks", dependencies=[Depends(require_api_key)])


class WebhookCreateInput(BaseModel):
    url: str = Field(..., examples=["https://example.com/webhooks/flags"])
    events: list[str] = Field(..., examples=[["flag.created", "flag.updated", "flag.toggled", "flag.archived"]])
    secret: str = Field(..., examples=["whsec_my_secret_key"])


class WebhookUpdateInput(BaseModel):
    url: str | None = None
    events: list[str] | None = None
    active: bool | None = None


class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    active: bool
    created_at: str


class PaginatedWebhooks(BaseModel):
    items: list[WebhookOut]
    total: int
    limit: int
    offset: int


def _to_out(w) -> WebhookOut:
    return WebhookOut(
        id=w.id, url=w.url, events=w.get_events(),
        active=w.active, created_at=w.created_at.isoformat(),
    )


@router.get("", response_model=PaginatedWebhooks)
async def list_webhooks(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    webhooks, total = await webhook_service.list_webhooks(session, limit=limit, offset=offset)
    return PaginatedWebhooks(items=[_to_out(w) for w in webhooks], total=total, limit=limit, offset=offset)


@router.post("", response_model=WebhookOut, status_code=status.HTTP_201_CREATED, dependencies=[require_role("editor")])
async def create_webhook(body: WebhookCreateInput, session: AsyncSession = Depends(get_session)):
    webhook = await webhook_service.create_webhook(session, body.url, body.events, body.secret)
    return _to_out(webhook)


@router.put("/{webhook_id}", response_model=WebhookOut, dependencies=[require_role("editor")])
async def update_webhook(webhook_id: str, body: WebhookUpdateInput, session: AsyncSession = Depends(get_session)):
    webhook = await webhook_service.get_webhook(session, webhook_id)
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    updated = await webhook_service.update_webhook(session, webhook, body.model_dump(exclude_unset=True))
    return _to_out(updated)


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[require_role("admin")])
async def delete_webhook(webhook_id: str, session: AsyncSession = Depends(get_session)):
    webhook = await webhook_service.get_webhook(session, webhook_id)
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    await webhook_service.delete_webhook(session, webhook)

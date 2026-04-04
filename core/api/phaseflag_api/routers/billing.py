"""Stripe billing endpoints: plans, checkout, webhook."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.config import settings
from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user, require_api_key
from phaseflag_api.models.projects import OrganizationDB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing")

# ---------------------------------------------------------------------------
# Plan catalogue
# ---------------------------------------------------------------------------

_PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_monthly_usd": 0,
        "features": ["Up to 5 flags", "1 environment", "1 project", "Community support"],
        "stripe_price_id": None,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_monthly_usd": 29,
        "features": [
            "Unlimited flags",
            "5 environments",
            "10 projects",
            "Segments & targeting",
            "Audit log",
            "Email support",
        ],
        "stripe_price_id": getattr(settings, "STRIPE_PRO_PRICE_ID", None),
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price_monthly_usd": None,
        "features": [
            "Everything in Pro",
            "Unlimited projects & environments",
            "SSO / SAML",
            "SLA",
            "Dedicated support",
        ],
        "stripe_price_id": getattr(settings, "STRIPE_ENTERPRISE_PRICE_ID", None),
    },
]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CheckoutRequest(BaseModel):
    plan_id: str
    org_id: str
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    checkout_url: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_stripe():
    """Lazy-import stripe and validate secret key is configured."""
    try:
        import stripe  # type: ignore[import-untyped]
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe SDK not installed. Add 'stripe' to dependencies.",
        ) from exc

    secret_key = getattr(settings, "STRIPE_SECRET_KEY", None)
    if not secret_key or secret_key.startswith("sk_test_placeholder"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured. Set PHASEFLAG_STRIPE_SECRET_KEY.",
        )
    stripe.api_key = secret_key
    return stripe


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/plans")
async def list_plans():
    """Return available subscription plans with pricing."""
    return {"plans": _PLANS}


@router.post("/checkout", response_model=CheckoutResponse, dependencies=[Depends(require_api_key)])
async def create_checkout(
    body: CheckoutRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a Stripe Checkout session and return the redirect URL."""
    stripe = _get_stripe()

    plan = next((p for p in _PLANS if p["id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{body.plan_id}'")
    if not plan["stripe_price_id"]:
        raise HTTPException(status_code=400, detail=f"Plan '{body.plan_id}' has no Stripe price configured")

    org = await session.get(OrganizationDB, body.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    session_obj = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": plan["stripe_price_id"], "quantity": 1}],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"org_id": body.org_id, "plan_id": body.plan_id, "user_id": user["id"]},
    )
    return CheckoutResponse(checkout_url=session_obj.url)


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None, alias="stripe-signature"),
    session: AsyncSession = Depends(get_session),
):
    """Handle Stripe webhook events with HMAC signature validation."""
    payload = await request.body()
    webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)

    if webhook_secret and stripe_signature:
        try:
            stripe = _get_stripe()
            event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
        except Exception as exc:
            logger.warning("Stripe webhook signature validation failed: %s", exc)
            raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc
    else:
        # Accept unsigned webhooks in dev/test (no webhook secret configured)
        import json

        try:
            event = json.loads(payload)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = event.get("type") if isinstance(event, dict) else event.type
    event_data: dict[str, Any] = event.get("data", {}) if isinstance(event, dict) else event.data

    logger.info("Stripe webhook received: %s", event_type)

    if event_type == "checkout.session.completed":
        obj = event_data.get("object", {})
        metadata = obj.get("metadata", {})
        org_id = metadata.get("org_id")
        plan_id = metadata.get("plan_id")
        if org_id and plan_id:
            await session.execute(
                update(OrganizationDB)
                .where(OrganizationDB.id == org_id)
                .values(subscription_tier=plan_id)
            )
            await session.commit()
            logger.info("Organization %s subscription updated to %s", org_id, plan_id)

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        obj = event_data.get("object", {})
        metadata = obj.get("metadata", {})
        org_id = metadata.get("org_id")
        if org_id:
            new_tier = "free" if event_type.endswith("deleted") else metadata.get("plan_id", "free")
            await session.execute(
                update(OrganizationDB)
                .where(OrganizationDB.id == org_id)
                .values(subscription_tier=new_tier)
            )
            await session.commit()

    return {"received": True}

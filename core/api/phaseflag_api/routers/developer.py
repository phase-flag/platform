"""Developer workflow endpoints — test users, forced treatments, simulation."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.services import dev_workflow_service

router = APIRouter(dependencies=[Depends(require_api_key)])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class TestUserCreate(BaseModel):
    user_id: str
    name: str
    attributes: dict | None = None


class ForcedTreatment(BaseModel):
    flag_key: str
    user_id: str
    variation: str


class SimulationRequest(BaseModel):
    flag_key: str
    total_users: int = 10000
    percentage: int


# ---------------------------------------------------------------------------
# Test user endpoints
# ---------------------------------------------------------------------------


@router.post("/test-users", status_code=201, dependencies=[require_role("editor")])
async def create_test_user(body: TestUserCreate):
    """Create a test user for flag evaluation testing."""
    return dev_workflow_service.create_test_user(
        body.user_id, body.name, body.attributes
    )


@router.get("/test-users")
async def list_test_users():
    """List all registered test users."""
    return dev_workflow_service.list_test_users()


@router.delete(
    "/test-users/{user_id}", status_code=204, dependencies=[require_role("editor")]
)
async def delete_test_user(user_id: str):
    """Delete a test user."""
    if not dev_workflow_service.delete_test_user(user_id):
        raise HTTPException(status_code=404, detail="Test user not found")


# ---------------------------------------------------------------------------
# Forced treatment endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/forced-treatments", status_code=201, dependencies=[require_role("editor")]
)
async def set_forced_treatment(body: ForcedTreatment):
    """Force a specific variation for a user on a flag (for testing)."""
    dev_workflow_service.set_forced_treatment(
        body.flag_key, body.user_id, body.variation
    )
    return {"status": "set", **body.model_dump()}


@router.delete(
    "/forced-treatments", status_code=204, dependencies=[require_role("editor")]
)
async def clear_forced_treatments(
    flag_key: str | None = None, user_id: str | None = None
):
    """Clear forced treatments. Filter by flag_key and/or user_id, or clear all."""
    dev_workflow_service.clear_forced_treatments(flag_key, user_id)


# ---------------------------------------------------------------------------
# Simulation endpoints
# ---------------------------------------------------------------------------


@router.post("/simulate-rollout")
async def simulate_rollout(body: SimulationRequest):
    """Simulate how a rollout percentage would distribute across synthetic users."""
    return dev_workflow_service.simulate_rollout(
        body.flag_key, body.total_users, body.percentage
    )

"""Aggregate enterprise router.

Mounts all enterprise module routers under /api/v1/enterprise.
"""

from fastapi import APIRouter

from enterprise.analytics.router import router as analytics_router
from enterprise.auth.router import router as auth_router
from enterprise.autonomous.router import router as autonomous_router
from enterprise.compliance.router import router as compliance_router
from enterprise.counterfactual.router import router as counterfactual_router
from enterprise.experimentation.router import router as experimentation_router
from enterprise.finops.router import router as finops_router
from enterprise.governance.router import router as governance_router
from enterprise.interactions.router import router as interactions_router
from enterprise.licensing.router import router as licensing_router
from enterprise.migration.router import router as migration_router
from enterprise.simulation.router import router as simulation_router
from enterprise.verification.router import router as verification_router

router = APIRouter(prefix="/api/v1/enterprise")

router.include_router(analytics_router, prefix="/analytics", tags=["enterprise-analytics"])
router.include_router(experimentation_router, prefix="/experimentation", tags=["enterprise-experimentation"])
router.include_router(simulation_router, prefix="/simulation", tags=["enterprise-simulation"])
router.include_router(verification_router, prefix="/verification", tags=["enterprise-verification"])
router.include_router(counterfactual_router, prefix="/counterfactual", tags=["enterprise-counterfactual"])
router.include_router(autonomous_router, prefix="/autonomous", tags=["enterprise-autonomous"])
router.include_router(interactions_router, prefix="/interactions", tags=["enterprise-interactions"])
router.include_router(finops_router, prefix="/finops", tags=["enterprise-finops"])
router.include_router(auth_router, prefix="/auth", tags=["enterprise-auth"])
router.include_router(compliance_router, prefix="/compliance", tags=["enterprise-compliance"])
router.include_router(licensing_router, prefix="/licensing", tags=["enterprise-licensing"])
router.include_router(governance_router, prefix="/governance", tags=["enterprise-governance"])
router.include_router(migration_router, prefix="/migration", tags=["enterprise-migration"])

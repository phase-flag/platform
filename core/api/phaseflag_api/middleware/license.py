"""License validation middleware — stub for enterprise features."""

import logging

from phaseflag_api.config import settings

logger = logging.getLogger(__name__)


def init_license() -> None:
    """Initialize license validation on startup."""
    if settings.LICENSE_KEY:
        logger.info("Enterprise license key configured")
    else:
        logger.info("Running in OSS mode (no license key)")


async def get_license_info():
    """Return current license and feature-gate information."""
    return {
        "mode": settings.DEPLOYMENT_MODE.value,
        "licensed": bool(settings.LICENSE_KEY),
        "features": {
            "experimentation": settings.DEPLOYMENT_MODE != settings.DEPLOYMENT_MODE.OSS,
            "sso": settings.DEPLOYMENT_MODE != settings.DEPLOYMENT_MODE.OSS,
            "audit_export": True,
            "api_access": True,
        },
    }

"""Application configuration via environment variables."""

import logging
import secrets
from enum import Enum

from pydantic_settings import BaseSettings

_logger = logging.getLogger(__name__)

_INSECURE_DEFAULTS = frozenset(
    {
        "change-me-in-production",
        "change-jwt-secret-in-production",
    }
)


class DeploymentMode(str, Enum):
    OSS = "oss"
    SAAS = "saas"
    ENTERPRISE = "enterprise"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = "sqlite+aiosqlite:///./phaseflag.db"
    API_SECRET_KEY: str = "change-me-in-production"
    JWT_SECRET_KEY: str = "change-jwt-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    LOG_LEVEL: str = "INFO"

    DEPLOYMENT_MODE: DeploymentMode = DeploymentMode.OSS
    LICENSE_KEY: str = ""

    # Stripe billing (SaaS mode)
    STRIPE_SECRET_KEY: str = "sk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_ENTERPRISE_PRICE_ID: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS == "*":
            if self.DEPLOYMENT_MODE != DeploymentMode.OSS:
                _logger.warning(
                    "CORS wildcard '*' is not allowed in %s mode. Set PHASEFLAG_CORS_ORIGINS to specific origins.",
                    self.DEPLOYMENT_MODE.value,
                )
                return ["http://localhost:3000", "http://localhost:5173"]
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {
        "env_prefix": "PHASEFLAG_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()


def _check_secrets() -> None:
    is_prod_db = not settings.DATABASE_URL.startswith("sqlite")
    is_production = settings.DEPLOYMENT_MODE in (
        DeploymentMode.SAAS,
        DeploymentMode.ENTERPRISE,
    )

    if settings.API_SECRET_KEY in _INSECURE_DEFAULTS:
        if is_production:
            raise RuntimeError(
                "CRITICAL: PHASEFLAG_API_SECRET_KEY must be set to a strong secret "
                "in SaaS/Enterprise mode. Refusing to start with insecure defaults."
            )
        elif is_prod_db:
            settings.API_SECRET_KEY = secrets.token_urlsafe(32)  # type: ignore[misc]
            _logger.warning(
                "PHASEFLAG_API_SECRET_KEY was not set — generated a random key. "
                "Set PHASEFLAG_API_SECRET_KEY env var for stable auth across restarts."
            )
        else:
            _logger.warning("Using default API_SECRET_KEY. Set PHASEFLAG_API_SECRET_KEY for production.")

    if settings.JWT_SECRET_KEY in _INSECURE_DEFAULTS:
        if is_production:
            raise RuntimeError(
                "CRITICAL: PHASEFLAG_JWT_SECRET_KEY must be set to a strong secret "
                "in SaaS/Enterprise mode. Refusing to start with insecure defaults."
            )
        elif is_prod_db:
            settings.JWT_SECRET_KEY = secrets.token_urlsafe(32)  # type: ignore[misc]
            _logger.warning(
                "PHASEFLAG_JWT_SECRET_KEY was not set — generated a random key. "
                "Set PHASEFLAG_JWT_SECRET_KEY env var for stable JWT signing across restarts."
            )
        else:
            _logger.warning("Using default JWT_SECRET_KEY. Set PHASEFLAG_JWT_SECRET_KEY for production.")


_check_secrets()

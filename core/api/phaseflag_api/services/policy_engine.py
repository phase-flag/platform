"""Policy engine for access control decisions."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.governance import FreezeWindowDB


class PolicyEngine:
    """Evaluates access control policies."""

    @staticmethod
    async def can_modify_flag(
        session: AsyncSession, user: dict, flag_key: str, environment: str,
    ) -> tuple[bool, str]:
        """Check if user can modify a flag in the given environment.

        Returns (allowed, reason).
        """
        # Check freeze windows
        now = datetime.now(UTC)
        stmt = select(FreezeWindowDB).where(
            FreezeWindowDB.environment == environment,
            FreezeWindowDB.starts_at <= now,
            FreezeWindowDB.ends_at >= now,
            FreezeWindowDB.active == True,  # noqa: E712
        )
        result = await session.execute(stmt)
        freeze = result.scalar_one_or_none()
        if freeze:
            return False, f"Environment '{environment}' is frozen: {freeze.reason}"

        # Check role
        role = user.get("role", "viewer")
        if role == "viewer":
            return False, "Viewers cannot modify flags"

        return True, "allowed"

    @staticmethod
    async def can_deploy_to_production(
        session: AsyncSession, user: dict, flag_key: str,
    ) -> tuple[bool, str]:
        """Check if a flag change can be deployed to production."""
        role = user.get("role", "viewer")
        if role != "admin":
            return False, "Only admins can deploy to production"
        return True, "allowed"

    @staticmethod
    async def evaluate_policy(
        session: AsyncSession, action: str, user: dict, resource: dict,
    ) -> tuple[bool, str]:
        """Generic policy evaluation.

        Dispatches to the appropriate policy handler based on the action string.
        Returns (allowed, reason).
        """
        policies: dict = {
            "flag.modify": PolicyEngine._handle_modify,
            "flag.deploy_production": PolicyEngine._handle_deploy_production,
        }
        handler = policies.get(action)
        if not handler:
            return True, "no policy defined"
        return await handler(session, user, resource)

    # -- internal dispatch helpers --

    @staticmethod
    async def _handle_modify(
        session: AsyncSession, user: dict, resource: dict,
    ) -> tuple[bool, str]:
        return await PolicyEngine.can_modify_flag(
            session, user,
            resource.get("flag_key", ""),
            resource.get("environment", "production"),
        )

    @staticmethod
    async def _handle_deploy_production(
        session: AsyncSession, user: dict, resource: dict,
    ) -> tuple[bool, str]:
        return await PolicyEngine.can_deploy_to_production(
            session, user,
            resource.get("flag_key", ""),
        )

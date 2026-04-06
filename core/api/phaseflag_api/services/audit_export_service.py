"""Audit log export service — CSV and NDJSON (SIEM-compatible) formats."""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.audit import AuditLogDB

logger = logging.getLogger(__name__)

ExportFormat = Literal["csv", "json"]

# CSV column order
_CSV_FIELDS = ["timestamp", "actor", "action", "entity_type", "entity_key", "details"]


async def _fetch_logs(
    session: AsyncSession,
    date_from: datetime | None,
    date_to: datetime | None,
    entity_type: str | None = None,
    actor: str | None = None,
    limit: int = 100_000,
) -> list[AuditLogDB]:
    """Fetch audit log rows matching the given filters."""
    stmt = select(AuditLogDB).order_by(AuditLogDB.timestamp.asc())

    if date_from:
        stmt = stmt.where(AuditLogDB.timestamp >= date_from)
    if date_to:
        stmt = stmt.where(AuditLogDB.timestamp <= date_to)
    if entity_type:
        stmt = stmt.where(AuditLogDB.entity_type == entity_type)
    if actor:
        stmt = stmt.where(AuditLogDB.actor == actor)

    stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


def _log_to_dict(log: AuditLogDB) -> dict[str, Any]:
    """Convert an AuditLogDB row to a normalised export dict."""
    details: Any = {}
    try:
        details = json.loads(log.changes or "{}")
    except (json.JSONDecodeError, TypeError):
        details = log.changes

    return {
        "timestamp": log.timestamp.isoformat() if log.timestamp else "",
        "actor": log.actor or "",
        "action": log.action or "",
        "entity_type": log.entity_type or "",
        "entity_key": log.entity_key or "",
        "details": details,
    }


async def export_audit_logs(
    session: AsyncSession,
    *,
    format: ExportFormat = "csv",
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    entity_type: str | None = None,
    actor: str | None = None,
) -> tuple[str, str]:
    """Export audit logs in the requested format.

    Args:
        session: Async database session.
        format: "csv" or "json" (NDJSON).
        date_from: Inclusive start of time range (UTC).
        date_to: Inclusive end of time range (UTC).
        entity_type: Optional filter by entity type (e.g. "flag").
        actor: Optional filter by actor (e.g. user email).

    Returns:
        Tuple of (content: str, media_type: str).
        - CSV: text/csv with header row
        - JSON: application/x-ndjson (one JSON object per line, SIEM-compatible)
    """
    logs = await _fetch_logs(
        session,
        date_from=date_from,
        date_to=date_to,
        entity_type=entity_type,
        actor=actor,
    )

    logger.info(
        "audit_export_service.export_audit_logs: exporting %d records as %s",
        len(logs),
        format,
    )

    if format == "csv":
        return _to_csv(logs), "text/csv"
    return _to_ndjson(logs), "application/x-ndjson"


def _to_csv(logs: list[AuditLogDB]) -> str:
    """Serialise logs to CSV with a header row.

    Columns: timestamp, actor, action, entity_type, entity_key, details
    The `details` column contains the JSON-encoded changes dict.
    """
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=_CSV_FIELDS, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()

    for log in logs:
        row = _log_to_dict(log)
        # Flatten details to a compact JSON string for CSV
        row["details"] = json.dumps(row["details"], separators=(",", ":"))
        writer.writerow(row)

    return output.getvalue()


def _to_ndjson(logs: list[AuditLogDB]) -> str:
    """Serialise logs to NDJSON (one JSON object per line) for SIEM ingestion.

    Each line is a valid JSON object with:
      timestamp, actor, action, entity_type, entity_key, details
    """
    lines: list[str] = []
    for log in logs:
        row = _log_to_dict(log)
        lines.append(json.dumps(row, default=str))
    return "\n".join(lines)

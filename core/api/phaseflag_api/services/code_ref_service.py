"""Code reference service — flag usage scanning and tracking."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import Base

logger = logging.getLogger(__name__)

# In-memory store for code references (will be DB-backed in future)
_code_refs: dict[str, list[dict[str, Any]]] = {}


def upload_references(flag_key: str, references: list[dict[str, Any]]) -> int:
    """Store code references for a flag key."""
    _code_refs[flag_key] = [
        {
            "file": ref.get("file", ""),
            "line": ref.get("line", 0),
            "repo": ref.get("repo", ""),
            "branch": ref.get("branch", "main"),
            "language": ref.get("language", ""),
            "context": ref.get("context", ""),
            "uploaded_at": datetime.now(UTC).isoformat(),
        }
        for ref in references
    ]
    return len(references)


def get_references(flag_key: str) -> list[dict[str, Any]]:
    """Get all code references for a flag."""
    return _code_refs.get(flag_key, [])


def get_summary() -> dict[str, Any]:
    """Get summary of code references across all flags."""
    total_refs = sum(len(refs) for refs in _code_refs.values())
    flags_with_refs = len(_code_refs)
    by_language: dict[str, int] = {}
    by_repo: dict[str, int] = {}

    for refs in _code_refs.values():
        for ref in refs:
            lang = ref.get("language", "unknown")
            by_language[lang] = by_language.get(lang, 0) + 1
            repo = ref.get("repo", "unknown")
            by_repo[repo] = by_repo.get(repo, 0) + 1

    return {
        "total_references": total_refs,
        "flags_with_references": flags_with_refs,
        "by_language": by_language,
        "by_repository": by_repo,
    }


def get_unused_flags(known_flag_keys: list[str]) -> list[str]:
    """Find flags that have no code references."""
    return [key for key in known_flag_keys if key not in _code_refs]

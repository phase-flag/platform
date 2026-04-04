"""Developer workflow support — test users, overrides, debug tools."""

from datetime import UTC, datetime

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------
_test_users: dict[str, dict] = {}
_forced_treatments: dict[str, dict] = {}  # flag_key -> {user_id: variation}


# ---------------------------------------------------------------------------
# Test users
# ---------------------------------------------------------------------------


def create_test_user(user_id: str, name: str, attributes: dict | None = None) -> dict:
    _test_users[user_id] = {
        "user_id": user_id,
        "name": name,
        "attributes": attributes or {},
        "created_at": datetime.now(UTC).isoformat(),
    }
    return _test_users[user_id]


def list_test_users() -> list[dict]:
    return list(_test_users.values())


def delete_test_user(user_id: str) -> bool:
    return _test_users.pop(user_id, None) is not None


# ---------------------------------------------------------------------------
# Forced treatments
# ---------------------------------------------------------------------------


def set_forced_treatment(flag_key: str, user_id: str, variation: str) -> None:
    if flag_key not in _forced_treatments:
        _forced_treatments[flag_key] = {}
    _forced_treatments[flag_key][user_id] = variation


def get_forced_treatment(flag_key: str, user_id: str) -> str | None:
    return _forced_treatments.get(flag_key, {}).get(user_id)


def clear_forced_treatments(
    flag_key: str | None = None, user_id: str | None = None
) -> None:
    if flag_key and user_id:
        _forced_treatments.get(flag_key, {}).pop(user_id, None)
    elif flag_key:
        _forced_treatments.pop(flag_key, None)
    else:
        _forced_treatments.clear()


# ---------------------------------------------------------------------------
# Simulation / debug
# ---------------------------------------------------------------------------


def simulate_rollout(flag_key: str, total_users: int, percentage: int) -> dict:
    """Simulate how many users would be affected by a rollout percentage."""
    from phaseflag_api.services.evaluation_engine import _djb2_hash

    affected = 0
    for i in range(total_users):
        user_id = f"sim_user_{i}"
        hash_val = _djb2_hash(f"{flag_key}:{user_id}") % 100
        if hash_val < percentage:
            affected += 1
    return {
        "flag_key": flag_key,
        "total_users": total_users,
        "percentage": percentage,
        "affected_count": affected,
        "actual_percentage": round(affected / total_users * 100, 2)
        if total_users > 0
        else 0,
    }


def what_would_user_get(flag: dict, user_context: dict) -> dict:
    """Debug tool: explain what a specific user would get for a flag."""
    from phaseflag_api.services.evaluation_engine import evaluate

    result = evaluate(flag, user_context)
    return {
        "flag_key": flag.get("key"),
        "user_id": user_context.get("user_id"),
        "variation": result.get("variation"),
        "reason": result.get("reason"),
        "context_used": user_context,
    }

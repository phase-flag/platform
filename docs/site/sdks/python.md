---
title: "Python SDK"
description: "Integrate Phase Flag into your Python application — synchronous client with thread-based background polling and event batching."
---

# Python SDK

## Installation

```bash
pip install phaseflag-sdk
# or with Poetry
poetry add phaseflag-sdk
```

**Requires Python 3.8+**

---

## Initialization

```python
from phaseflag import PhaseFlagClient

client = PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",  # including /api/v1
    api_key="sdk-dev-xxxxxxxxxxxx",
    polling_interval=30.0,   # seconds between ruleset fetches (default: 30)
)

# Fetch initial ruleset and start background threads
client.start()

# Block until the first ruleset fetch completes (timeout in seconds)
client.wait_until_ready(timeout=5.0)
```

---

## Evaluating Flags

### Boolean flag

```python
from phaseflag import EvaluationContext

context = EvaluationContext(user_id="user-123")

# Returns False if flag is off, not found, or not boolean
enabled = client.get_boolean_value("new-checkout-flow", False, context)

if enabled:
    render_new_checkout()
else:
    render_legacy_checkout()
```

### String flag

```python
theme = client.get_string_value("ui-theme", "light", context)
# Returns "dark", "light", or "system"
apply_theme(theme)
```

### JSON flag

```python
config = client.get_json_value("checkout-config", {"provider": "stripe"}, context)
# Returns a dict, e.g. {"showPromoCode": True, "maxItems": 10, "provider": "stripe"}
print(config["provider"])
```

### Full evaluation result

```python
result = client.get_variation("new-checkout-flow", context)

if result:
    print(result.value)          # True
    print(result.reason)         # "targeting_match" | "percentage_rollout" | "default"
    print(result.variation_key)  # "enabled"
```

---

## EvaluationContext

```python
from phaseflag import EvaluationContext

context = EvaluationContext(
    user_id="user-123",           # used for percentage rollout bucketing
    session_id="sess-abc",        # fallback when user_id is not available
    attributes={
        "email": "alice@example.com",
        "plan": "pro",
        "country": "US",
        "app_version": "2.4.1",
        "account_age": 365,
    },
)

enabled = client.get_boolean_value("beta-feature", False, context)
```

Attributes support `str`, `int`, `float`, and `bool` values.

---

## Context Manager

The client supports the context manager protocol for short-lived scripts:

```python
from phaseflag import PhaseFlagClient, EvaluationContext

with PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",
    api_key="sdk-dev-xxxxxxxxxxxx",
) as client:
    client.wait_until_ready(timeout=5.0)
    context = EvaluationContext(user_id="user-123")
    result = client.get_boolean_value("my-flag", False, context)
    print(result)
# Client is automatically stopped and events flushed on exit
```

---

## FastAPI Integration

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from phaseflag import PhaseFlagClient, EvaluationContext

pf_client: PhaseFlagClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pf_client
    pf_client = PhaseFlagClient(
        base_url="https://api.phaseflag.com/api/v1",
        api_key="sdk-dev-xxxxxxxxxxxx",
    )
    pf_client.start()
    pf_client.wait_until_ready(timeout=10.0)
    yield
    pf_client.stop()

app = FastAPI(lifespan=lifespan)

@app.get("/checkout")
async def checkout(request: Request, user_id: str):
    context = EvaluationContext(
        user_id=user_id,
        attributes={"plan": request.headers.get("X-User-Plan", "free")},
    )
    use_new_flow = pf_client.get_boolean_value("new-checkout-flow", False, context)
    return {"flow": "new" if use_new_flow else "legacy"}
```

---

## Listen for Flag Changes

Register a callback that fires whenever the ruleset is updated:

```python
def on_flags_changed(flags: dict) -> None:
    print(f"Ruleset updated: {len(flags)} flags loaded")
    # Re-evaluate and update your application state

unsubscribe = client.on_flags_changed(on_flags_changed)

# Remove the listener later
unsubscribe()
```

---

## Flag Mocking (Testing)

Override flag values for tests without connecting to the API:

```python
from phaseflag import PhaseFlagClient

# Empty base_url disables HTTP — safe for unit tests
client = PhaseFlagClient(base_url="", api_key="")

client.set_override("new-checkout-flow", True)
assert client.get_boolean_value("new-checkout-flow", False) is True

client.clear_override("new-checkout-flow")
client.clear_all_overrides()
```

---

## Bootstrap Loading

Load flags from a file or URL for offline resilience:

```python
# From a local file (useful for tests or edge environments)
client = PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",
    api_key="sdk-dev-xxxxxxxxxxxx",
    bootstrap_file="/etc/phaseflag/bootstrap.json",
)

# From a URL (e.g., your own CDN endpoint)
client = PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",
    api_key="sdk-dev-xxxxxxxxxxxx",
    bootstrap_url="https://cdn.example.com/flags/bootstrap.json",
)
```

---

## Offline Mode

Run the client against bootstrap data when the API is unreachable:

```python
client = PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",
    api_key="sdk-dev-xxxxxxxxxxxx",
    offline_mode=True,
    bootstrap_file="/etc/phaseflag/bootstrap.json",
)
client.start()
# If the API is unreachable, the client will use the bootstrap data and
# become ready immediately.
```

---

## Remote Evaluation

Evaluate a flag server-side (sends the context to the API):

```python
result = client.evaluate(
    flag_key="new-checkout-flow",
    ctx=EvaluationContext(user_id="user-123"),
)

print(result.value)   # True
print(result.reason)  # "targeting_match"
```

---

## Event Tracking

Track custom evaluation events for analytics:

```python
from phaseflag.types import EvaluationEvent

client.track_event(EvaluationEvent(
    flag_key="new-checkout-flow",
    variation_key="enabled",
    user_id="user-123",
    metadata={"page": "checkout"},
))

# Flush all queued events immediately
client.flush_events()
```

---

## Configuration Reference

```python
from phaseflag import PhaseFlagClient

client = PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",  # required
    api_key="sdk-dev-xxxxxxxxxxxx",              # required
    polling_interval=30.0,                        # seconds between ruleset fetches
    event_flush_interval=30.0,                    # seconds between event flushes
    event_batch_size=100,                         # max events before auto-flush
    bootstrap_file="/path/to/bootstrap.json",     # optional
    bootstrap_url="https://cdn.example.com/b.json", # optional
    offline_mode=False,                           # use bootstrapped data if API is down
)
```

---

## Cleanup

Always stop the client to flush pending events:

```python
import atexit

client = PhaseFlagClient(
    base_url="https://api.phaseflag.com/api/v1",
    api_key="sdk-dev-xxxxxxxxxxxx",
)
client.start()

atexit.register(client.stop)
```

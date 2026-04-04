---
title: "Python SDK"
description: "Integrate Phase Flag into your Python application — supports sync and async usage."
---

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
    api_key="sdk-dev-xxxxxxxxxxxx",
    environment="development",
    base_url="https://api.phaseflag.io",  # optional
    polling_interval=30,                   # seconds, default: 30
)

client.initialize()
```

---

## Evaluating Flags

### Boolean Flag

```python
from phaseflag import EvaluationContext

context = EvaluationContext(user_key="user-123")

enabled = client.evaluate_flag("new-checkout-flow", context)

if enabled:
    render_new_checkout()
else:
    render_legacy_checkout()
```

### String Flag

```python
theme = client.evaluate_flag("ui-theme", context)
# Returns "dark", "light", or "system"
apply_theme(theme)
```

### Number Flag

```python
rate_limit = client.evaluate_flag("api-rate-limit", context)
# Returns an int or float, e.g. 100
configure_rate_limiter(rate_limit)
```

### JSON Flag

```python
config = client.evaluate_flag("checkout-config", context)
# Returns a dict: {"showPromoCode": True, "maxItems": 10, "provider": "stripe"}
print(config["provider"])
```

---

## EvaluationContext with Attributes

```python
from phaseflag import EvaluationContext

context = EvaluationContext(
    user_key="user-123",
    attributes={
        "email": "alice@example.com",
        "plan": "pro",
        "country": "US",
        "app_version": "2.4.1",
        "account_age": 365,
    },
)

enabled = client.evaluate_flag("beta-feature", context)
```

Attributes support `str`, `int`, `float`, and `bool` values. They are matched against targeting rules configured in the dashboard.

---

## Evaluation Detail

```python
result = client.evaluate_flag_with_detail("new-checkout-flow", context)

print(result.value)        # True
print(result.reason)       # "TARGETING_RULE"
print(result.rule_id)      # "rule_abc123"
print(result.variation_key)  # "enabled"
```

---

## Async Support

Use `AsyncPhaseFlagClient` in async applications (FastAPI, aiohttp, etc.):

```python
import asyncio
from phaseflag.asyncio import AsyncPhaseFlagClient, EvaluationContext

async def main():
    client = AsyncPhaseFlagClient(
        api_key="sdk-dev-xxxxxxxxxxxx",
        environment="production",
    )
    await client.initialize()

    context = EvaluationContext(
        user_key="user-123",
        attributes={"plan": "enterprise"},
    )

    enabled = await client.evaluate_flag("new-feature", context)
    print(f"Feature enabled: {enabled}")

    await client.close()

asyncio.run(main())
```

### FastAPI Integration

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from phaseflag.asyncio import AsyncPhaseFlagClient, EvaluationContext

client: AsyncPhaseFlagClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    client = AsyncPhaseFlagClient(
        api_key="sdk-dev-xxxxxxxxxxxx",
        environment="production",
    )
    await client.initialize()
    yield
    await client.close()

app = FastAPI(lifespan=lifespan)

@app.get("/checkout")
async def checkout(user_id: str):
    context = EvaluationContext(user_key=user_id)
    use_new_flow = await client.evaluate_flag("new-checkout-flow", context)
    return {"flow": "new" if use_new_flow else "legacy"}
```

---

## Context Manager Usage

The sync client supports the context manager protocol for short-lived scripts:

```python
from phaseflag import PhaseFlagClient, EvaluationContext

with PhaseFlagClient(api_key="sdk-dev-xxxxxxxxxxxx", environment="production") as client:
    context = EvaluationContext(user_key="user-123")
    result = client.evaluate_flag("my-flag", context)
    print(result)
# Client is automatically closed and events flushed on exit
```

---

## Configuration Reference

```python
from phaseflag import PhaseFlagClient

client = PhaseFlagClient(
    api_key="sdk-dev-xxxxxxxxxxxx",     # required
    environment="production",           # required
    base_url="https://api.phaseflag.io", # optional
    polling_interval=30,                # seconds between ruleset fetches
    timeout=5,                          # HTTP request timeout in seconds
    logger=my_logger,                   # optional custom logger (logging.Logger)
)
```

---

## Cleanup

Always close the client to flush pending evaluation events:

```python
import atexit

client = PhaseFlagClient(api_key="sdk-dev-xxxxxxxxxxxx", environment="production")
client.initialize()

atexit.register(client.close)
```

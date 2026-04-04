# Python SDK Quickstart

## Install

```bash
pip install phaseflag-sdk
```

## Initialize

```python
from phaseflag import PhaseFlagClient

client = PhaseFlagClient(
    api_key="sdk-dev-xxxxxxxxxxxx",
    environment="production",
)
client.initialize()
```

## Evaluate a Flag

```python
from phaseflag import EvaluationContext

context = EvaluationContext(user_key="user-123")
enabled = client.evaluate_flag("my-flag", context)

if enabled:
    # new code path
    pass
```

## User Targeting

```python
context = EvaluationContext(
    user_key="user-123",
    attributes={
        "email": "alice@example.com",
        "plan": "pro",
        "country": "US",
    },
)
enabled = client.evaluate_flag("beta-feature", context)
```

## Async Support

```python
from phaseflag.asyncio import AsyncPhaseFlagClient, EvaluationContext

async def main():
    client = AsyncPhaseFlagClient(
        api_key="sdk-dev-xxxxxxxxxxxx",
        environment="production",
    )
    await client.initialize()

    context = EvaluationContext(user_key="user-123")
    enabled = await client.evaluate_flag("my-flag", context)

    await client.close()
```

## Context Manager

```python
with PhaseFlagClient(api_key="sdk-dev-xxxxxxxxxxxx", environment="production") as client:
    context = EvaluationContext(user_key="user-123")
    result = client.evaluate_flag("my-flag", context)
```

## Further Reading

See the [full Python SDK guide](https://docs.phaseflag.io/sdks/python) for async FastAPI integration, detailed evaluation, and more.

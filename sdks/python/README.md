# Phase Flag SDK -- Python

Official Python SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, bootstrap loading, offline mode, and flag mocking -- all backed by simple threads (no asyncio dependency).

## Installation

```bash
pip install phaseflag-sdk
```

Requires Python 3.9+.

## Quick Start

```python
from phaseflag import PhaseFlagClient, EvaluationContext

# Basic usage
client = PhaseFlagClient(
    base_url="https://api.example.com/api/v1",
    api_key="your-api-key",
)
client.start()
client.wait_until_ready()

if client.get_boolean_value("dark-mode", False):
    enable_dark_mode()

variant = client.get_string_value("checkout-flow", "control")

client.stop()

# Context manager usage
with PhaseFlagClient(base_url="...", api_key="...") as client:
    client.wait_until_ready()
    value = client.get_boolean_value("dark-mode", False)

# With targeting context
ctx = EvaluationContext(user_id="user-123", attributes={"plan": "pro"})
enabled = client.get_boolean_value("premium-feature", False, context=ctx)
```

## API Reference

### `PhaseFlagClient`

#### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_url` | `str` | required | Base URL of the Phase Flag API |
| `api_key` | `str` | required | API key for authentication |
| `polling_interval` | `float` | `30.0` | Seconds between ruleset polls |
| `event_flush_interval` | `float` | `30.0` | Seconds between event flushes |
| `event_batch_size` | `int` | `100` | Max events before auto-flush |
| `bootstrap_file` | `str \| Path` | `None` | Path to local bootstrap JSON file |
| `bootstrap_url` | `str` | `None` | URL to fetch bootstrap data from |
| `bootstrap_data` | `dict` | `None` | Pre-loaded bootstrap data |
| `offline_mode` | `bool` | `False` | Use cached/bootstrapped data when API is unreachable |

#### Lifecycle

- `start() -> None` -- Fetch ruleset and start background threads.
- `stop() -> None` -- Stop threads and flush remaining events.
- `wait_until_ready(timeout=10.0) -> bool` -- Block until ready.
- `is_ready -> bool` -- Whether the client has fetched at least one ruleset.

#### Local Evaluation

- `get_boolean_value(flag_key, default, context=None) -> bool`
- `get_string_value(flag_key, default, context=None) -> str`
- `get_json_value(flag_key, default, context=None) -> T`
- `get_variation(flag_key, context=None) -> EvaluationResult | None`
- `get_all_flags() -> list[FlagDefinition]`

#### Remote Evaluation

- `evaluate(flag_key, context=None) -> EvaluationResult`

#### Event Tracking

- `track_event(flag_key, variation_key=None, context=None, metadata=None) -> None`
- `flush_events() -> None`

#### Testing

- `set_override(flag_key, value) -> None`
- `clear_override(flag_key) -> None`
- `clear_all_overrides() -> None`

#### Change Listeners

- `on_flags_changed(callback) -> Callable[[], None]` -- Returns an unsubscribe function.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling with configurable interval
- Offline mode with bootstrap files (file, URL, or dict)
- Batched event tracking with auto-flush
- Context manager support (`with` statement)
- Thread-safe -- all methods safe for concurrent use
- Flag mocking for testing (no server required)
- Minimal dependencies (httpx only)

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/python](https://docs.phaseflag.dev/sdks/python)

## License

Apache 2.0

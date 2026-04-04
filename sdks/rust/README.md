# Phase Flag SDK -- Rust

Official Rust SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback. Uses blocking I/O via `reqwest::blocking` -- no async runtime required.

## Installation

```bash
cargo add phaseflag
```

Or add to `Cargo.toml`:

```toml
[dependencies]
phaseflag = "0.1.0"
```

## Quick Start

```rust
use phaseflag::{PhaseFlagClient, PhaseFlagConfig};
use std::time::Duration;

fn main() {
    let client = PhaseFlagClient::new(PhaseFlagConfig {
        base_url: "https://api.example.com/api/v1".into(),
        api_key: "your-api-key".into(),
        ..Default::default()
    });

    client.start().expect("failed to start");
    assert!(client.wait_until_ready(Duration::from_secs(5)));

    let dark_mode = client.get_boolean_value("dark-mode", false, None);
    let variant = client.get_string_value("checkout-flow", "control", None);
    let config = client.get_json_value(
        "pricing",
        serde_json::json!({"tier": "free"}),
        None,
    );

    client.stop();
}
```

## API Reference

### `PhaseFlagConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `base_url` | `String` | required | Base URL of the Phase Flag API |
| `api_key` | `String` | required | API key for authentication |
| `polling_interval_secs` | `u64` | `30` | Seconds between ruleset polls |
| `event_flush_interval_secs` | `u64` | `30` | Seconds between event flushes |
| `event_batch_size` | `usize` | `100` | Max events before auto-flush |

### `PhaseFlagClient`

#### Lifecycle

- `PhaseFlagClient::new(config: PhaseFlagConfig) -> Self`
- `start(&self) -> Result<(), Box<dyn Error>>` -- Fetch ruleset and spawn background threads.
- `stop(&self)` -- Signal threads to stop and perform final event flush.
- `wait_until_ready(&self, timeout: Duration) -> bool`
- `is_ready(&self) -> bool`

#### Local Evaluation

- `get_boolean_value(&self, flag_key: &str, default: bool, ctx: Option<&EvaluationContext>) -> bool`
- `get_string_value(&self, flag_key: &str, default: &str, ctx: Option<&EvaluationContext>) -> String`
- `get_json_value(&self, flag_key: &str, default: Value, ctx: Option<&EvaluationContext>) -> Value`
- `get_variation(&self, flag_key: &str, ctx: Option<&EvaluationContext>) -> Option<EvaluationResult>`
- `get_all_flags(&self) -> Vec<FlagDefinition>`

#### Remote Evaluation

- `evaluate_remote(&self, flag_key: &str, ctx: Option<&EvaluationContext>) -> Result<EvaluationResult, Box<dyn Error>>`

#### Event Tracking

- `track_event(&self, event: EvaluationEvent)`
- `flush_events(&self) -> Result<(), Box<dyn Error>>`

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via `std::thread` (no async runtime needed)
- Batched event tracking with auto-flush
- Thread-safe via `parking_lot` RwLock/Mutex
- Automatic cleanup via `Drop` implementation
- Dependencies: serde, serde_json, reqwest (blocking), parking_lot

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/rust](https://docs.phaseflag.dev/sdks/rust)

## License

Apache 2.0

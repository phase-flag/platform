# Phase Flag SDK -- Ruby

Official Ruby SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback. Zero external dependencies -- uses only Ruby's standard library (`net/http`, `json`).

## Installation

```bash
gem install phaseflag
```

Or add to your `Gemfile`:

```ruby
gem 'phaseflag'
```

Requires Ruby 2.7+.

## Quick Start

```ruby
require "phaseflag"

client = PhaseFlag::Client.new(
  base_url: "https://api.example.com/api/v1",
  api_key: "your-api-key"
)
client.start
client.wait_until_ready

ctx = PhaseFlag::EvaluationContext.new(user_id: "user-123")

if client.get_boolean_value("dark-mode", false, context: ctx)
  enable_dark_mode
end

variant = client.get_string_value("checkout-flow", "control", context: ctx)

client.stop
```

## API Reference

### `PhaseFlag::Client`

#### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_url` | `String` | required | Base URL of the Phase Flag API |
| `api_key` | `String` | required | API key for authentication |
| `polling_interval` | `Numeric` | `30` | Seconds between ruleset polls |
| `event_flush_interval` | `Numeric` | `30` | Seconds between event flushes |
| `event_batch_size` | `Integer` | `100` | Max events before auto-flush |

#### Lifecycle

- `start` -- Fetch ruleset and start background threads.
- `stop` -- Stop threads and flush remaining events.
- `wait_until_ready(timeout: 10) -> Boolean`
- `ready? -> Boolean`

#### Local Evaluation

- `get_boolean_value(flag_key, default_value, context: nil) -> Boolean`
- `get_string_value(flag_key, default_value, context: nil) -> String`
- `get_json_value(flag_key, default_value, context: nil) -> Object`
- `get_variation(flag_key, context: nil) -> EvaluationResult | nil`
- `get_all_flags -> Array<FlagDefinition>`

#### Remote Evaluation

- `evaluate(flag_key, context: nil) -> EvaluationResult`

#### Event Tracking

- `track_event(flag_key:, variation_key: nil, user_id: nil, timestamp: nil, metadata: {})`
- `flush_events`

#### Change Listeners

- `on_flags_changed(&block) -> Proc` -- Returns an unsubscribe proc.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via Ruby threads
- Batched event tracking with auto-flush
- Thread-safe -- all state protected by Mutex
- Zero external dependencies (stdlib only)

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/ruby](https://docs.phaseflag.dev/sdks/ruby)

## License

MIT

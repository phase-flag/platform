# Phase Flag SDK -- Flutter

Official Flutter/Dart SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback.

## Installation

```bash
flutter pub add phaseflag_flutter
```

Or add to `pubspec.yaml`:

```yaml
dependencies:
  phaseflag_flutter: ^0.1.0
```

Requires Dart SDK >=3.0.0 and Flutter >=3.10.0.

## Quick Start

```dart
import 'package:phaseflag_flutter/phaseflag_flutter.dart';

final client = PhaseFlagClient(
  config: PhaseFlagConfig(
    baseUrl: 'https://api.example.com/api/v1',
    apiKey: 'your-api-key',
  ),
);

await client.start();
await client.waitUntilReady();

final ctx = EvaluationContext(userId: 'user-123');

if (client.getBooleanValue('dark-mode', false, ctx)) {
  enableDarkMode();
}

final variant = client.getStringValue('onboarding-flow', 'control', ctx);

client.stop();
```

## API Reference

### `PhaseFlagClient`

#### Lifecycle

- `PhaseFlagClient({required PhaseFlagConfig config})`
- `start() -> Future<void>` -- Fetch ruleset and start background polling.
- `stop()` -- Cancel timers and flush remaining events.
- `waitUntilReady() -> Future<void>`
- `isReady -> bool`

#### Local Evaluation

- `getBooleanValue(String flagKey, bool defaultValue, [EvaluationContext? ctx]) -> bool`
- `getStringValue(String flagKey, String defaultValue, [EvaluationContext? ctx]) -> String`
- `getJsonValue<T>(String flagKey, T defaultValue, [EvaluationContext? ctx]) -> T`
- `getVariation(String flagKey, [EvaluationContext? ctx]) -> EvaluationResult?`
- `getAllFlags() -> List<FlagDefinition>`

#### Event Tracking

- `trackEvent(EvaluationEvent event)`
- `flushEvents() -> Future<void>`

#### Testing

- `setOverride(String flagKey, dynamic value)`
- `clearOverride(String flagKey)`
- `clearAllOverrides()`

#### Change Listeners

- `onFlagsChanged(void Function(List<FlagDefinition>) listener) -> void Function()` -- Returns an unsubscribe function.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via Dart Timer
- Batched event tracking with auto-flush
- Flag mocking for testing (no server required)
- Minimal dependencies (http package only)

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/flutter](https://docs.phaseflag.dev/sdks/flutter)

## License

Apache 2.0

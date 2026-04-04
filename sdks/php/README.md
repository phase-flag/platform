# Phase Flag SDK -- PHP

Official PHP SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, server-side evaluation fallback, and batched event tracking. Uses `ext-curl` with zero external dependencies.

## Installation

```bash
composer require phaseflag/sdk-php
```

Requires PHP 8.1+ with `ext-curl` and `ext-json`.

## Quick Start

```php
<?php

use PhaseFlag\PhaseFlagClient;
use PhaseFlag\Models\EvaluationContext;

$client = new PhaseFlagClient(
    baseUrl: 'https://api.example.com/api/v1',
    apiKey: 'your-api-key',
);

// Fetch flags at the start of each request
$client->fetchRuleset();

$ctx = new EvaluationContext(userId: 'user-123');

if ($client->getBooleanValue('dark-mode', false, $ctx)) {
    enableDarkMode();
}

$variant = $client->getStringValue('checkout-flow', 'control', $ctx);

// Track and flush events at the end of the request
$client->trackEvent('dark-mode', variationKey: 'on', userId: 'usr_123');
$client->flushEvents();
```

> **Note:** PHP is typically request-scoped, so this client does not spawn background polling threads. Call `fetchRuleset()` at the start of each request, or integrate with a shared cache layer (APCu, Redis) to keep flags fresh.

## API Reference

### `PhaseFlagClient`

#### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `$baseUrl` | `string` | required | Base URL of the Phase Flag API |
| `$apiKey` | `string` | required | API key for authentication |
| `$pollingInterval` | `int` | `30` | Advisory polling interval in seconds |
| `$eventBatchSize` | `int` | `100` | Max events before auto-flush |

#### Lifecycle

- `fetchRuleset(): void` -- Fetch the complete flag ruleset from the API.
- `isReady(): bool`

#### Local Evaluation

- `getBooleanValue(string $flagKey, bool $defaultValue, ?EvaluationContext $ctx = null): bool`
- `getStringValue(string $flagKey, string $defaultValue, ?EvaluationContext $ctx = null): string`
- `getJsonValue(string $flagKey, mixed $defaultValue, ?EvaluationContext $ctx = null): mixed`
- `getVariation(string $flagKey, ?EvaluationContext $ctx = null): ?EvaluationResult`
- `getAllFlags(): array`

#### Remote Evaluation

- `evaluate(string $flagKey, ?EvaluationContext $ctx = null): EvaluationResult`

#### Event Tracking

- `trackEvent(string $flagKey, ?string $variationKey = null, ?string $userId = null, ?string $timestamp = null, array $metadata = []): void`
- `flushEvents(): void`

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Request-scoped design (no background threads)
- Batched event tracking with auto-flush on threshold
- Zero external dependencies (ext-curl and ext-json only)
- PSR-4 autoloading

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/php](https://docs.phaseflag.dev/sdks/php)

## License

MIT

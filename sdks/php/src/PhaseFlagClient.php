<?php

declare(strict_types=1);

namespace PhaseFlag;

use PhaseFlag\Models\EvaluationContext;
use PhaseFlag\Models\EvaluationEvent;
use PhaseFlag\Models\EvaluationResult;
use PhaseFlag\Models\FlagDefinition;

/**
 * PhaseFlag PHP SDK client.
 *
 * Provides feature flag evaluation with local caching, server-side
 * evaluation fallback, and batched event tracking -- all using ext-curl
 * with zero external dependencies.
 *
 * PHP is typically request-scoped, so this client does **not** spawn
 * background polling threads. Instead, call {@see fetchRuleset()} at the
 * start of each request (or integrate with a shared cache layer such as
 * APCu/Redis) to keep flags fresh.
 *
 * Usage:
 * ```php
 * $client = new PhaseFlagClient(
 *     baseUrl: 'https://api.example.com/api/v1',
 *     apiKey:  'your-api-key',
 * );
 * $client->fetchRuleset();
 *
 * if ($client->getBooleanValue('dark-mode', false)) {
 *     enableDarkMode();
 * }
 *
 * $client->trackEvent('dark-mode', variationKey: 'on', userId: 'usr_123');
 * $client->flushEvents();
 * ```
 */
final class PhaseFlagClient
{
    /** @var array<string, FlagDefinition> Cached flag definitions keyed by flag key. */
    private array $flags = [];

    /** @var EvaluationEvent[] Queued events waiting to be flushed. */
    private array $eventQueue = [];

    /** @var bool Whether at least one successful ruleset fetch has completed. */
    private bool $ready = false;

    private readonly string $baseUrl;

    /**
     * @param string $baseUrl          Base URL of the PhaseFlag API (e.g. "https://api.example.com/api/v1").
     * @param string $apiKey           API key for authentication.
     * @param int    $pollingInterval  Advisory polling interval in seconds (for documentation; PHP is request-scoped).
     * @param int    $eventBatchSize   Maximum events to buffer before automatic flush.
     */
    public function __construct(
        string $baseUrl,
        private readonly string $apiKey,
        private readonly int $pollingInterval = 30,
        private readonly int $eventBatchSize = 100,
    ) {
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Fetch the complete flag ruleset from the API.
     *
     * Call this at the start of each request (or cache the result externally)
     * to ensure the client has up-to-date flag definitions.
     *
     * @throws \RuntimeException If the HTTP request fails.
     */
    public function fetchRuleset(): void
    {
        $response = $this->httpGet('/sdk/ruleset');

        if ($response['status'] < 200 || $response['status'] >= 300) {
            // Stale flags are better than no flags -- keep the old cache.
            return;
        }

        /** @var array<string, mixed> $data */
        $data = json_decode($response['body'], true, 512, JSON_THROW_ON_ERROR);

        $newFlags = [];
        foreach ($data['flags'] ?? [] as $rawFlag) {
            $flag = FlagDefinition::fromArray($rawFlag);
            $newFlags[$flag->key] = $flag;
        }

        $this->flags = $newFlags;
        $this->ready = true;
    }

    /**
     * Whether the client has successfully fetched at least one ruleset.
     */
    public function isReady(): bool
    {
        return $this->ready;
    }

    // ------------------------------------------------------------------
    // Local evaluation (typed accessors)
    // ------------------------------------------------------------------

    /**
     * Evaluate a boolean flag locally.
     *
     * Returns the default value if the flag is not found, is not active,
     * or the resolved value is not a boolean.
     */
    public function getBooleanValue(string $flagKey, bool $defaultValue, ?EvaluationContext $ctx = null): bool
    {
        $result = $this->resolveLocally($flagKey, $ctx);

        if ($result === null || !is_bool($result->value)) {
            return $defaultValue;
        }

        return $result->value;
    }

    /**
     * Evaluate a string flag locally.
     *
     * Returns the default value if the flag is not found, is not active,
     * or the resolved value is not a string.
     */
    public function getStringValue(string $flagKey, string $defaultValue, ?EvaluationContext $ctx = null): string
    {
        $result = $this->resolveLocally($flagKey, $ctx);

        if ($result === null || !is_string($result->value)) {
            return $defaultValue;
        }

        return $result->value;
    }

    /**
     * Evaluate a JSON (arbitrary) flag locally.
     *
     * Returns the default value if the flag is not found or is not active.
     */
    public function getJsonValue(string $flagKey, mixed $defaultValue, ?EvaluationContext $ctx = null): mixed
    {
        $result = $this->resolveLocally($flagKey, $ctx);

        if ($result === null) {
            return $defaultValue;
        }

        return $result->value;
    }

    /**
     * Get the full evaluation result for a flag, or null if not found.
     */
    public function getVariation(string $flagKey, ?EvaluationContext $ctx = null): ?EvaluationResult
    {
        return $this->resolveLocally($flagKey, $ctx);
    }

    /**
     * Return all currently cached flag definitions.
     *
     * @return FlagDefinition[]
     */
    public function getAllFlags(): array
    {
        return array_values($this->flags);
    }

    // ------------------------------------------------------------------
    // Remote evaluation
    // ------------------------------------------------------------------

    /**
     * Evaluate a flag server-side via POST /evaluate.
     *
     * Delegates evaluation to the API -- useful when targeting rules
     * require server-side context that the SDK does not have.
     *
     * @throws \RuntimeException  If the HTTP request fails.
     * @throws \JsonException     If the response body is not valid JSON.
     */
    public function evaluate(string $flagKey, ?EvaluationContext $ctx = null): EvaluationResult
    {
        $context = $ctx ?? new EvaluationContext();

        $payload = json_encode([
            'flag_key' => $flagKey,
            'context'  => $context->toArray(),
        ], JSON_THROW_ON_ERROR);

        $response = $this->httpPost('/evaluate', $payload);

        if ($response['status'] < 200 || $response['status'] >= 300) {
            $detail = json_decode($response['body'], true)['detail'] ?? "Evaluation failed: {$response['status']}";
            throw new \RuntimeException((string) $detail);
        }

        /** @var array<string, mixed> $data */
        $data = json_decode($response['body'], true, 512, JSON_THROW_ON_ERROR);

        return EvaluationResult::fromArray($data);
    }

    // ------------------------------------------------------------------
    // Event tracking
    // ------------------------------------------------------------------

    /**
     * Queue an evaluation event for later batched submission.
     *
     * Events are flushed automatically when the batch size threshold is
     * reached, or manually via {@see flushEvents()}.
     *
     * @param string               $flagKey      The flag that was evaluated.
     * @param string|null          $variationKey The variation that was served.
     * @param string|null          $userId       The user the flag was evaluated for.
     * @param string|null          $timestamp    ISO-8601 timestamp (defaults to now).
     * @param array<string, mixed> $metadata     Arbitrary event metadata.
     */
    public function trackEvent(
        string $flagKey,
        ?string $variationKey = null,
        ?string $userId = null,
        ?string $timestamp = null,
        array $metadata = [],
    ): void {
        $event = new EvaluationEvent(
            flagKey: $flagKey,
            variationKey: $variationKey,
            userId: $userId,
            timestamp: $timestamp ?? (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('c'),
            metadata: $metadata,
        );

        $this->eventQueue[] = $event;

        if (count($this->eventQueue) >= $this->eventBatchSize) {
            $this->flushEvents();
        }
    }

    /**
     * Send all queued events to POST /sdk/events immediately.
     *
     * On failure the events are re-enqueued so they are not lost.
     */
    public function flushEvents(): void
    {
        if ($this->eventQueue === []) {
            return;
        }

        $batch = $this->eventQueue;
        $this->eventQueue = [];

        $payload = json_encode([
            'events' => array_map(
                static fn (EvaluationEvent $e) => $e->toArray(),
                $batch,
            ),
        ], JSON_THROW_ON_ERROR);

        $response = $this->httpPost('/sdk/events', $payload);

        if ($response['status'] < 200 || $response['status'] >= 300) {
            // Re-enqueue on failure so events are not lost.
            $this->eventQueue = array_merge($batch, $this->eventQueue);
        }
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Resolve a flag locally using the cached ruleset and the Evaluator.
     */
    private function resolveLocally(string $flagKey, ?EvaluationContext $ctx): ?EvaluationResult
    {
        $flag = $this->flags[$flagKey] ?? null;

        if ($flag === null) {
            return null;
        }

        return Evaluator::evaluate($flag, $ctx);
    }

    /**
     * Perform an HTTP GET request using ext-curl.
     *
     * @return array{status: int, body: string}
     */
    private function httpGet(string $path): array
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL            => $this->baseUrl . $path,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $this->buildHeaders(),
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new \RuntimeException("HTTP GET {$path} failed: {$error}");
        }

        return ['status' => $status, 'body' => (string) $body];
    }

    /**
     * Perform an HTTP POST request using ext-curl.
     *
     * @return array{status: int, body: string}
     */
    private function httpPost(string $path, string $jsonBody): array
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL            => $this->baseUrl . $path,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $jsonBody,
            CURLOPT_HTTPHEADER     => $this->buildHeaders(),
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new \RuntimeException("HTTP POST {$path} failed: {$error}");
        }

        return ['status' => $status, 'body' => (string) $body];
    }

    /**
     * Build the standard HTTP headers for API requests.
     *
     * @return string[]
     */
    private function buildHeaders(): array
    {
        return [
            'Content-Type: application/json',
            'Accept: application/json',
            "X-API-Key: {$this->apiKey}",
        ];
    }
}

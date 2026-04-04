<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * An evaluation event to be sent to the PhaseFlag API for analytics.
 *
 * Events are batched locally and flushed in bulk via
 * {@see \PhaseFlag\PhaseFlagClient::flushEvents()}.
 */
final class EvaluationEvent
{
    /**
     * @param string               $flagKey      The flag that was evaluated.
     * @param string|null          $variationKey The variation that was served.
     * @param string|null          $userId       The user the flag was evaluated for.
     * @param string|null          $timestamp    ISO-8601 timestamp of the evaluation.
     * @param array<string, mixed> $metadata     Arbitrary event metadata.
     */
    public function __construct(
        public readonly string $flagKey,
        public readonly ?string $variationKey = null,
        public readonly ?string $userId = null,
        public readonly ?string $timestamp = null,
        public readonly array $metadata = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'flag_key'      => $this->flagKey,
            'variation_key' => $this->variationKey,
            'user_id'       => $this->userId,
            'timestamp'     => $this->timestamp,
            'metadata'      => $this->metadata,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        return new static(
            flagKey: $data['flag_key'],
            variationKey: $data['variation_key'] ?? null,
            userId: $data['user_id'] ?? null,
            timestamp: $data['timestamp'] ?? null,
            metadata: $data['metadata'] ?? [],
        );
    }
}

<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * The result of evaluating a feature flag.
 *
 * Contains the resolved variation (if any) and a reason string that
 * indicates how the value was determined (e.g. "default",
 * "targeting_match", "percentage_rollout").
 */
final class EvaluationResult
{
    public function __construct(
        public readonly string $flagKey,
        public readonly ?string $variationId = null,
        public readonly ?string $variationKey = null,
        public readonly mixed $value = null,
        public readonly string $reason = 'default',
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'flag_key'      => $this->flagKey,
            'variation_id'  => $this->variationId,
            'variation_key' => $this->variationKey,
            'value'         => $this->value,
            'reason'        => $this->reason,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        return new static(
            flagKey: $data['flag_key'],
            variationId: $data['variation_id'] ?? null,
            variationKey: $data['variation_key'] ?? null,
            value: $data['value'] ?? null,
            reason: $data['reason'] ?? 'default',
        );
    }
}

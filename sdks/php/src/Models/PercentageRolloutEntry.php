<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * One slice of a percentage rollout.
 *
 * Pairs a variation ID with a weight (0-100) that determines what proportion
 * of traffic is assigned to this variation.
 */
final class PercentageRolloutEntry
{
    public function __construct(
        public readonly string $variationId,
        public readonly int $weight,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'variation_id' => $this->variationId,
            'weight'       => $this->weight,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        return new static(
            variationId: $data['variation_id'] ?? '',
            weight: (int) ($data['weight'] ?? 0),
        );
    }
}

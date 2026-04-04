<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * Percentage-based traffic allocation among variations.
 *
 * A rollout contains one or more {@see PercentageRolloutEntry} instances
 * whose weights should sum to 100. The evaluator uses a DJB2 hash of the
 * user+flag combination to deterministically assign each user to a bucket.
 */
final class PercentageRollout
{
    /**
     * @param PercentageRolloutEntry[] $variations
     */
    public function __construct(
        public readonly array $variations = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'variations' => array_map(
                static fn (PercentageRolloutEntry $entry) => $entry->toArray(),
                $this->variations,
            ),
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        $entries = array_map(
            static fn (array $entry) => PercentageRolloutEntry::fromArray($entry),
            $data['variations'] ?? [],
        );

        return new static(variations: $entries);
    }
}

<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * A targeting rule with conditions, an optional explicit variation, and an
 * optional percentage rollout.
 *
 * Rules are evaluated in priority order (lower number = higher priority).
 * All conditions within a rule must match (AND logic) for the rule to apply.
 * When a rule matches it can either select an explicit variation or delegate
 * to a percentage rollout.
 */
final class TargetingRule
{
    /**
     * @param int                      $priority          Rule priority (lower = higher priority).
     * @param TargetingCondition[]     $conditions        Conditions that must all match.
     * @param string|null              $variationId       Explicit variation to serve when matched.
     * @param PercentageRollout|null   $percentageRollout Rollout to use when no explicit variation is set.
     * @param string|null              $segmentId         Optional segment reference.
     */
    public function __construct(
        public readonly int $priority = 0,
        public readonly array $conditions = [],
        public readonly ?string $variationId = null,
        public readonly ?PercentageRollout $percentageRollout = null,
        public readonly ?string $segmentId = null,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'priority'           => $this->priority,
            'conditions'         => array_map(
                static fn (TargetingCondition $c) => $c->toArray(),
                $this->conditions,
            ),
            'variation_id'       => $this->variationId,
            'percentage_rollout' => $this->percentageRollout?->toArray(),
            'segment_id'         => $this->segmentId,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        $conditions = array_map(
            static fn (array $c) => TargetingCondition::fromArray($c),
            $data['conditions'] ?? [],
        );

        $rollout = isset($data['percentage_rollout'])
            ? PercentageRollout::fromArray($data['percentage_rollout'])
            : null;

        return new static(
            priority: (int) ($data['priority'] ?? 0),
            conditions: $conditions,
            variationId: $data['variation_id'] ?? null,
            percentageRollout: $rollout,
            segmentId: $data['segment_id'] ?? null,
        );
    }
}

<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * A single condition within a targeting rule.
 *
 * Conditions compare a named attribute from the {@see EvaluationContext}
 * against a target value using one of the supported operators:
 * is, is_not, contains, not_contains, one_of, not_one_of, gt, lt,
 * matches_regex.
 */
final class TargetingCondition
{
    public function __construct(
        public readonly string $attribute,
        public readonly string $operator,
        public readonly mixed $value,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'attribute' => $this->attribute,
            'operator'  => $this->operator,
            'value'     => $this->value,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        return new static(
            attribute: $data['attribute'] ?? '',
            operator: $data['operator'] ?? '',
            value: $data['value'] ?? null,
        );
    }
}

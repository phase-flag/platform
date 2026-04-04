<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * A single variation of a feature flag.
 *
 * Each flag has one or more variations (e.g. "on"/"off" for a boolean flag,
 * or named variants for multi-variate flags). The {@see $value} field holds
 * the actual payload delivered to the application.
 */
final class Variation
{
    public function __construct(
        public readonly string $id,
        public readonly string $key,
        public readonly string $name,
        public readonly mixed $value,
        public readonly ?string $description = null,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id'          => $this->id,
            'key'         => $this->key,
            'name'        => $this->name,
            'value'       => $this->value,
            'description' => $this->description,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        return new static(
            id: $data['id'],
            key: $data['key'],
            name: $data['name'] ?? $data['key'],
            value: $data['value'] ?? null,
            description: $data['description'] ?? null,
        );
    }
}

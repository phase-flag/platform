<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * User/request attributes sent to targeting-rule evaluation.
 *
 * Contains a stable user identifier (for percentage rollouts), an optional
 * session identifier, and an arbitrary map of attributes that targeting
 * conditions can inspect.
 */
final class EvaluationContext
{
    /**
     * @param string|null              $userId     Stable user identifier used for percentage rollouts.
     * @param string|null              $sessionId  Fallback identifier when userId is unavailable.
     * @param array<string, mixed>     $attributes Arbitrary key-value pairs checked by targeting conditions.
     */
    public function __construct(
        public readonly ?string $userId = null,
        public readonly ?string $sessionId = null,
        public readonly array $attributes = [],
    ) {}

    /**
     * Look up a value by key -- checks standard fields first, then falls back
     * to the attributes map.
     */
    public function get(string $key, mixed $default = null): mixed
    {
        return match ($key) {
            'user_id'    => $this->userId ?? $default,
            'session_id' => $this->sessionId ?? $default,
            default      => $this->attributes[$key] ?? $default,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'user_id'    => $this->userId,
            'session_id' => $this->sessionId,
            'attributes' => $this->attributes,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        return new static(
            userId: $data['user_id'] ?? null,
            sessionId: $data['session_id'] ?? null,
            attributes: $data['attributes'] ?? [],
        );
    }
}

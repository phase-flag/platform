<?php

declare(strict_types=1);

namespace PhaseFlag\Models;

/**
 * A complete flag definition as received from the API ruleset.
 *
 * Contains everything needed to evaluate a flag locally: the list of
 * variations, targeting rules, and the default variation to serve when
 * no rules match.
 */
final class FlagDefinition
{
    /**
     * @param string           $id                  Unique flag identifier.
     * @param string           $key                 Human-readable flag key.
     * @param string           $name                Display name.
     * @param string           $flagType            Flag type (boolean, string, json, etc.).
     * @param string           $status              Flag status (active, inactive, archived).
     * @param string           $environment         Environment this definition belongs to.
     * @param string           $defaultVariationId  Variation ID served when no targeting rule matches.
     * @param Variation[]      $variations          Available variations.
     * @param TargetingRule[]  $targetingRules      Ordered targeting rules.
     * @param string[]         $tags                Organizational tags.
     */
    public function __construct(
        public readonly string $id,
        public readonly string $key,
        public readonly string $name,
        public readonly string $flagType,
        public readonly string $status,
        public readonly string $environment,
        public readonly string $defaultVariationId,
        public readonly array $variations = [],
        public readonly array $targetingRules = [],
        public readonly array $tags = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id'                   => $this->id,
            'key'                  => $this->key,
            'name'                 => $this->name,
            'flag_type'            => $this->flagType,
            'status'               => $this->status,
            'environment'          => $this->environment,
            'default_variation_id' => $this->defaultVariationId,
            'variations'           => array_map(
                static fn (Variation $v) => $v->toArray(),
                $this->variations,
            ),
            'targeting_rules'      => array_map(
                static fn (TargetingRule $r) => $r->toArray(),
                $this->targetingRules,
            ),
            'tags'                 => $this->tags,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): static
    {
        $variations = array_map(
            static fn (array $v) => Variation::fromArray($v),
            $data['variations'] ?? [],
        );

        $targetingRules = array_map(
            static fn (array $r) => TargetingRule::fromArray($r),
            $data['targeting_rules'] ?? [],
        );

        return new static(
            id: $data['id'],
            key: $data['key'],
            name: $data['name'] ?? $data['key'],
            flagType: $data['flag_type'] ?? 'boolean',
            status: $data['status'] ?? 'active',
            environment: $data['environment'] ?? 'development',
            defaultVariationId: $data['default_variation_id'] ?? '',
            variations: $variations,
            targetingRules: $targetingRules,
            tags: $data['tags'] ?? [],
        );
    }
}

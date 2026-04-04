<?php

declare(strict_types=1);

namespace PhaseFlag;

/**
 * Configuration for the PhaseFlagClient.
 */
final class Config
{
    public readonly string $baseUrl;

    public function __construct(
        string $baseUrl,
        public readonly string $apiKey,
        public readonly int $pollingInterval = 30,
        public readonly int $eventBatchSize = 100,
        public readonly int $eventFlushInterval = 30,
    ) {
        $this->baseUrl = rtrim($baseUrl, '/');
    }
}

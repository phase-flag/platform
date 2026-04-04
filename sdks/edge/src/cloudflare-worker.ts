/**
 * Phase Flag Edge SDK - Cloudflare Workers
 *
 * Provides a Cloudflare Workers-optimized client for feature flag evaluation.
 * Uses the Workers KV or Cache API for flag storage between requests.
 *
 * ```ts
 * import { createPhaseFlagWorker } from '@phaseflag/edge/cloudflare';
 *
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     const pf = createPhaseFlagWorker({
 *       apiUrl: env.PHASEFLAG_API_URL,
 *       apiKey: env.PHASEFLAG_API_KEY,
 *       kvNamespace: env.PHASEFLAG_KV,
 *     });
 *
 *     await pf.initialize();
 *
 *     const darkMode = pf.getBooleanValue('dark-mode', false, {
 *       userId: getUserId(request),
 *     });
 *
 *     return new Response(JSON.stringify({ darkMode }));
 *   },
 * };
 * ```
 */

import { PhaseFlagEdgeClient, type EdgeConfig, type EvaluationContext } from './index';

export interface CloudflareWorkerConfig extends EdgeConfig {
  /** Optional KV namespace for caching the ruleset between requests. */
  kvNamespace?: KVNamespace;
  /** Cache TTL in seconds when using KV (default: 60). */
  cacheTtlSeconds?: number;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const KV_CACHE_KEY = 'phaseflag:ruleset';

/**
 * Create a Phase Flag client optimized for Cloudflare Workers.
 *
 * If a KV namespace is provided, the client will cache the ruleset
 * in KV and use it as a bootstrap on subsequent requests, reducing
 * latency for the API call.
 */
export async function createPhaseFlagWorker(
  config: CloudflareWorkerConfig,
): Promise<PhaseFlagEdgeClient> {
  const { kvNamespace, cacheTtlSeconds = 60, ...edgeConfig } = config;

  // Try to load bootstrap from KV cache
  let bootstrap = edgeConfig.bootstrap;
  if (!bootstrap && kvNamespace) {
    const cached = await kvNamespace.get(KV_CACHE_KEY);
    if (cached) {
      try {
        bootstrap = JSON.parse(cached);
      } catch {
        // Ignore malformed cache
      }
    }
  }

  const client = new PhaseFlagEdgeClient({
    ...edgeConfig,
    bootstrap,
  });

  await client.initialize();

  // Store the current ruleset in KV for next request
  if (kvNamespace) {
    const flags = client.getAllFlags();
    if (flags.length > 0) {
      const cacheData = JSON.stringify({ flags });
      await kvNamespace.put(KV_CACHE_KEY, cacheData, {
        expirationTtl: cacheTtlSeconds,
      }).catch(() => {});
    }
  }

  return client;
}

export { PhaseFlagEdgeClient, type EdgeConfig, type EvaluationContext };

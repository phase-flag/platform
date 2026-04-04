/**
 * Phase Flag Edge SDK - Vercel Edge
 *
 * Provides a Vercel Edge Runtime-optimized client for feature flag evaluation.
 *
 * ```ts
 * import { createPhaseFlagEdge } from '@phaseflag/edge/vercel';
 *
 * export const config = { runtime: 'edge' };
 *
 * export default async function handler(req: Request) {
 *   const pf = await createPhaseFlagEdge({
 *     apiUrl: process.env.PHASEFLAG_API_URL!,
 *     apiKey: process.env.PHASEFLAG_API_KEY!,
 *   });
 *
 *   const enabled = pf.getBooleanValue('new-feature', false, {
 *     userId: getUserId(req),
 *   });
 *
 *   return new Response(JSON.stringify({ enabled }));
 * }
 * ```
 */

import { PhaseFlagEdgeClient, type EdgeConfig, type EvaluationContext } from './index';

/**
 * Create and initialize a Phase Flag client for Vercel Edge Runtime.
 *
 * Fetches the ruleset and returns a ready-to-use client.
 */
export async function createPhaseFlagEdge(
  config: EdgeConfig,
): Promise<PhaseFlagEdgeClient> {
  const client = new PhaseFlagEdgeClient(config);
  await client.initialize();
  return client;
}

export { PhaseFlagEdgeClient, type EdgeConfig, type EvaluationContext };

/**
 * Phase Flag Edge SDK - Deno Deploy
 *
 * Provides a Deno Deploy-optimized client for feature flag evaluation.
 *
 * ```ts
 * import { createPhaseFlagDeno } from '@phaseflag/edge/deno';
 *
 * Deno.serve(async (req: Request) => {
 *   const pf = await createPhaseFlagDeno({
 *     apiUrl: Deno.env.get('PHASEFLAG_API_URL')!,
 *     apiKey: Deno.env.get('PHASEFLAG_API_KEY')!,
 *   });
 *
 *   const enabled = pf.getBooleanValue('new-feature', false, {
 *     userId: getUserId(req),
 *   });
 *
 *   return new Response(JSON.stringify({ enabled }));
 * });
 * ```
 */

import { PhaseFlagEdgeClient, type EdgeConfig, type EvaluationContext } from './index';

/**
 * Create and initialize a Phase Flag client for Deno Deploy.
 *
 * Fetches the ruleset and returns a ready-to-use client.
 */
export async function createPhaseFlagDeno(
  config: EdgeConfig,
): Promise<PhaseFlagEdgeClient> {
  const client = new PhaseFlagEdgeClient(config);
  await client.initialize();
  return client;
}

export { PhaseFlagEdgeClient, type EdgeConfig, type EvaluationContext };

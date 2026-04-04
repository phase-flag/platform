/**
 * Phase Flag OpenFeature Provider (TypeScript)
 *
 * Implements the OpenFeature Provider interface using the Phase Flag SDK
 * for flag evaluation. Supports boolean, string, number, and object flags
 * with full targeting and percentage rollout support.
 *
 * ```ts
 * import { OpenFeature } from '@openfeature/server-sdk';
 * import { PhaseFlagProvider } from '@phaseflag/openfeature-provider';
 *
 * const provider = new PhaseFlagProvider({
 *   apiUrl: 'https://api.example.com/api/v1',
 *   apiKey: 'your-api-key',
 * });
 *
 * await OpenFeature.setProviderAndWait(provider);
 * const client = OpenFeature.getClient();
 *
 * const darkMode = await client.getBooleanValue('dark-mode', false, {
 *   targetingKey: 'user-123',
 * });
 * ```
 */

import {
  PhaseFlagClient,
  type PhaseFlagConfig,
  type EvaluationContext as PFEvaluationContext,
} from '@phaseflag/sdk-js';

// -- OpenFeature interfaces (simplified to avoid hard dependency) ---------------

interface EvaluationContext {
  targetingKey?: string;
  [key: string]: unknown;
}

interface ResolutionDetails<T> {
  value: T;
  variant?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface Provider {
  readonly metadata: { name: string };
  initialize?(context?: EvaluationContext): Promise<void>;
  onClose?(): Promise<void>;
  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>>;
  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>>;
  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>>;
  resolveObjectEvaluation<T extends object>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>>;
}

// -- Provider implementation --------------------------------------------------

/**
 * OpenFeature provider backed by the Phase Flag SDK.
 *
 * Translates OpenFeature evaluation context to Phase Flag context
 * and delegates evaluation to the local Phase Flag client.
 */
export class PhaseFlagProvider implements Provider {
  readonly metadata = { name: 'phaseflag' };

  private client: PhaseFlagClient;
  private config: PhaseFlagConfig;

  constructor(config: PhaseFlagConfig) {
    this.config = config;
    this.client = new PhaseFlagClient(config);
  }

  async initialize(_context?: EvaluationContext): Promise<void> {
    await this.client.start();
    await this.client.waitUntilReady();
  }

  async onClose(): Promise<void> {
    this.client.stop();
  }

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    const pfCtx = this.toPhaseFlagContext(context);
    const result = this.client.getVariation(flagKey, pfCtx);

    if (!result) {
      return {
        value: defaultValue,
        reason: 'DEFAULT',
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Flag "${flagKey}" not found`,
      };
    }

    const value = typeof result.value === 'boolean' ? result.value : defaultValue;
    return {
      value,
      variant: result.variationKey ?? undefined,
      reason: this.mapReason(result.reason),
    };
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    const pfCtx = this.toPhaseFlagContext(context);
    const result = this.client.getVariation(flagKey, pfCtx);

    if (!result) {
      return {
        value: defaultValue,
        reason: 'DEFAULT',
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Flag "${flagKey}" not found`,
      };
    }

    const value = typeof result.value === 'string' ? result.value : defaultValue;
    return {
      value,
      variant: result.variationKey ?? undefined,
      reason: this.mapReason(result.reason),
    };
  }

  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    const pfCtx = this.toPhaseFlagContext(context);
    const result = this.client.getVariation(flagKey, pfCtx);

    if (!result) {
      return {
        value: defaultValue,
        reason: 'DEFAULT',
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Flag "${flagKey}" not found`,
      };
    }

    const value = typeof result.value === 'number' ? result.value : defaultValue;
    return {
      value,
      variant: result.variationKey ?? undefined,
      reason: this.mapReason(result.reason),
    };
  }

  async resolveObjectEvaluation<T extends object>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    const pfCtx = this.toPhaseFlagContext(context);
    const result = this.client.getVariation(flagKey, pfCtx);

    if (!result) {
      return {
        value: defaultValue,
        reason: 'DEFAULT',
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Flag "${flagKey}" not found`,
      };
    }

    const value = (typeof result.value === 'object' && result.value !== null
      ? result.value
      : defaultValue) as T;

    return {
      value,
      variant: result.variationKey ?? undefined,
      reason: this.mapReason(result.reason),
    };
  }

  /**
   * Convert OpenFeature evaluation context to Phase Flag context.
   */
  private toPhaseFlagContext(ctx: EvaluationContext): PFEvaluationContext {
    const { targetingKey, ...rest } = ctx;
    return {
      userId: targetingKey,
      attributes: rest as Record<string, unknown>,
    };
  }

  /**
   * Map Phase Flag evaluation reasons to OpenFeature reasons.
   */
  private mapReason(reason: string): string {
    switch (reason) {
      case 'targeting_match': return 'TARGETING_MATCH';
      case 'percentage_rollout': return 'SPLIT';
      case 'default': return 'DEFAULT';
      case 'override': return 'STATIC';
      default: return 'UNKNOWN';
    }
  }
}

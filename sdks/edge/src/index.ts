/**
 * Phase Flag Edge SDK - Core
 *
 * Lightweight evaluation-only client for edge runtimes.
 * Designed for Cloudflare Workers, Vercel Edge, and Deno Deploy.
 *
 * Unlike the full JS SDK, the edge client:
 * - Does NOT start background polling (edge functions are short-lived)
 * - Fetches the ruleset once per request (or uses a provided bootstrap)
 * - Evaluates flags locally using the same DJB2 hashing algorithm
 * - Supports flag mocking for testing
 */

// -- Types --------------------------------------------------------------------

export interface EdgeConfig {
  /** Base URL of the Phase Flag API */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Pre-loaded flag data to avoid network fetch */
  bootstrap?: BootstrapData;
}

export interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  attributes?: Record<string, unknown>;
}

export interface Variation {
  id: string;
  key: string;
  name: string;
  value: unknown;
  description?: string;
}

export interface TargetingCondition {
  attribute: string;
  operator: string;
  value: unknown;
}

export interface PercentageRolloutEntry {
  variation_id: string;
  weight: number;
}

export interface PercentageRollout {
  variations: PercentageRolloutEntry[];
}

export interface TargetingRule {
  priority: number;
  conditions: TargetingCondition[];
  variation_id?: string;
  percentage_rollout?: PercentageRollout;
  segment_id?: string;
}

export interface FlagDefinition {
  id: string;
  key: string;
  name: string;
  flagType: string;
  status: string;
  environment: string;
  defaultVariationId: string;
  variations: Variation[];
  targetingRules: TargetingRule[];
  tags: string[];
}

export interface EvaluationResult {
  flagKey: string;
  variationId: string | null;
  variationKey: string | null;
  value: unknown;
  reason: string;
}

export interface BootstrapData {
  flags: Array<Record<string, unknown>>;
}

// -- DJB2 hashing -------------------------------------------------------------

export function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalisedHash(flagKey: string, userId: string): number {
  return djb2Hash(`${flagKey}:${userId}`) % 100;
}

// -- Evaluation engine --------------------------------------------------------

function getContextValue(ctx: EvaluationContext, key: string): unknown | undefined {
  if (key === 'user_id' || key === 'userId') return ctx.userId;
  if (key === 'session_id' || key === 'sessionId') return ctx.sessionId;
  return ctx.attributes?.[key];
}

function coerceNumeric(value: unknown): number | null {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function matchCondition(cond: TargetingCondition, ctx: EvaluationContext): boolean {
  const actual = getContextValue(ctx, cond.attribute);
  const op = cond.operator;
  const target = cond.value;

  if (actual === undefined || actual === null) {
    return op === 'is_not' || op === 'not_contains' || op === 'not_one_of';
  }

  const actualStr = String(actual);
  const targetStr = String(target);

  switch (op) {
    case 'is': return actualStr === targetStr;
    case 'is_not': return actualStr !== targetStr;
    case 'contains': return actualStr.includes(targetStr);
    case 'not_contains': return !actualStr.includes(targetStr);
    case 'one_of': {
      const values = Array.isArray(target) ? target.map(String) : [targetStr];
      return values.includes(actualStr);
    }
    case 'not_one_of': {
      const values = Array.isArray(target) ? target.map(String) : [targetStr];
      return !values.includes(actualStr);
    }
    case 'gt': {
      const a = coerceNumeric(actual);
      const b = coerceNumeric(target);
      return a !== null && b !== null && a > b;
    }
    case 'lt': {
      const a = coerceNumeric(actual);
      const b = coerceNumeric(target);
      return a !== null && b !== null && a < b;
    }
    case 'matches_regex': {
      try { return new RegExp(targetStr).test(actualStr); } catch { return false; }
    }
    default: return false;
  }
}

function resolvePercentageRollout(
  rollout: PercentageRollout, flagKey: string, ctx: EvaluationContext
): string | null {
  const userId = ctx.userId || ctx.sessionId || '';
  if (!userId) return null;
  const bucket = normalisedHash(flagKey, userId);
  let cumulative = 0;
  for (const entry of rollout.variations) {
    cumulative += entry.weight;
    if (bucket < cumulative) return entry.variation_id;
  }
  return null;
}

export function evaluateFlag(flag: FlagDefinition, ctx: EvaluationContext): EvaluationResult {
  const variationsById = new Map(flag.variations.map((v) => [v.id, v]));

  const makeResult = (variationId: string, reason: string): EvaluationResult => {
    const v = variationsById.get(variationId);
    return {
      flagKey: flag.key,
      variationId,
      variationKey: v?.key ?? null,
      value: v?.value ?? null,
      reason,
    };
  };

  const rules = [...flag.targetingRules].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    if (!rule.conditions.every((c) => matchCondition(c, ctx))) continue;
    if (rule.variation_id) return makeResult(rule.variation_id, 'targeting_match');
    if (rule.percentage_rollout) {
      const vid = resolvePercentageRollout(rule.percentage_rollout, flag.key, ctx);
      if (vid) return makeResult(vid, 'percentage_rollout');
    }
  }

  return makeResult(flag.defaultVariationId, 'default');
}

// -- Flag parsing -------------------------------------------------------------

function parseFlag(raw: Record<string, unknown>): FlagDefinition {
  const rawVariations = (raw.variations as Record<string, unknown>[]) ?? [];
  const rawRules = (raw.targeting_rules as Record<string, unknown>[]) ?? [];

  return {
    id: raw.id as string,
    key: raw.key as string,
    name: (raw.name as string) ?? (raw.key as string),
    flagType: (raw.flag_type as string) ?? 'boolean',
    status: (raw.status as string) ?? 'active',
    environment: (raw.environment as string) ?? 'development',
    defaultVariationId: (raw.default_variation_id as string) ?? '',
    variations: rawVariations.map((v) => ({
      id: v.id as string,
      key: v.key as string,
      name: (v.name as string) ?? (v.key as string),
      value: v.value,
      description: v.description as string | undefined,
    })),
    targetingRules: rawRules.map((r) => ({
      priority: (r.priority as number) ?? 0,
      conditions: ((r.conditions as Record<string, unknown>[]) ?? []).map((c) => ({
        attribute: (c.attribute as string) ?? '',
        operator: (c.operator as string) ?? '',
        value: c.value,
      })),
      variation_id: r.variation_id as string | undefined,
      percentage_rollout: r.percentage_rollout as PercentageRollout | undefined,
      segment_id: r.segment_id as string | undefined,
    })),
    tags: (raw.tags as string[]) ?? [],
  };
}

// -- Edge Client --------------------------------------------------------------

/**
 * Lightweight edge client for Phase Flag.
 *
 * Designed for short-lived edge function executions. Fetches the ruleset
 * once and evaluates flags locally.
 */
export class PhaseFlagEdgeClient {
  private config: EdgeConfig;
  private flags = new Map<string, FlagDefinition>();
  private overrides = new Map<string, unknown>();

  constructor(config: EdgeConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/$/, ''),
    };

    if (config.bootstrap) {
      for (const raw of config.bootstrap.flags ?? []) {
        const flag = parseFlag(raw);
        this.flags.set(flag.key, flag);
      }
    }
  }

  /** Fetch the ruleset from the API. Call once per request. */
  async initialize(): Promise<void> {
    try {
      const res = await fetch(`${this.config.apiUrl}/sdk/ruleset`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      for (const raw of data.flags ?? []) {
        const flag = parseFlag(raw);
        this.flags.set(flag.key, flag);
      }
    } catch {
      // Use bootstrap/cached data if available
    }
  }

  /** Set a flag override for testing. */
  setOverride(flagKey: string, value: unknown): void {
    this.overrides.set(flagKey, value);
  }

  /** Remove all overrides. */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  /** Evaluate a boolean flag. */
  getBooleanValue(flagKey: string, defaultValue: boolean, ctx?: EvaluationContext): boolean {
    if (this.overrides.has(flagKey)) {
      const v = this.overrides.get(flagKey);
      return typeof v === 'boolean' ? v : defaultValue;
    }
    const result = this.resolve(flagKey, ctx);
    if (result === null || typeof result.value !== 'boolean') return defaultValue;
    return result.value;
  }

  /** Evaluate a string flag. */
  getStringValue(flagKey: string, defaultValue: string, ctx?: EvaluationContext): string {
    if (this.overrides.has(flagKey)) {
      const v = this.overrides.get(flagKey);
      return typeof v === 'string' ? v : defaultValue;
    }
    const result = this.resolve(flagKey, ctx);
    if (result === null || typeof result.value !== 'string') return defaultValue;
    return result.value;
  }

  /** Evaluate a JSON flag. */
  getJsonValue<T = unknown>(flagKey: string, defaultValue: T, ctx?: EvaluationContext): T {
    if (this.overrides.has(flagKey)) {
      return this.overrides.get(flagKey) as T;
    }
    const result = this.resolve(flagKey, ctx);
    if (result === null) return defaultValue;
    return result.value as T;
  }

  /** Get the full evaluation result. */
  getVariation(flagKey: string, ctx?: EvaluationContext): EvaluationResult | null {
    if (this.overrides.has(flagKey)) {
      return {
        flagKey,
        variationId: null,
        variationKey: null,
        value: this.overrides.get(flagKey),
        reason: 'override',
      };
    }
    return this.resolve(flagKey, ctx);
  }

  /** Get all loaded flags. */
  getAllFlags(): FlagDefinition[] {
    return Array.from(this.flags.values());
  }

  private resolve(flagKey: string, ctx?: EvaluationContext): EvaluationResult | null {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;
    return evaluateFlag(flag, ctx ?? {});
  }
}

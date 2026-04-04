/**
 * Phase Flag JavaScript/TypeScript SDK
 *
 * Provides client-side feature flag evaluation with local caching,
 * periodic polling, bootstrap loading, offline mode, and flag mocking.
 */

// -- Types --------------------------------------------------------------------

export interface PhaseFlagConfig {
  /** Base URL of the Phase Flag API (e.g. "https://api.example.com/api/v1") */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** User context for targeting evaluation */
  context?: EvaluationContext;
  /** Bootstrap data: pre-loaded flags to use before the first fetch completes */
  bootstrap?: BootstrapData;
  /** URL to fetch bootstrap data from (e.g. "/api/v1/sdk/bootstrap") */
  bootstrapUrl?: string;
  /** When true, the client will use cached/bootstrapped data when the API is unreachable */
  offlineMode?: boolean;
  /** Event flush interval in milliseconds (default: 30000) */
  eventFlushInterval?: number;
  /** Maximum events to buffer before auto-flushing (default: 100) */
  eventBatchSize?: number;
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

export interface EvaluationEvent {
  flagKey: string;
  variationKey?: string;
  userId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface BootstrapData {
  flags: Array<Record<string, unknown>>;
}

type FlagChangeListener = (flags: Map<string, FlagDefinition>) => void;

// -- DJB2 hashing (mirrors server-side implementation) ------------------------

function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalisedHash(flagKey: string, userId: string): number {
  return djb2Hash(`${flagKey}:${userId}`) % 100;
}

// -- Local evaluation engine --------------------------------------------------

function getContextValue(
  ctx: EvaluationContext,
  key: string,
): unknown | undefined {
  if (key === "user_id" || key === "userId") return ctx.userId;
  if (key === "session_id" || key === "sessionId") return ctx.sessionId;
  return ctx.attributes?.[key];
}

function coerceNumeric(value: unknown): number | null {
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function matchCondition(
  cond: TargetingCondition,
  ctx: EvaluationContext,
): boolean {
  const actual = getContextValue(ctx, cond.attribute);
  const op = cond.operator;
  const target = cond.value;

  if (actual === undefined || actual === null) {
    return op === "is_not" || op === "not_contains" || op === "not_one_of";
  }

  const actualStr = String(actual);
  const targetStr = String(target);

  switch (op) {
    case "is":
      return actualStr === targetStr;
    case "is_not":
      return actualStr !== targetStr;
    case "contains":
      return actualStr.includes(targetStr);
    case "not_contains":
      return !actualStr.includes(targetStr);
    case "one_of": {
      const values = Array.isArray(target)
        ? target.map(String)
        : [targetStr];
      return values.includes(actualStr);
    }
    case "not_one_of": {
      const values = Array.isArray(target)
        ? target.map(String)
        : [targetStr];
      return !values.includes(actualStr);
    }
    case "gt": {
      const a = coerceNumeric(actual);
      const b = coerceNumeric(target);
      return a !== null && b !== null && a > b;
    }
    case "lt": {
      const a = coerceNumeric(actual);
      const b = coerceNumeric(target);
      return a !== null && b !== null && a < b;
    }
    case "matches_regex": {
      try {
        if (targetStr.length > 500) return false;
        // Truncate input to prevent excessive backtracking on long strings
        return new RegExp(targetStr).test(actualStr.slice(0, 10_000));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function resolvePercentageRollout(
  rollout: PercentageRollout,
  flagKey: string,
  ctx: EvaluationContext,
): string | null {
  const userId = ctx.userId || ctx.sessionId || "";
  if (!userId) return null;

  const bucket = normalisedHash(flagKey, userId);
  let cumulative = 0;
  for (const entry of rollout.variations) {
    cumulative += entry.weight;
    if (bucket < cumulative) {
      return entry.variation_id;
    }
  }
  return null;
}

function evaluateFlag(
  flag: FlagDefinition,
  ctx: EvaluationContext,
): EvaluationResult {
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

  const rules = [...flag.targetingRules].sort(
    (a, b) => a.priority - b.priority,
  );

  for (const rule of rules) {
    const allMatch = rule.conditions.every((c) => matchCondition(c, ctx));
    if (!allMatch) continue;

    if (rule.variation_id) {
      return makeResult(rule.variation_id, "targeting_match");
    }

    if (rule.percentage_rollout) {
      const vid = resolvePercentageRollout(
        rule.percentage_rollout,
        flag.key,
        ctx,
      );
      if (vid) {
        return makeResult(vid, "percentage_rollout");
      }
    }
  }

  return makeResult(flag.defaultVariationId, "default");
}

// -- Parsing helpers ----------------------------------------------------------

function parseFlag(raw: Record<string, unknown>): FlagDefinition {
  const rawVariations = (raw.variations as Record<string, unknown>[]) ?? [];
  const rawRules =
    (raw.targeting_rules as Record<string, unknown>[]) ?? [];

  return {
    id: raw.id as string,
    key: raw.key as string,
    name: (raw.name as string) ?? (raw.key as string),
    flagType: (raw.flag_type as string) ?? "boolean",
    status: (raw.status as string) ?? "active",
    environment: (raw.environment as string) ?? "development",
    defaultVariationId: (raw.default_variation_id as string) ?? "",
    variations: rawVariations.map((v) => ({
      id: v.id as string,
      key: v.key as string,
      name: (v.name as string) ?? (v.key as string),
      value: v.value,
      description: v.description as string | undefined,
    })),
    targetingRules: rawRules.map((r) => ({
      priority: (r.priority as number) ?? 0,
      conditions: ((r.conditions as Record<string, unknown>[]) ?? []).map(
        (c) => ({
          attribute: (c.attribute as string) ?? "",
          operator: (c.operator as string) ?? "",
          value: c.value,
        }),
      ),
      variation_id: r.variation_id as string | undefined,
      percentage_rollout: r.percentage_rollout as PercentageRollout | undefined,
      segment_id: r.segment_id as string | undefined,
    })),
    tags: (raw.tags as string[]) ?? [],
  };
}

// -- Client -------------------------------------------------------------------

export class PhaseFlagClient {
  private config: {
    apiUrl: string;
    apiKey: string;
    pollingInterval: number;
    context?: EvaluationContext;
    offlineMode: boolean;
    eventFlushInterval: number;
    eventBatchSize: number;
  };
  private flags = new Map<string, FlagDefinition>();
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: FlagChangeListener[] = [];
  private ready = false;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private starting = false;
  private stopped = false;

  /** Flag overrides set via setOverride() for testing */
  private overrides = new Map<string, unknown>();

  /** Event queue for batched submission */
  private eventQueue: EvaluationEvent[] = [];

  /** Bootstrap data provided at construction or fetched from URL */
  private bootstrapData: BootstrapData | null;
  private bootstrapUrl: string | null;

  constructor(config: PhaseFlagConfig) {
    this.config = {
      apiUrl: config.apiUrl.replace(/\/$/, ""),
      apiKey: config.apiKey,
      pollingInterval: config.pollingInterval ?? 30_000,
      context: config.context,
      offlineMode: config.offlineMode ?? false,
      eventFlushInterval: config.eventFlushInterval ?? 30_000,
      eventBatchSize: config.eventBatchSize ?? 100,
    };
    this.bootstrapData = config.bootstrap ?? null;
    this.bootstrapUrl = config.bootstrapUrl ?? null;
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /** Fetch the ruleset and start polling. */
  async start(): Promise<void> {
    if (this.starting || (this.ready && this.pollingTimer)) return;
    this.starting = true;
    this.stopped = false;

    if (this.ready) {
      this.ready = false;
      this.readyPromise = new Promise((resolve) => {
        this.resolveReady = resolve;
      });
    }

    try {
      // Load bootstrap data first if available
      if (this.bootstrapData) {
        this.applyBootstrap(this.bootstrapData);
      } else if (this.bootstrapUrl) {
        await this.fetchBootstrap();
      }

      await this.fetchRuleset();
      if (this.stopped) return;
      this.ready = true;
      this.resolveReady();
      this.pollingTimer = setInterval(
        () => this.fetchRuleset(),
        this.config.pollingInterval,
      );
      this.flushTimer = setInterval(
        () => this.flushEvents(),
        this.config.eventFlushInterval,
      );
    } catch {
      // If offline mode is enabled and we have bootstrap data, become ready anyway
      if (this.config.offlineMode && this.flags.size > 0) {
        this.ready = true;
        this.resolveReady();
        // Still start polling so we pick up the API when it becomes available
        this.pollingTimer = setInterval(
          () => this.fetchRuleset(),
          this.config.pollingInterval,
        );
        this.flushTimer = setInterval(
          () => this.flushEvents(),
          this.config.eventFlushInterval,
        );
      } else if (this.config.offlineMode) {
        // Offline mode with no bootstrap: become ready with empty flags
        this.ready = true;
        this.resolveReady();
        this.pollingTimer = setInterval(
          () => this.fetchRuleset(),
          this.config.pollingInterval,
        );
        this.flushTimer = setInterval(
          () => this.flushEvents(),
          this.config.eventFlushInterval,
        );
      } else {
        throw new Error("Failed to fetch initial ruleset and offline mode is disabled");
      }
    } finally {
      this.starting = false;
    }
  }

  /** Stop polling and flush remaining events. */
  stop(): void {
    this.stopped = true;
    this.starting = false;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Best-effort final flush
    this.flushEvents().catch(() => {});
  }

  /** Wait until the first ruleset fetch completes. */
  waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Update the evaluation context (e.g. when a user logs in). */
  setContext(context: EvaluationContext): void {
    this.config.context = context;
  }

  // -- Flag mocking (test support) ------------------------------------------

  /**
   * Set a flag override for testing. When an override is set, the client
   * returns the override value instead of evaluating the flag normally.
   * No server connection is required.
   */
  setOverride(flagKey: string, value: unknown): void {
    this.overrides.set(flagKey, value);
  }

  /** Remove a single flag override. */
  clearOverride(flagKey: string): void {
    this.overrides.delete(flagKey);
  }

  /** Remove all flag overrides. */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  // -- Local evaluation -----------------------------------------------------

  /**
   * Evaluate a boolean flag. Returns `defaultValue` if the flag is
   * not found or not a boolean type.
   */
  getBooleanValue(
    flagKey: string,
    defaultValue: boolean,
    context?: EvaluationContext,
  ): boolean {
    if (this.overrides.has(flagKey)) {
      const v = this.overrides.get(flagKey);
      return typeof v === "boolean" ? v : defaultValue;
    }
    const result = this.resolveLocal(flagKey, context);
    if (result === null || typeof result.value !== "boolean") return defaultValue;
    this.autoTrack(result);
    return result.value;
  }

  /**
   * Evaluate a string flag. Returns `defaultValue` if the flag is
   * not found or not a string type.
   */
  getStringValue(
    flagKey: string,
    defaultValue: string,
    context?: EvaluationContext,
  ): string {
    if (this.overrides.has(flagKey)) {
      const v = this.overrides.get(flagKey);
      return typeof v === "string" ? v : defaultValue;
    }
    const result = this.resolveLocal(flagKey, context);
    if (result === null || typeof result.value !== "string") return defaultValue;
    this.autoTrack(result);
    return result.value;
  }

  /**
   * Evaluate a JSON flag. Returns `defaultValue` if the flag is not found.
   */
  getJsonValue<T = unknown>(
    flagKey: string,
    defaultValue: T,
    context?: EvaluationContext,
  ): T {
    if (this.overrides.has(flagKey)) {
      return this.overrides.get(flagKey) as T;
    }
    const result = this.resolveLocal(flagKey, context);
    if (result === null) return defaultValue;
    this.autoTrack(result);
    return result.value as T;
  }

  /** Get the full evaluation result for a flag, or null. */
  getVariation(
    flagKey: string,
    context?: EvaluationContext,
  ): EvaluationResult | null {
    if (this.overrides.has(flagKey)) {
      return {
        flagKey,
        variationId: null,
        variationKey: null,
        value: this.overrides.get(flagKey),
        reason: "override",
      };
    }
    return this.resolveLocal(flagKey, context);
  }

  /** Get all currently loaded flag definitions. */
  getAllFlags(): FlagDefinition[] {
    return Array.from(this.flags.values());
  }

  /** Register a listener that fires when flags change after a poll. */
  onFlagsChanged(listener: FlagChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // -- Remote evaluation ----------------------------------------------------

  /**
   * Evaluate a flag server-side via the /evaluate endpoint.
   * Useful when targeting rules require server-side context.
   */
  async evaluateRemote(
    flagKey: string,
    context?: EvaluationContext,
  ): Promise<EvaluationResult> {
    const ctx = context ?? this.config.context ?? {};
    const res = await this.apiFetch("/evaluate", {
      method: "POST",
      body: JSON.stringify({ flag_key: flagKey, context: ctx }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? `Evaluation failed: ${res.status}`);
    return {
      flagKey: data.flag_key,
      variationId: data.variation_id,
      variationKey: data.variation_key,
      value: data.value,
      reason: data.reason,
    };
  }

  // -- Event tracking -------------------------------------------------------

  /** Queue an evaluation event for batched submission. */
  trackEvent(event: EvaluationEvent): void {
    this.eventQueue.push({
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    });
    if (this.eventQueue.length >= this.config.eventBatchSize) {
      this.flushEvents().catch(() => {});
    }
  }

  /** Send all queued events to the server immediately. */
  async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    const batch = [...this.eventQueue];
    this.eventQueue = [];

    const payload = {
      events: batch.map((e) => ({
        flag_key: e.flagKey,
        variation_key: e.variationKey,
        user_id: e.userId,
        timestamp: e.timestamp,
        metadata: e.metadata ?? {},
      })),
    };

    try {
      await this.apiFetch("/sdk/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      // Re-enqueue on failure so events are not lost
      this.eventQueue = [...batch, ...this.eventQueue];
    }
  }

  // -- Internal -------------------------------------------------------------

  private autoTrack(result: EvaluationResult): void {
    this.trackEvent({
      flagKey: result.flagKey,
      variationKey: result.variationKey ?? undefined,
      userId: this.config.context?.userId,
    });
  }

  private resolveLocal(
    flagKey: string,
    context?: EvaluationContext,
  ): EvaluationResult | null {
    const flag = this.flags.get(flagKey);
    if (!flag) return null;
    const ctx = context ?? this.config.context ?? {};
    return evaluateFlag(flag, ctx);
  }

  private applyBootstrap(data: BootstrapData): void {
    const newFlags = new Map<string, FlagDefinition>();
    for (const raw of data.flags ?? []) {
      const flag = parseFlag(raw);
      newFlags.set(flag.key, flag);
    }
    this.flags = newFlags;
    this.notifyListeners();
  }

  private async fetchBootstrap(): Promise<void> {
    if (!this.bootstrapUrl) return;
    try {
      const res = await globalThis.fetch(this.bootstrapUrl);
      if (!res.ok) return;
      const data = (await res.json()) as BootstrapData;
      this.applyBootstrap(data);
    } catch {
      // bootstrap fetch failure is not fatal
    }
  }

  private async fetchRuleset(): Promise<void> {
    try {
      const res = await this.apiFetch("/sdk/ruleset");
      if (!res.ok) return;
      const data = await res.json();
      const newFlags = new Map<string, FlagDefinition>();
      for (const raw of data.flags ?? []) {
        const flag = parseFlag(raw);
        newFlags.set(flag.key, flag);
      }
      this.flags = newFlags;
      this.notifyListeners();
    } catch {
      // Network errors are swallowed; stale/bootstrapped flags are
      // preferred over no flags (offline mode).
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.flags);
      } catch {
        // listener errors should not break polling
      }
    }
  }

  private apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(`${this.config.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.config.apiKey,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  }
}

// -- Convenience factory ------------------------------------------------------

/**
 * Create and start a Phase Flag client.
 *
 * ```ts
 * const pf = await createClient({
 *   apiUrl: "https://your-api.example.com/api/v1",
 *   apiKey: "your-api-key",
 * });
 *
 * if (pf.getBooleanValue("dark-mode", false)) {
 *   enableDarkMode();
 * }
 * ```
 */
export async function createClient(
  config: PhaseFlagConfig,
): Promise<PhaseFlagClient> {
  const client = new PhaseFlagClient(config);
  await client.start();
  return client;
}

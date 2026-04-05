/**
 * Phase Flag API client for the VS Code extension.
 * Fetches flag data from the Phase Flag API and caches it with a configurable TTL.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlagVariation {
  key: string;
  name: string;
  value: boolean | string | number;
  description?: string;
}

export interface FlagRule {
  id: string;
  description?: string;
  percentage?: number;
}

export interface Flag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  type: "boolean" | "string" | "number" | "json";
  variations: FlagVariation[];
  rules: FlagRule[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  evaluationCount?: number;
}

export interface FlagListResponse {
  items: Flag[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiClientOptions {
  apiUrl: string;
  apiKey: string;
  cacheTtlMs: number;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class Cache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key?: string): void {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export class PhaseFlagApiClient {
  private readonly flagsCache = new Cache<Flag[]>();
  private readonly flagCache = new Cache<Flag>();
  private options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
  }

  /**
   * Update client options (e.g. when VS Code configuration changes).
   */
  updateOptions(options: ApiClientOptions): void {
    this.options = options;
    this.flagsCache.invalidate();
    this.flagCache.invalidate();
  }

  /**
   * Fetch all flags from the API, using the cache when available.
   */
  async getAllFlags(): Promise<Flag[]> {
    const cacheKey = `${this.options.apiUrl}:all`;
    const cached = this.flagsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.request<FlagListResponse>("/api/v1/flags?page_size=500");
    const flags = response.items ?? [];
    this.flagsCache.set(cacheKey, flags, this.options.cacheTtlMs);
    return flags;
  }

  /**
   * Fetch a single flag by key, using the cache when available.
   */
  async getFlag(flagKey: string): Promise<Flag | undefined> {
    const cacheKey = `${this.options.apiUrl}:${flagKey}`;
    const cached = this.flagCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const flag = await this.request<Flag>(`/api/v1/flags/${encodeURIComponent(flagKey)}`);
      this.flagCache.set(cacheKey, flag, this.options.cacheTtlMs);
      return flag;
    } catch (err) {
      // Flag not found — return undefined rather than throwing
      const error = err as Error & { statusCode?: number };
      if (error.statusCode === 404) {
        return undefined;
      }
      throw err;
    }
  }

  /**
   * Build a map of flag key → Flag for O(1) lookups.
   */
  async getFlagsMap(): Promise<Map<string, Flag>> {
    const flags = await this.getAllFlags();
    const map = new Map<string, Flag>();
    for (const flag of flags) {
      map.set(flag.key, flag);
    }
    return map;
  }

  /**
   * Invalidate all caches, forcing fresh data on the next request.
   */
  invalidateCache(): void {
    this.flagsCache.invalidate();
    this.flagCache.invalidate();
  }

  /**
   * Returns true if the client appears to be configured (non-empty API key).
   */
  isConfigured(): boolean {
    return Boolean(this.options.apiKey && this.options.apiUrl);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async request<T>(path: string): Promise<T> {
    const url = `${this.options.apiUrl.replace(/\/$/, "")}${path}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "phaseflag-vscode/0.1.0",
      },
    });

    if (!response.ok) {
      const error = new Error(
        `Phase Flag API error: ${response.status} ${response.statusText} — ${url}`
      ) as Error & { statusCode: number };
      error.statusCode = response.status;
      throw error;
    }

    return response.json() as Promise<T>;
  }
}

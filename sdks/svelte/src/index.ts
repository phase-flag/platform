/**
 * Phase Flag Svelte SDK
 *
 * Provides Svelte-compatible stores for client-side feature flag evaluation.
 * Built on top of @phaseflag/sdk-js. Uses the Svelte store contract
 * (subscribe method) so values can be accessed with the $ prefix.
 *
 * ```svelte
 * <script>
 *   import { createPhaseFlagClient, PHASEFLAG_CONTEXT_KEY } from '@phaseflag/svelte';
 *   import { setContext } from 'svelte';
 *
 *   const pf = createPhaseFlagClient({
 *     apiUrl: 'https://api.example.com/api/v1',
 *     apiKey: 'your-api-key',
 *   });
 *
 *   setContext(PHASEFLAG_CONTEXT_KEY, pf);
 *
 *   const darkMode = pf.featureFlag('dark-mode', false);
 *   const loading = pf.loading;
 * </script>
 *
 * {#if $loading}
 *   <p>Loading flags...</p>
 * {:else if $darkMode}
 *   <DarkUI />
 * {:else}
 *   <LightUI />
 * {/if}
 * ```
 */

import {
  PhaseFlagClient,
  type EvaluationContext,
  type FlagDefinition,
  type PhaseFlagConfig,
  type Variation,
  type EvaluationResult,
} from '@phaseflag/sdk-js';

// Re-export types from the JS SDK
export type { EvaluationContext, FlagDefinition, PhaseFlagConfig, Variation, EvaluationResult };

// -- Svelte Store Contract ----------------------------------------------------

/** Svelte store contract -- any object with a subscribe method. */
export interface Readable<T> {
  subscribe(run: (value: T) => void): () => void;
}

/** Create a simple readable store that follows Svelte's store contract. */
function createReadable<T>(initialValue: T): {
  subscribe: (run: (value: T) => void) => () => void;
  set: (value: T) => void;
  get: () => T;
} {
  let value = initialValue;
  const subscribers = new Set<(value: T) => void>();

  return {
    subscribe(run: (value: T) => void) {
      subscribers.add(run);
      run(value); // Emit current value on subscribe
      return () => {
        subscribers.delete(run);
      };
    },
    set(newValue: T) {
      value = newValue;
      for (const sub of subscribers) {
        try {
          sub(value);
        } catch {
          // subscriber errors should not break emission
        }
      }
    },
    get() {
      return value;
    },
  };
}

// -- PhaseFlag Store ----------------------------------------------------------

export interface PhaseFlagStore {
  /** The underlying PhaseFlag client for advanced operations. */
  client: PhaseFlagClient;

  /** Readable store of all flags as a Map. Use `$flags` in Svelte components. */
  flags: Readable<Map<string, FlagDefinition>>;

  /** Readable store of loading state. Use `$loading` in Svelte components. */
  loading: Readable<boolean>;

  /** Readable store of error state. Use `$error` in Svelte components. */
  error: Readable<string | null>;

  /**
   * Create a derived store for a specific flag's value (the `featureFlag` readable store).
   *
   * ```svelte
   * <script>
   *   const darkMode = pf.featureFlag('dark-mode', false);
   * </script>
   * {#if $darkMode}...{/if}
   * ```
   */
  featureFlag: <T>(flagKey: string, defaultValue: T) => Readable<T>;

  /**
   * Create a derived store for a specific flag's full details.
   */
  flag: (flagKey: string) => Readable<{
    value: unknown;
    variation: Variation | undefined;
    flag: FlagDefinition | undefined;
    loading: boolean;
  }>;

  /** Stop the client and clean up all subscriptions. */
  destroy: () => void;
}

/**
 * Create a PhaseFlag store instance.
 *
 * This is the primary entry point for the Svelte SDK. It creates a client,
 * starts polling, and returns reactive stores for use in Svelte components.
 *
 * ```svelte
 * <script>
 *   import { createPhaseFlagClient } from '@phaseflag/svelte';
 *   import { onDestroy } from 'svelte';
 *
 *   const pf = createPhaseFlagClient({
 *     apiUrl: 'https://api.example.com/api/v1',
 *     apiKey: 'your-api-key',
 *   });
 *
 *   onDestroy(() => pf.destroy());
 *
 *   const darkMode = pf.featureFlag('dark-mode', false);
 *   const allFlags = pf.flags;
 * </script>
 *
 * {#if $darkMode}
 *   <DarkTheme />
 * {/if}
 * ```
 */
export function createPhaseFlagClient(config: PhaseFlagConfig): PhaseFlagStore {
  const client = new PhaseFlagClient(config);

  const flagsStore = createReadable<Map<string, FlagDefinition>>(new Map());
  const loadingStore = createReadable<boolean>(true);
  const errorStore = createReadable<string | null>(null);

  // Track internal subscriptions for cleanup
  const internalUnsubscribes: Array<() => void> = [];

  const unsubscribe = client.onFlagsChanged((newFlags) => {
    flagsStore.set(new Map(newFlags));
  });

  client
    .start()
    .then(() => {
      flagsStore.set(new Map(client.getAllFlags().map((f) => [f.key, f])));
      loadingStore.set(false);
    })
    .catch((err) => {
      errorStore.set(
        err instanceof Error ? err.message : 'Failed to connect to Phase Flag',
      );
      loadingStore.set(false);
    });

  function featureFlag<T>(flagKey: string, defaultValue: T): Readable<T> {
    const derived = createReadable<T>(defaultValue);

    const unsub = flagsStore.subscribe((_flags) => {
      const result = client.getVariation(flagKey);
      if (!result || result.value === null || result.value === undefined) {
        derived.set(defaultValue);
        return;
      }
      derived.set(result.value as T);
    });
    internalUnsubscribes.push(unsub);

    return derived;
  }

  function flag(flagKey: string): Readable<{
    value: unknown;
    variation: Variation | undefined;
    flag: FlagDefinition | undefined;
    loading: boolean;
  }> {
    const derived = createReadable<{
      value: unknown;
      variation: Variation | undefined;
      flag: FlagDefinition | undefined;
      loading: boolean;
    }>({ value: undefined, variation: undefined, flag: undefined, loading: true });

    let currentLoading = true;
    const unsubLoading = loadingStore.subscribe((l) => {
      currentLoading = l;
    });
    internalUnsubscribes.push(unsubLoading);

    const unsubFlags = flagsStore.subscribe((flags) => {
      const f = flags.get(flagKey);
      if (!f) {
        derived.set({
          value: undefined,
          variation: undefined,
          flag: undefined,
          loading: currentLoading,
        });
        return;
      }
      const result = client.getVariation(flagKey);
      const variation = result
        ? f.variations.find((v) => v.id === result.variationId) ?? f.variations[0]
        : undefined;
      derived.set({
        value: result?.value,
        variation,
        flag: f,
        loading: false,
      });
    });
    internalUnsubscribes.push(unsubFlags);

    return derived;
  }

  function destroy() {
    for (const unsub of internalUnsubscribes) {
      unsub();
    }
    internalUnsubscribes.length = 0;
    unsubscribe();
    client.stop();
  }

  return {
    client,
    flags: flagsStore,
    loading: loadingStore,
    error: errorStore,
    featureFlag,
    flag,
    destroy,
  };
}

// -- Context helpers for Svelte component trees -------------------------------

/**
 * Svelte context key for PhaseFlag store.
 * Use with `setContext` and `getContext` to share the store across components.
 *
 * ```svelte
 * <!-- App.svelte -->
 * <script>
 *   import { setContext } from 'svelte';
 *   import { createPhaseFlagClient, PHASEFLAG_CONTEXT_KEY } from '@phaseflag/svelte';
 *
 *   const pf = createPhaseFlagClient({ apiUrl: '...', apiKey: '...' });
 *   setContext(PHASEFLAG_CONTEXT_KEY, pf);
 * </script>
 *
 * <!-- ChildComponent.svelte -->
 * <script>
 *   import { getContext } from 'svelte';
 *   import { PHASEFLAG_CONTEXT_KEY } from '@phaseflag/svelte';
 *
 *   const pf = getContext(PHASEFLAG_CONTEXT_KEY);
 *   const darkMode = pf.featureFlag('dark-mode', false);
 * </script>
 * ```
 */
export const PHASEFLAG_CONTEXT_KEY = Symbol('phaseflag');

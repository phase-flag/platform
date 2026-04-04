/**
 * Phase Flag Solid.js SDK
 *
 * Provides Solid.js primitives (signals, context, provider) for client-side
 * feature flag evaluation. Built on top of @phaseflag/sdk-js.
 *
 * ```tsx
 * import { PhaseFlagProvider, useFeatureFlag, createFeatureFlag } from '@phaseflag/solid';
 *
 * function App() {
 *   return (
 *     <PhaseFlagProvider
 *       apiUrl="https://api.example.com/api/v1"
 *       apiKey="your-api-key"
 *     >
 *       <MyComponent />
 *     </PhaseFlagProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const darkMode = createFeatureFlag('dark-mode', false);
 *   const flag = useFeatureFlag('experiment-a');
 *
 *   return (
 *     <Show when={!flag().loading}>
 *       {darkMode() ? <DarkUI /> : <LightUI />}
 *     </Show>
 *   );
 * }
 * ```
 */

import {
  createContext,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  useContext,
  type JSX,
  type Accessor,
} from 'solid-js';
import {
  PhaseFlagClient,
  type EvaluationContext,
  type FlagDefinition,
  type PhaseFlagConfig,
  type Variation,
} from '@phaseflag/sdk-js';

// Re-export types from the JS SDK
export type { EvaluationContext, FlagDefinition, PhaseFlagConfig, Variation };

// -- Context ------------------------------------------------------------------

interface PhaseFlagContextValue {
  client: Accessor<PhaseFlagClient | null>;
  flags: Accessor<Map<string, FlagDefinition>>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
}

const PhaseFlagContext = createContext<PhaseFlagContextValue>();

// -- Provider -----------------------------------------------------------------

export interface PhaseFlagProviderProps {
  /** PhaseFlag API base URL */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** Initial evaluation context */
  context?: EvaluationContext;
  /** Enable offline mode */
  offlineMode?: boolean;
  /** Child components */
  children: JSX.Element;
}

/**
 * Provider component that initializes the PhaseFlag client and
 * provides flag state to all descendant components via Solid context.
 *
 * Place this at the root of your application.
 */
export function PhaseFlagProvider(props: PhaseFlagProviderProps): JSX.Element {
  const [flags, setFlags] = createSignal<Map<string, FlagDefinition>>(new Map());
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [client, setClient] = createSignal<PhaseFlagClient | null>(null);
  let disposed = false;

  const pf = new PhaseFlagClient({
    apiUrl: props.apiUrl,
    apiKey: props.apiKey,
    pollingInterval: props.pollingInterval,
    context: props.context,
    offlineMode: props.offlineMode,
  });

  setClient(pf);

  const unsubscribe = pf.onFlagsChanged((newFlags) => {
    if (!disposed) setFlags(new Map(newFlags));
  });

  pf.start()
    .then(() => {
      if (!disposed) {
        setFlags(new Map(pf.getAllFlags().map((f) => [f.key, f])));
        setLoading(false);
      }
    })
    .catch((err) => {
      if (!disposed) {
        setError(err instanceof Error ? err.message : 'Failed to connect to Phase Flag');
        setLoading(false);
      }
    });

  onCleanup(() => {
    disposed = true;
    unsubscribe();
    pf.stop();
  });

  const value: PhaseFlagContextValue = {
    client,
    flags,
    loading,
    error,
  };

  return (
    <PhaseFlagContext.Provider value={value}>
      {props.children}
    </PhaseFlagContext.Provider>
  );
}

// -- Hooks --------------------------------------------------------------------

function usePhaseFlagContext(): PhaseFlagContextValue {
  const ctx = useContext(PhaseFlagContext);
  if (!ctx) {
    throw new Error(
      'usePhaseFlag must be used within a <PhaseFlagProvider>',
    );
  }
  return ctx;
}

/**
 * Get the PhaseFlag client instance directly.
 *
 * Use this for advanced operations like `evaluateRemote()` or `trackEvent()`.
 *
 * ```tsx
 * const client = usePhaseFlagClient();
 * const result = await client()!.evaluateRemote('my-flag', { userId: '123' });
 * ```
 */
export function usePhaseFlagClient(): Accessor<PhaseFlagClient | null> {
  const { client } = usePhaseFlagContext();
  return client;
}

/**
 * Evaluate a flag and get detailed reactive information.
 *
 * Returns an accessor that provides value, variation, loading state, and flag definition.
 *
 * ```tsx
 * const flag = useFeatureFlag('my-flag');
 * // Access: flag().value, flag().variation, flag().loading
 * ```
 */
export function useFeatureFlag(flagKey: string): Accessor<{
  value: unknown;
  variation: Variation | undefined;
  loading: boolean;
  flag: FlagDefinition | undefined;
}> {
  const { client, flags, loading } = usePhaseFlagContext();

  return createMemo(() => {
    const c = client();
    const flag = flags().get(flagKey);
    if (!flag || !c) {
      return { value: undefined, variation: undefined, loading: loading(), flag: undefined };
    }
    const result = c.getVariation(flagKey);
    if (!result) {
      return { value: undefined, variation: undefined, loading: false, flag };
    }
    const variation =
      flag.variations.find((v) => v.id === result.variationId) ?? flag.variations[0];
    return {
      value: result.value,
      variation,
      loading: false,
      flag,
    };
  });
}

/**
 * Create a reactive feature flag signal with a default fallback.
 *
 * Returns a reactive accessor that updates when the flag changes.
 *
 * ```tsx
 * const darkMode = createFeatureFlag('dark-mode', false);
 * const theme = createFeatureFlag('theme', 'light');
 * // Access: darkMode(), theme()
 * ```
 */
export function createFeatureFlag<T = unknown>(flagKey: string, defaultValue: T): Accessor<T> {
  const { client, flags } = usePhaseFlagContext();

  return createMemo(() => {
    const c = client();
    const flag = flags().get(flagKey);
    if (!c || !flag) return defaultValue;
    const result = c.getVariation(flagKey);
    if (!result || result.value === null || result.value === undefined) return defaultValue;
    return result.value as T;
  });
}

/**
 * Get a boolean flag value.
 */
export function useBooleanFlag(flagKey: string, defaultValue: boolean): Accessor<boolean> {
  const { client, flags } = usePhaseFlagContext();

  return createMemo(() => {
    const c = client();
    if (!c) return defaultValue;
    flags(); // trigger reactivity
    return c.getBooleanValue(flagKey, defaultValue);
  });
}

/**
 * Get a string flag value.
 */
export function useStringFlag(flagKey: string, defaultValue: string): Accessor<string> {
  const { client, flags } = usePhaseFlagContext();

  return createMemo(() => {
    const c = client();
    if (!c) return defaultValue;
    flags();
    return c.getStringValue(flagKey, defaultValue);
  });
}

/**
 * Get a JSON flag value.
 */
export function useJsonFlag<T>(flagKey: string, defaultValue: T): Accessor<T> {
  const { client, flags } = usePhaseFlagContext();

  return createMemo(() => {
    const c = client();
    if (!c) return defaultValue;
    flags();
    return c.getJsonValue(flagKey, defaultValue);
  });
}

/**
 * Get all loaded flags as reactive state.
 */
export function useFlags(): {
  flags: Accessor<FlagDefinition[]>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
} {
  const ctx = usePhaseFlagContext();

  const flagList = createMemo(() => Array.from(ctx.flags().values()));

  return {
    flags: flagList,
    loading: ctx.loading,
    error: ctx.error,
  };
}

/**
 * Register a callback for flag changes.
 *
 * The callback fires whenever any flag value changes (after a poll).
 * Automatically cleaned up when the component is unmounted.
 *
 * ```tsx
 * useFlagChangeListener((flags) => {
 *   console.log('Flags changed:', flags);
 * });
 * ```
 */
export function useFlagChangeListener(
  callback: (flags: FlagDefinition[]) => void,
): void {
  const { flags } = usePhaseFlagContext();

  createEffect(() => {
    const currentFlags = flags();
    if (currentFlags.size > 0) {
      callback(Array.from(currentFlags.values()));
    }
  });
}

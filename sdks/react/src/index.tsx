/**
 * Phase Flag React SDK
 *
 * Provides React hooks, a provider component, and conditional rendering
 * utilities for client-side feature flag evaluation. Built on top of
 * @phaseflag/sdk-js.
 *
 * ```tsx
 * import { PhaseFlagProvider, useFeatureFlag, useBooleanFlag } from '@phaseflag/react';
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
 *   const darkMode = useBooleanFlag('dark-mode', false);
 *   const { value, variation, loading } = useFeatureFlag('experiment-a');
 *
 *   return darkMode ? <DarkUI /> : <LightUI />;
 * }
 * ```
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  PhaseFlagClient,
  type BootstrapData,
  type EvaluationContext,
  type EvaluationResult,
  type FlagDefinition,
  type PhaseFlagConfig,
  type Variation,
} from '@phaseflag/sdk-js';

// Re-export types from the JS SDK
export type { EvaluationContext, FlagDefinition, PhaseFlagConfig, Variation, BootstrapData };

// -- Context ------------------------------------------------------------------

interface PhaseFlagContextValue {
  client: PhaseFlagClient | null;
  flags: Map<string, FlagDefinition>;
  loading: boolean;
  error: string | null;
}

const PhaseFlagContext = createContext<PhaseFlagContextValue>({
  client: null,
  flags: new Map(),
  loading: true,
  error: null,
});

// -- Provider -----------------------------------------------------------------

export interface PhaseFlagProviderProps {
  /** Phase Flag API base URL */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** Initial evaluation context */
  context?: EvaluationContext;
  /** Bootstrap data for instant startup */
  bootstrap?: BootstrapData;
  /** URL to fetch bootstrap data from */
  bootstrapUrl?: string;
  /** Enable offline mode (use cached/bootstrapped data when API is unreachable) */
  offlineMode?: boolean;
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component that initializes the Phase Flag client and provides
 * flag state to all descendant components via React context.
 *
 * Place this at the root of your application (or the subtree that needs flags).
 */
export function PhaseFlagProvider({
  apiUrl,
  apiKey,
  pollingInterval,
  context,
  bootstrap,
  bootstrapUrl,
  offlineMode,
  children,
}: PhaseFlagProviderProps) {
  const [flags, setFlags] = useState<Map<string, FlagDefinition>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<PhaseFlagClient | null>(null);
  const [clientVersion, setClientVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const client = new PhaseFlagClient({
      apiUrl,
      apiKey,
      pollingInterval,
      context,
      bootstrap,
      bootstrapUrl,
      offlineMode,
    });

    clientRef.current = client;
    setClientVersion((v) => v + 1);

    const unsubscribe = client.onFlagsChanged((newFlags) => {
      if (!cancelled) setFlags(new Map(newFlags));
    });

    client
      .start()
      .then(() => {
        if (!cancelled) {
          setFlags(new Map(client.getAllFlags().map((f) => [f.key, f])));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to connect to Phase Flag');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
      client.stop();
      clientRef.current = null;
    };
  }, [apiUrl, apiKey, pollingInterval, context, bootstrap, bootstrapUrl, offlineMode]);

  const value = useMemo(
    () => ({
      client: clientRef.current,
      flags,
      loading,
      error,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flags, loading, error, clientVersion],
  );

  return <PhaseFlagContext.Provider value={value}>{children}</PhaseFlagContext.Provider>;
}

// -- Hooks --------------------------------------------------------------------

/**
 * Get the PhaseFlagClient instance directly.
 *
 * Use this for advanced operations like `evaluateRemote()`, `trackEvent()`,
 * `setOverride()`, or `flushEvents()`.
 */
export function usePhaseFlagClient(): PhaseFlagClient {
  const { client } = useContext(PhaseFlagContext);
  if (!client) {
    throw new Error('usePhaseFlagClient must be used within a <PhaseFlagProvider>');
  }
  return client;
}

/**
 * Evaluate a flag and get detailed information.
 *
 * Returns the current value, variation details, and loading state.
 *
 * ```tsx
 * const { value, variation, loading } = useFeatureFlag('my-flag');
 * ```
 */
export function useFeatureFlag(flagKey: string): {
  value: unknown;
  variation: Variation | undefined;
  loading: boolean;
  flag: FlagDefinition | undefined;
} {
  const { client, flags, loading } = useContext(PhaseFlagContext);
  const flag = flags.get(flagKey);

  const resolved = useMemo(() => {
    if (!client || !flag) return { value: undefined, variation: undefined };
    const result = client.getVariation(flagKey);
    if (!result) return { value: undefined, variation: undefined };
    const variation = flag.variations.find((v) => v.id === result.variationId) ?? flag.variations[0];
    return { value: result.value, variation };
  }, [client, flag, flagKey]);

  return {
    value: resolved.value,
    variation: resolved.variation,
    loading,
    flag,
  };
}

/**
 * Get a typed flag value with a default fallback.
 *
 * ```tsx
 * const value = useFlagValue('feature-x', 'default-variant');
 * ```
 */
export function useFlagValue<T = unknown>(flagKey: string, defaultValue: T): T {
  const { client, flags } = useContext(PhaseFlagContext);
  const flag = flags.get(flagKey);

  return useMemo(() => {
    if (!client || !flag) return defaultValue;
    const result = client.getVariation(flagKey);
    if (!result || result.value === null || result.value === undefined) return defaultValue;
    return result.value as T;
  }, [client, flag, flagKey, defaultValue]);
}

/**
 * Get a boolean flag value.
 *
 * ```tsx
 * const darkMode = useBooleanFlag('dark-mode', false);
 * ```
 */
export function useBooleanFlag(flagKey: string, defaultValue: boolean): boolean {
  const { client, flags } = useContext(PhaseFlagContext);
  const flag = flags.get(flagKey);

  return useMemo(() => {
    if (!client) return defaultValue;
    return client.getBooleanValue(flagKey, defaultValue);
  }, [client, flag, flagKey, defaultValue]);
}

/**
 * Get a string flag value.
 */
export function useStringFlag(flagKey: string, defaultValue: string): string {
  const { client, flags } = useContext(PhaseFlagContext);
  const flag = flags.get(flagKey);

  return useMemo(() => {
    if (!client) return defaultValue;
    return client.getStringValue(flagKey, defaultValue);
  }, [client, flag, flagKey, defaultValue]);
}

/**
 * Get a JSON flag value.
 */
export function useJsonFlag<T>(flagKey: string, defaultValue: T): T {
  const { client, flags } = useContext(PhaseFlagContext);
  const flag = flags.get(flagKey);

  return useMemo(() => {
    if (!client) return defaultValue;
    return client.getJsonValue(flagKey, defaultValue);
  }, [client, flag, flagKey, defaultValue]);
}

/**
 * Get all loaded flags.
 */
export function useFlags(): {
  flags: FlagDefinition[];
  loading: boolean;
  error: string | null;
} {
  const { flags, loading, error } = useContext(PhaseFlagContext);
  const flagList = useMemo(() => Array.from(flags.values()), [flags]);
  return { flags: flagList, loading, error };
}

/**
 * Register a callback for flag changes.
 *
 * The callback fires whenever any flag value changes (after a poll).
 */
export function useFlagChangeListener(
  callback: (flags: FlagDefinition[]) => void,
): void {
  const { flags } = useContext(PhaseFlagContext);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const prevFlagsRef = useRef<Map<string, FlagDefinition>>(new Map());

  useEffect(() => {
    if (flags !== prevFlagsRef.current && flags.size > 0) {
      prevFlagsRef.current = flags;
      callbackRef.current(Array.from(flags.values()));
    }
  }, [flags]);
}

// -- Components ---------------------------------------------------------------

export interface IfFeatureEnabledProps {
  /** The flag key to evaluate */
  flagKey: string;
  /** Content to render when the flag is enabled (truthy) */
  children: ReactNode;
  /** Optional content to render when the flag is disabled (falsy) */
  fallback?: ReactNode;
}

/**
 * Conditionally render content based on a boolean feature flag.
 *
 * ```tsx
 * <IfFeatureEnabled flagKey="new-checkout">
 *   <NewCheckout />
 * </IfFeatureEnabled>
 *
 * <IfFeatureEnabled flagKey="new-header" fallback={<OldHeader />}>
 *   <NewHeader />
 * </IfFeatureEnabled>
 * ```
 */
export function IfFeatureEnabled({
  flagKey,
  children,
  fallback,
}: IfFeatureEnabledProps): ReactNode {
  const enabled = useBooleanFlag(flagKey, false);
  return enabled ? children : (fallback ?? null);
}

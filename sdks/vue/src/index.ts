/**
 * Phase Flag Vue SDK
 *
 * Provides Vue 3 composables and a plugin for client-side
 * feature flag evaluation. Built on top of @phaseflag/sdk-js.
 *
 * ```ts
 * // main.ts
 * import { createApp } from 'vue';
 * import { PhaseFlagPlugin } from '@phaseflag/vue';
 * import App from './App.vue';
 *
 * const app = createApp(App);
 * app.use(PhaseFlagPlugin, {
 *   apiUrl: 'https://api.example.com/api/v1',
 *   apiKey: 'your-api-key',
 * });
 * app.mount('#app');
 *
 * // In any component:
 * import { useFeatureFlag, useFlagValue } from '@phaseflag/vue';
 *
 * const darkMode = useFlagValue('dark-mode', false);
 * const { value, variation, loading } = useFeatureFlag('experiment-a');
 * ```
 */

import {
  getCurrentInstance,
  inject,
  ref,
  shallowRef,
  computed,
  onUnmounted,
  watch,
  readonly,
  type Ref,
  type ShallowRef,
  type DeepReadonly,
  type Plugin,
  type InjectionKey,
  type ObjectDirective,
} from 'vue';
import {
  PhaseFlagClient,
  type EvaluationContext,
  type FlagDefinition,
  type PhaseFlagConfig,
  type Variation,
} from '@phaseflag/sdk-js';

// Re-export types from the JS SDK
export type { EvaluationContext, FlagDefinition, PhaseFlagConfig, Variation };

// -- Injection Key ------------------------------------------------------------

interface PhaseFlagState {
  client: ShallowRef<PhaseFlagClient | null>;
  flags: Ref<Map<string, FlagDefinition>>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
}

const PHASEFLAG_KEY: InjectionKey<PhaseFlagState> = Symbol('phaseflag');

// -- Plugin -------------------------------------------------------------------

export interface PhaseFlagPluginOptions extends PhaseFlagConfig {}

/**
 * Vue plugin that initializes the PhaseFlag client and provides
 * flag state to all components via dependency injection.
 *
 * Also registers the `v-feature-flag` directive.
 *
 * ```ts
 * app.use(PhaseFlagPlugin, {
 *   apiUrl: 'https://api.example.com/api/v1',
 *   apiKey: 'your-api-key',
 *   pollingInterval: 15000,
 * });
 * ```
 */
export const PhaseFlagPlugin: Plugin<[PhaseFlagPluginOptions]> = {
  install(app, options) {
    const client = shallowRef<PhaseFlagClient | null>(null);
    const flags = ref<Map<string, FlagDefinition>>(new Map());
    const loading = ref(true);
    const error = ref<string | null>(null);

    const pf = new PhaseFlagClient(options);
    client.value = pf;

    const unsubscribe = pf.onFlagsChanged((newFlags) => {
      flags.value = new Map(newFlags);
    });

    pf.start()
      .then(() => {
        flags.value = new Map(pf.getAllFlags().map((f) => [f.key, f]));
        loading.value = false;
      })
      .catch((err) => {
        error.value = err instanceof Error ? err.message : 'Failed to connect to Phase Flag';
        loading.value = false;
      });

    app.provide(PHASEFLAG_KEY, { client, flags, loading, error });

    // Register v-feature-flag directive
    const featureFlagDirective: ObjectDirective<HTMLElement, string> = {
      mounted(el, binding) {
        const flagKey = binding.value;
        if (!pf) return;
        const enabled = pf.getBooleanValue(flagKey, false);
        if (!enabled) {
          el.style.display = 'none';
        }
      },
      updated(el, binding) {
        const flagKey = binding.value;
        if (!pf) return;
        const enabled = pf.getBooleanValue(flagKey, false);
        el.style.display = enabled ? '' : 'none';
      },
    };
    app.directive('feature-flag', featureFlagDirective);

    // Cleanup on app unmount
    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      unsubscribe();
      pf.stop();
      originalUnmount();
    };
  },
};

// -- Composables --------------------------------------------------------------

function usePhaseFlagState(): PhaseFlagState {
  const state = inject(PHASEFLAG_KEY);
  if (!state) {
    throw new Error(
      'PhaseFlag not initialized. Did you forget to call app.use(PhaseFlagPlugin, options)?',
    );
  }
  return state;
}

/**
 * Get the PhaseFlag client instance directly.
 *
 * Use this for advanced operations like `evaluateRemote()` or `trackEvent()`.
 *
 * ```ts
 * const client = usePhaseFlagClient();
 * const result = await client.evaluateRemote('my-flag', { userId: '123' });
 * ```
 */
export function usePhaseFlagClient(): PhaseFlagClient {
  const { client } = usePhaseFlagState();
  if (!client.value) {
    throw new Error('PhaseFlag client not available');
  }
  return client.value;
}

/**
 * Evaluate a flag and get detailed reactive information.
 *
 * Returns reactive refs for value, variation, loading state, and flag definition.
 *
 * ```ts
 * const { value, variation, loading, flag } = useFeatureFlag('my-flag');
 * ```
 */
export function useFeatureFlag(flagKey: string): {
  value: Ref<unknown>;
  variation: Ref<Variation | undefined>;
  loading: DeepReadonly<Ref<boolean>>;
  flag: Ref<FlagDefinition | undefined>;
} {
  const { client, flags, loading } = usePhaseFlagState();

  const flag = computed(() => flags.value.get(flagKey));

  const resolved = computed(() => {
    const f = flag.value;
    const c = client.value;
    if (!f || !c) return { value: undefined, variation: undefined };
    const result = c.getVariation(flagKey);
    if (!result) return { value: undefined, variation: undefined };
    const variation = f.variations.find((v) => v.id === result.variationId) ?? f.variations[0];
    return { value: result.value, variation };
  });

  const value = computed(() => resolved.value.value);
  const variation = computed(() => resolved.value.variation);

  return {
    value,
    variation,
    loading: readonly(loading),
    flag,
  };
}

/**
 * Get a typed flag value with a default fallback.
 *
 * Returns a reactive ref that updates when the flag changes.
 *
 * ```ts
 * const darkMode = useFlagValue('dark-mode', false);
 * const theme = useFlagValue('theme', 'light');
 * ```
 */
export function useFlagValue<T = unknown>(flagKey: string, defaultValue: T): Ref<T> {
  const { client, flags } = usePhaseFlagState();

  return computed(() => {
    const c = client.value;
    const flag = flags.value.get(flagKey);
    if (!c || !flag) return defaultValue;
    const result = c.getVariation(flagKey);
    if (!result || result.value === null || result.value === undefined) return defaultValue;
    return result.value as T;
  });
}

/**
 * Get a boolean flag value.
 */
export function useBooleanFlag(flagKey: string, defaultValue: boolean): Ref<boolean> {
  const { client, flags } = usePhaseFlagState();

  return computed(() => {
    const c = client.value;
    if (!c) return defaultValue;
    // Access flags to trigger reactivity
    flags.value.get(flagKey);
    return c.getBooleanValue(flagKey, defaultValue);
  });
}

/**
 * Get a string flag value.
 */
export function useStringFlag(flagKey: string, defaultValue: string): Ref<string> {
  const { client, flags } = usePhaseFlagState();

  return computed(() => {
    const c = client.value;
    if (!c) return defaultValue;
    flags.value.get(flagKey);
    return c.getStringValue(flagKey, defaultValue);
  });
}

/**
 * Get a JSON flag value.
 */
export function useJsonFlag<T>(flagKey: string, defaultValue: T): Ref<T> {
  const { client, flags } = usePhaseFlagState();

  return computed(() => {
    const c = client.value;
    if (!c) return defaultValue;
    flags.value.get(flagKey);
    return c.getJsonValue(flagKey, defaultValue);
  });
}

/**
 * Get all loaded flags as reactive state.
 */
export function useFlags(): {
  flags: Ref<FlagDefinition[]>;
  loading: DeepReadonly<Ref<boolean>>;
  error: DeepReadonly<Ref<string | null>>;
} {
  const state = usePhaseFlagState();

  const flagList = computed(() => Array.from(state.flags.value.values()));

  return {
    flags: flagList,
    loading: readonly(state.loading),
    error: readonly(state.error),
  };
}

/**
 * Register a callback for flag changes.
 *
 * Automatically cleaned up when the component is unmounted.
 *
 * ```ts
 * useFlagChangeListener((flags) => {
 *   console.log('Flags changed:', flags);
 * });
 * ```
 */
export function useFlagChangeListener(
  callback: (flags: FlagDefinition[]) => void,
): void {
  const { flags } = usePhaseFlagState();

  const stopWatch = watch(
    () => flags.value,
    (newFlags) => {
      if (newFlags.size > 0) {
        callback(Array.from(newFlags.values()));
      }
    },
    { deep: false },
  );

  onUnmounted(stopWatch);
}

// -- Provide/Inject helpers ---------------------------------------------------

/**
 * Manually create and provide PhaseFlag state for advanced use cases.
 *
 * ```ts
 * // In a parent component's setup()
 * const { client, flags, loading, error } = createPhaseFlag({
 *   apiUrl: 'https://api.example.com/api/v1',
 *   apiKey: 'your-api-key',
 * });
 * ```
 */
export function createPhaseFlag(config: PhaseFlagConfig): {
  client: PhaseFlagClient;
  flags: Ref<Map<string, FlagDefinition>>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  stop: () => void;
} {
  const flags = ref<Map<string, FlagDefinition>>(new Map());
  const loading = ref(true);
  const error = ref<string | null>(null);

  const pf = new PhaseFlagClient(config);

  const unsubscribe = pf.onFlagsChanged((newFlags) => {
    flags.value = new Map(newFlags);
  });

  pf.start()
    .then(() => {
      flags.value = new Map(pf.getAllFlags().map((f) => [f.key, f]));
      loading.value = false;
    })
    .catch((err) => {
      error.value = err instanceof Error ? err.message : 'Failed to connect to Phase Flag';
      loading.value = false;
    });

  const stop = () => {
    unsubscribe();
    pf.stop();
  };

  // Auto-cleanup when called inside a component's setup()
  if (getCurrentInstance()) {
    onUnmounted(stop);
  }

  return { client: pf, flags, loading, error, stop };
}

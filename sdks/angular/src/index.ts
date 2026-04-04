/**
 * Phase Flag Angular SDK
 *
 * Provides an Angular service and utilities for client-side
 * feature flag evaluation. Built on top of @phaseflag/sdk-js.
 *
 * ```typescript
 * // app.config.ts
 * import { providePhaseFlag } from '@phaseflag/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePhaseFlag({
 *       apiUrl: 'https://api.example.com/api/v1',
 *       apiKey: 'your-api-key',
 *     }),
 *   ],
 * };
 *
 * // In any component:
 * import { PhaseFlagService } from '@phaseflag/angular';
 *
 * @Component({ ... })
 * export class MyComponent {
 *   private pf = inject(PhaseFlagService);
 *   darkMode$ = this.pf.flagValue$('dark-mode', false);
 * }
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

// -- Configuration Token ------------------------------------------------------

/**
 * Injection token for PhaseFlag configuration.
 * Used internally by the service to initialize the client.
 */
export const PHASEFLAG_CONFIG = Symbol('PHASEFLAG_CONFIG');

// -- Provider Function --------------------------------------------------------

/**
 * Provide PhaseFlag configuration for dependency injection.
 *
 * ```typescript
 * // app.config.ts (Angular 16+ standalone)
 * import { providePhaseFlag } from '@phaseflag/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePhaseFlag({
 *       apiUrl: 'https://api.example.com/api/v1',
 *       apiKey: 'your-api-key',
 *       pollingInterval: 15000,
 *     }),
 *   ],
 * };
 * ```
 */
export function providePhaseFlag(config: PhaseFlagConfig) {
  return [
    { provide: PHASEFLAG_CONFIG, useValue: config },
    { provide: PhaseFlagService, useFactory: () => new PhaseFlagService(config) },
  ];
}

// -- Observable ---------------------------------------------------------------

type Subscriber<T> = (value: T) => void;

/**
 * Simple Observable implementation for framework-agnostic use.
 * Compatible with RxJS pipe/subscribe pattern.
 */
export class FlagObservable<T> {
  private subscribers: Subscriber<T>[] = [];
  private currentValue: T;

  constructor(initialValue: T) {
    this.currentValue = initialValue;
  }

  /** Get the current value synchronously. */
  getValue(): T {
    return this.currentValue;
  }

  /** Subscribe to value changes. Returns an unsubscribe function. */
  subscribe(callback: Subscriber<T>): { unsubscribe: () => void } {
    this.subscribers.push(callback);
    // Emit current value immediately
    callback(this.currentValue);
    return {
      unsubscribe: () => {
        this.subscribers = this.subscribers.filter((s) => s !== callback);
      },
    };
  }

  /** @internal Update the value and notify subscribers. */
  _next(value: T): void {
    this.currentValue = value;
    for (const sub of this.subscribers) {
      try {
        sub(value);
      } catch {
        // subscriber errors should not break emission
      }
    }
  }
}

// -- Service ------------------------------------------------------------------

/**
 * PhaseFlagService
 *
 * Core injectable service for feature flag evaluation. Manages the PhaseFlag
 * client lifecycle and provides reactive observables for flag values.
 *
 * ```typescript
 * @Component({
 *   template: `
 *     <div *ngIf="loading$ | async">Loading flags...</div>
 *     <div *ngIf="darkMode$ | async">Dark mode is enabled!</div>
 *   `
 * })
 * export class MyComponent {
 *   private pf = inject(PhaseFlagService);
 *   loading$ = this.pf.loading$;
 *   darkMode$ = this.pf.flagValue$('dark-mode', false);
 * }
 * ```
 */
export class PhaseFlagService {
  private client: PhaseFlagClient;
  private flagsSubject = new FlagObservable<Map<string, FlagDefinition>>(new Map());
  private loadingSubject = new FlagObservable<boolean>(true);
  private errorSubject = new FlagObservable<string | null>(null);
  private unsubscribeFn: (() => void) | null = null;
  private derivedSubscriptions: Array<{ unsubscribe: () => void }> = [];

  /** Observable of all flags as a Map. */
  readonly flags$ = this.flagsSubject;

  /** Observable of loading state. */
  readonly loading$ = this.loadingSubject;

  /** Observable of error state. */
  readonly error$ = this.errorSubject;

  constructor(config: PhaseFlagConfig) {
    this.client = new PhaseFlagClient(config);

    this.unsubscribeFn = this.client.onFlagsChanged((newFlags) => {
      this.flagsSubject._next(new Map(newFlags));
    });

    this.client
      .start()
      .then(() => {
        this.flagsSubject._next(
          new Map(this.client.getAllFlags().map((f) => [f.key, f])),
        );
        this.loadingSubject._next(false);
      })
      .catch((err) => {
        this.errorSubject._next(
          err instanceof Error ? err.message : 'Failed to connect to Phase Flag',
        );
        this.loadingSubject._next(false);
      });
  }

  /**
   * Get the underlying PhaseFlag client for advanced operations.
   */
  getClient(): PhaseFlagClient {
    return this.client;
  }

  /**
   * Get a reactive observable for a flag's value with a default fallback.
   *
   * ```typescript
   * darkMode$ = this.pf.flagValue$('dark-mode', false);
   * theme$ = this.pf.flagValue$('theme', 'light');
   * ```
   */
  flagValue$<T>(flagKey: string, defaultValue: T): FlagObservable<T> {
    const observable = new FlagObservable<T>(defaultValue);

    const sub = this.flagsSubject.subscribe((flags) => {
      const flag = flags.get(flagKey);
      if (!flag) {
        observable._next(defaultValue);
        return;
      }
      const result = this.client.getVariation(flagKey);
      if (!result || result.value === null || result.value === undefined) {
        observable._next(defaultValue);
        return;
      }
      observable._next(result.value as T);
    });
    this.derivedSubscriptions.push(sub);

    return observable;
  }

  /**
   * Get a reactive observable for a flag's full evaluation details.
   */
  flag$(flagKey: string): FlagObservable<{
    value: unknown;
    variation: Variation | undefined;
    flag: FlagDefinition | undefined;
  }> {
    const observable = new FlagObservable<{
      value: unknown;
      variation: Variation | undefined;
      flag: FlagDefinition | undefined;
    }>({ value: undefined, variation: undefined, flag: undefined });

    const sub = this.flagsSubject.subscribe((flags) => {
      const flag = flags.get(flagKey);
      if (!flag) {
        observable._next({ value: undefined, variation: undefined, flag: undefined });
        return;
      }
      const result = this.client.getVariation(flagKey);
      const variation = result
        ? flag.variations.find((v) => v.id === result.variationId) ?? flag.variations[0]
        : undefined;
      observable._next({ value: result?.value, variation, flag });
    });
    this.derivedSubscriptions.push(sub);

    return observable;
  }

  /**
   * Get a boolean flag value synchronously.
   */
  getBooleanValue(flagKey: string, defaultValue: boolean): boolean {
    return this.client.getBooleanValue(flagKey, defaultValue);
  }

  /**
   * Get a string flag value synchronously.
   */
  getStringValue(flagKey: string, defaultValue: string): string {
    return this.client.getStringValue(flagKey, defaultValue);
  }

  /**
   * Get a JSON flag value synchronously.
   */
  getJsonValue<T>(flagKey: string, defaultValue: T): T {
    return this.client.getJsonValue(flagKey, defaultValue);
  }

  /**
   * Evaluate a flag remotely (server-side targeting).
   */
  async evaluateRemote(flagKey: string, context?: EvaluationContext): Promise<EvaluationResult> {
    return this.client.evaluateRemote(flagKey, context);
  }

  /**
   * Track an evaluation event.
   */
  trackEvent(event: {
    flagKey: string;
    variationKey?: string;
    userId?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.client.trackEvent(event);
  }

  /**
   * Get all loaded flag definitions.
   */
  getAllFlags(): FlagDefinition[] {
    return this.client.getAllFlags();
  }

  /**
   * Update the evaluation context.
   */
  setContext(context: EvaluationContext): void {
    this.client.setContext(context);
  }

  /**
   * Set a flag override for testing.
   */
  setOverride(flagKey: string, value: unknown): void {
    this.client.setOverride(flagKey, value);
  }

  /**
   * Remove a flag override.
   */
  clearOverride(flagKey: string): void {
    this.client.clearOverride(flagKey);
  }

  /**
   * Remove all flag overrides.
   */
  clearAllOverrides(): void {
    this.client.clearAllOverrides();
  }

  /**
   * Clean up the service. Call this when the application is destroyed.
   *
   * In Angular, wire this to your root component's `ngOnDestroy`:
   * ```typescript
   * @Component({ ... })
   * export class AppComponent implements OnDestroy {
   *   private pf = inject(PhaseFlagService);
   *   ngOnDestroy() { this.pf.destroy(); }
   * }
   * ```
   */
  destroy(): void {
    for (const sub of this.derivedSubscriptions) {
      sub.unsubscribe();
    }
    this.derivedSubscriptions = [];

    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.client.stop();
  }
}

// -- Structural Directive (for template use) ----------------------------------

/**
 * PhaseFlagModule provides the `*pfFeatureFlag` structural directive concept.
 *
 * Since this SDK is framework-agnostic TypeScript (not compiled as an Angular
 * module), the directive is exposed as a helper class that can be integrated
 * into Angular's DI system:
 *
 * ```typescript
 * // In your Angular component:
 * @Component({
 *   template: `
 *     <ng-container *ngIf="darkMode$ | async">
 *       <dark-theme />
 *     </ng-container>
 *   `
 * })
 * export class MyComponent {
 *   private pf = inject(PhaseFlagService);
 *   darkMode$ = this.pf.flagValue$('dark-mode', false);
 * }
 * ```
 */
export class PhaseFlagModule {
  /**
   * Create a module-like configuration for PhaseFlag.
   * Use `providePhaseFlag()` for standalone Angular 16+ apps.
   */
  static forRoot(config: PhaseFlagConfig) {
    return {
      providers: providePhaseFlag(config),
    };
  }
}

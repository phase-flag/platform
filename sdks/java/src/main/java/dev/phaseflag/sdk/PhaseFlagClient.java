package dev.phaseflag.sdk;

import dev.phaseflag.sdk.models.EvaluationContext;
import dev.phaseflag.sdk.models.EvaluationEvent;
import dev.phaseflag.sdk.models.EvaluationResult;
import dev.phaseflag.sdk.models.FlagDefinition;
import dev.phaseflag.sdk.models.PercentageRollout;
import dev.phaseflag.sdk.models.TargetingCondition;
import dev.phaseflag.sdk.models.TargetingRule;
import dev.phaseflag.sdk.models.Variation;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * PhaseFlag Java SDK client.
 *
 * <p>Provides feature flag evaluation with local caching, background polling,
 * event batching, and server-side evaluation fallback.
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * PhaseFlagConfig config = PhaseFlagConfig.builder()
 *     .baseUrl("https://api.example.com/api/v1")
 *     .apiKey("your-api-key")
 *     .build();
 *
 * PhaseFlagClient client = new PhaseFlagClient(config);
 * client.start();
 * client.waitUntilReady(Duration.ofSeconds(5));
 *
 * boolean darkMode = client.getBooleanValue("dark-mode", false,
 *         EvaluationContext.builder().userId("user-123").build());
 *
 * client.stop();
 * }</pre>
 */
public final class PhaseFlagClient {

    private static final Logger logger = Logger.getLogger(PhaseFlagClient.class.getName());

    private final PhaseFlagConfig config;
    private final HttpClient httpClient;

    // Flag store (protected by read-write lock)
    private final ReentrantReadWriteLock flagsLock = new ReentrantReadWriteLock();
    private Map<String, FlagDefinition> flags = new HashMap<>();

    // Readiness
    private final CountDownLatch readyLatch = new CountDownLatch(1);
    private volatile boolean ready = false;

    // Change listeners (thread-safe via CopyOnWriteArrayList)
    private final CopyOnWriteArrayList<Consumer<List<FlagDefinition>>> listeners =
            new CopyOnWriteArrayList<>();

    // Event queue (protected by its own lock)
    private final Object eventLock = new Object();
    private List<EvaluationEvent> eventQueue = new ArrayList<>();

    // Background scheduler
    private ScheduledExecutorService scheduler;

    /**
     * Create a new PhaseFlag client with the given configuration.
     *
     * @param config the client configuration
     */
    public PhaseFlagClient(PhaseFlagConfig config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    /**
     * Fetch the initial ruleset and start background polling and event flushing.
     *
     * <p>This method performs the first ruleset fetch synchronously. After that,
     * a {@link ScheduledExecutorService} handles periodic polling and event flushing
     * in the background.
     */
    public void start() {
        // Initial fetch (synchronous)
        fetchRuleset();

        // Start background scheduler with daemon threads
        scheduler = Executors.newScheduledThreadPool(2, r -> {
            Thread t = new Thread(r, "phaseflag-bg");
            t.setDaemon(true);
            return t;
        });

        long pollingMs = config.getPollingInterval().toMillis();
        scheduler.scheduleAtFixedRate(this::fetchRuleset,
                pollingMs, pollingMs, TimeUnit.MILLISECONDS);

        long flushMs = config.getEventFlushInterval().toMillis();
        scheduler.scheduleAtFixedRate(this::flushEventsSafe,
                flushMs, flushMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Shut down background tasks, flush remaining events, and release resources.
     */
    public void stop() {
        if (scheduler != null) {
            scheduler.shutdown();
            try {
                if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }

        // Final flush
        try {
            flushEvents();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to flush events during shutdown", e);
        }
    }

    /**
     * Block until the first ruleset fetch completes or the timeout expires.
     *
     * @param timeout the maximum time to wait
     * @return {@code true} if the client became ready, {@code false} on timeout
     */
    public boolean waitUntilReady(Duration timeout) {
        try {
            return readyLatch.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * Return {@code true} if the client has successfully fetched at least one ruleset.
     */
    public boolean isReady() {
        return ready;
    }

    // ── Local evaluation ────────────────────────────────────────────────────

    /**
     * Evaluate a boolean flag locally.
     *
     * @param flagKey      the flag key
     * @param defaultValue returned if the flag is not found or the value is not a boolean
     * @param ctx          the evaluation context
     * @return the resolved boolean value
     */
    public boolean getBooleanValue(String flagKey, boolean defaultValue, EvaluationContext ctx) {
        EvaluationResult result = resolve(flagKey, ctx);
        if (result == null || !(result.getValue() instanceof Boolean)) {
            return defaultValue;
        }
        return (Boolean) result.getValue();
    }

    /**
     * Evaluate a string flag locally.
     *
     * @param flagKey      the flag key
     * @param defaultValue returned if the flag is not found or the value is not a string
     * @param ctx          the evaluation context
     * @return the resolved string value
     */
    public String getStringValue(String flagKey, String defaultValue, EvaluationContext ctx) {
        EvaluationResult result = resolve(flagKey, ctx);
        if (result == null || !(result.getValue() instanceof String)) {
            return defaultValue;
        }
        return (String) result.getValue();
    }

    /**
     * Evaluate a JSON (arbitrary) flag locally.
     *
     * @param flagKey      the flag key
     * @param defaultValue returned if the flag is not found
     * @param ctx          the evaluation context
     * @param <T>          the expected value type
     * @return the resolved value, or {@code defaultValue}
     */
    @SuppressWarnings("unchecked")
    public <T> T getJsonValue(String flagKey, T defaultValue, EvaluationContext ctx) {
        EvaluationResult result = resolve(flagKey, ctx);
        if (result == null || result.getValue() == null) {
            return defaultValue;
        }
        try {
            return (T) result.getValue();
        } catch (ClassCastException e) {
            return defaultValue;
        }
    }

    /**
     * Get the full evaluation result for a flag.
     *
     * @param flagKey the flag key
     * @param ctx     the evaluation context
     * @return the result, or empty if the flag is not found
     */
    public Optional<EvaluationResult> getVariation(String flagKey, EvaluationContext ctx) {
        return Optional.ofNullable(resolve(flagKey, ctx));
    }

    /**
     * Return all currently loaded flag definitions.
     */
    public List<FlagDefinition> getAllFlags() {
        flagsLock.readLock().lock();
        try {
            return new ArrayList<>(flags.values());
        } finally {
            flagsLock.readLock().unlock();
        }
    }

    // ── Remote evaluation ───────────────────────────────────────────────────

    /**
     * Evaluate a flag server-side via {@code POST /evaluate}.
     *
     * <p>This delegates evaluation to the API and is useful when targeting
     * rules require server-side data that the SDK does not have.
     *
     * @param flagKey the flag key
     * @param ctx     the evaluation context
     * @return the evaluation result
     * @throws RuntimeException if the HTTP request fails
     */
    public EvaluationResult evaluate(String flagKey, EvaluationContext ctx) {
        EvaluationContext context = ctx != null ? ctx : EvaluationContext.empty();
        Map<String, Object> payload = new HashMap<>();
        payload.put("flag_key", flagKey);
        payload.put("context", context.toMap());

        String body = JsonHelper.serialize(payload);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getBaseUrl() + "/evaluate"))
                .header("Content-Type", "application/json")
                .header("X-API-Key", config.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                throw new RuntimeException(
                        "Evaluation failed with status " + response.statusCode()
                                + ": " + response.body());
            }

            Map<String, Object> data = JsonHelper.parseObject(response.body());
            return new EvaluationResult(
                    getStringOrDefault(data, "flag_key", flagKey),
                    getStringOrNull(data, "variation_id"),
                    getStringOrNull(data, "variation_key"),
                    data.get("value"),
                    getStringOrDefault(data, "reason", "default")
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Evaluation interrupted", e);
        } catch (Exception e) {
            throw new RuntimeException("Evaluation request failed", e);
        }
    }

    // ── Event tracking ──────────────────────────────────────────────────────

    /**
     * Queue an evaluation event for later batched submission.
     *
     * <p>Events are flushed automatically on a periodic interval, when the
     * batch size threshold is reached, or when {@link #stop()} is called.
     *
     * @param event the event to track
     */
    public void trackEvent(EvaluationEvent event) {
        boolean shouldFlush = false;
        synchronized (eventLock) {
            eventQueue.add(event);
            if (eventQueue.size() >= config.getEventBatchSize()) {
                shouldFlush = true;
            }
        }
        if (shouldFlush) {
            flushEvents();
        }
    }

    /**
     * Send all queued events to {@code POST /sdk/events} immediately.
     */
    public void flushEvents() {
        List<EvaluationEvent> batch;
        synchronized (eventLock) {
            if (eventQueue.isEmpty()) {
                return;
            }
            batch = new ArrayList<>(eventQueue);
            eventQueue.clear();
        }

        List<Object> eventMaps = new ArrayList<>(batch.size());
        for (EvaluationEvent event : batch) {
            eventMaps.add(event.toMap());
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("events", eventMaps);

        String body = JsonHelper.serialize(payload);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getBaseUrl() + "/sdk/events"))
                .header("Content-Type", "application/json")
                .header("X-API-Key", config.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                logger.warning("Failed to flush events (status " + response.statusCode()
                        + "); re-enqueuing " + batch.size() + " events");
                reenqueueEvents(batch);
            } else {
                logger.fine("Flushed " + batch.size() + " events");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            reenqueueEvents(batch);
        } catch (Exception e) {
            logger.log(Level.WARNING, "Failed to flush " + batch.size()
                    + " events; re-enqueuing", e);
            reenqueueEvents(batch);
        }
    }

    // ── Change listeners ────────────────────────────────────────────────────

    /**
     * Register a listener that fires whenever the flag set changes after a poll.
     *
     * @param listener the callback to invoke with the updated flag list
     * @return a {@link Runnable} that, when called, removes the listener
     */
    public Runnable onFlagsChanged(Consumer<List<FlagDefinition>> listener) {
        listeners.add(listener);
        return () -> listeners.remove(listener);
    }

    // ── Internal ────────────────────────────────────────────────────────────

    /**
     * Resolve a flag locally using the cached ruleset.
     */
    private EvaluationResult resolve(String flagKey, EvaluationContext ctx) {
        FlagDefinition flag;
        flagsLock.readLock().lock();
        try {
            flag = flags.get(flagKey);
        } finally {
            flagsLock.readLock().unlock();
        }

        if (flag == null) {
            return null;
        }

        EvaluationContext context = ctx != null ? ctx : EvaluationContext.empty();
        return Evaluator.evaluate(flag, context);
    }

    /**
     * Fetch the ruleset from the API and update the local cache.
     */
    private void fetchRuleset() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(config.getBaseUrl() + "/sdk/ruleset"))
                    .header("Content-Type", "application/json")
                    .header("X-API-Key", config.getApiKey())
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                logger.warning("Failed to fetch ruleset: HTTP " + response.statusCode());
                return;
            }

            Map<String, Object> data = JsonHelper.parseObject(response.body());
            Map<String, FlagDefinition> newFlags = new HashMap<>();

            Object flagsRaw = data.get("flags");
            if (flagsRaw instanceof List) {
                @SuppressWarnings("unchecked")
                List<Object> flagList = (List<Object>) flagsRaw;
                for (Object item : flagList) {
                    if (item instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> raw = (Map<String, Object>) item;
                        FlagDefinition flag = parseFlag(raw);
                        newFlags.put(flag.getKey(), flag);
                    }
                }
            }

            flagsLock.writeLock().lock();
            try {
                flags = newFlags;
            } finally {
                flagsLock.writeLock().unlock();
            }

            // Mark ready after first successful fetch
            if (!ready) {
                ready = true;
                readyLatch.countDown();
            }

            // Notify listeners
            notifyListeners();

            logger.fine("Fetched ruleset: " + newFlags.size() + " flags");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            // Network errors are swallowed; stale flags are better than no flags
            logger.log(Level.WARNING, "Failed to fetch ruleset", e);
        }
    }

    /**
     * Notify all registered change listeners with the current flag list.
     */
    private void notifyListeners() {
        if (listeners.isEmpty()) {
            return;
        }

        List<FlagDefinition> snapshot;
        flagsLock.readLock().lock();
        try {
            snapshot = new ArrayList<>(flags.values());
        } finally {
            flagsLock.readLock().unlock();
        }

        for (Consumer<List<FlagDefinition>> listener : listeners) {
            try {
                listener.accept(snapshot);
            } catch (Exception e) {
                logger.log(Level.WARNING, "Flag change listener raised an exception", e);
            }
        }
    }

    /**
     * Re-enqueue events that failed to flush so they are not lost.
     */
    private void reenqueueEvents(List<EvaluationEvent> batch) {
        synchronized (eventLock) {
            var combined = new ArrayList<EvaluationEvent>(batch.size() + eventQueue.size());
            combined.addAll(batch);
            combined.addAll(eventQueue);
            eventQueue = combined;
        }
    }

    /**
     * Flush events with exception swallowing (used by the scheduled executor).
     */
    private void flushEventsSafe() {
        try {
            flushEvents();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Periodic event flush failed", e);
        }
    }

    // ── JSON parsing helpers ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private static FlagDefinition parseFlag(Map<String, Object> raw) {
        List<Variation> variations = new ArrayList<>();
        Object variationsRaw = raw.get("variations");
        if (variationsRaw instanceof List) {
            for (Object v : (List<Object>) variationsRaw) {
                if (v instanceof Map) {
                    variations.add(parseVariation((Map<String, Object>) v));
                }
            }
        }

        List<TargetingRule> targetingRules = new ArrayList<>();
        Object rulesRaw = raw.get("targeting_rules");
        if (rulesRaw instanceof List) {
            for (Object r : (List<Object>) rulesRaw) {
                if (r instanceof Map) {
                    targetingRules.add(parseTargetingRule((Map<String, Object>) r));
                }
            }
        }

        List<String> tags = new ArrayList<>();
        Object tagsRaw = raw.get("tags");
        if (tagsRaw instanceof List) {
            for (Object t : (List<Object>) tagsRaw) {
                if (t != null) {
                    tags.add(String.valueOf(t));
                }
            }
        }

        return new FlagDefinition(
                getStringOrDefault(raw, "id", ""),
                getStringOrDefault(raw, "key", ""),
                getStringOrDefault(raw, "name", getStringOrDefault(raw, "key", "")),
                getStringOrDefault(raw, "flag_type", "boolean"),
                getStringOrDefault(raw, "status", "active"),
                getStringOrDefault(raw, "environment", "development"),
                getStringOrDefault(raw, "default_variation_id", ""),
                variations,
                targetingRules,
                tags
        );
    }

    private static Variation parseVariation(Map<String, Object> raw) {
        return new Variation(
                getStringOrDefault(raw, "id", ""),
                getStringOrDefault(raw, "key", ""),
                getStringOrDefault(raw, "name", getStringOrDefault(raw, "key", "")),
                raw.get("value"),
                getStringOrNull(raw, "description")
        );
    }

    @SuppressWarnings("unchecked")
    private static TargetingRule parseTargetingRule(Map<String, Object> raw) {
        List<TargetingCondition> conditions = new ArrayList<>();
        Object conditionsRaw = raw.get("conditions");
        if (conditionsRaw instanceof List) {
            for (Object c : (List<Object>) conditionsRaw) {
                if (c instanceof Map) {
                    Map<String, Object> cm = (Map<String, Object>) c;
                    conditions.add(new TargetingCondition(
                            getStringOrDefault(cm, "attribute", ""),
                            getStringOrDefault(cm, "operator", ""),
                            cm.get("value")
                    ));
                }
            }
        }

        PercentageRollout rollout = null;
        Object rolloutRaw = raw.get("percentage_rollout");
        if (rolloutRaw instanceof Map) {
            Map<String, Object> rolloutMap = (Map<String, Object>) rolloutRaw;
            Object rolloutVariations = rolloutMap.get("variations");
            if (rolloutVariations instanceof List) {
                List<PercentageRollout.Entry> entries = new ArrayList<>();
                for (Object e : (List<Object>) rolloutVariations) {
                    if (e instanceof Map) {
                        Map<String, Object> em = (Map<String, Object>) e;
                        entries.add(new PercentageRollout.Entry(
                                getStringOrDefault(em, "variation_id", ""),
                                getIntOrDefault(em, "weight", 0)
                        ));
                    }
                }
                rollout = new PercentageRollout(entries);
            }
        }

        return new TargetingRule(
                getIntOrDefault(raw, "priority", 0),
                conditions,
                getStringOrNull(raw, "variation_id"),
                rollout,
                getStringOrNull(raw, "segment_id")
        );
    }

    private static String getStringOrDefault(Map<String, Object> map, String key,
                                              String defaultValue) {
        Object val = map.get(key);
        if (val == null) {
            return defaultValue;
        }
        return String.valueOf(val);
    }

    private static String getStringOrNull(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) {
            return null;
        }
        return String.valueOf(val);
    }

    private static int getIntOrDefault(Map<String, Object> map, String key, int defaultValue) {
        Object val = map.get(key);
        if (val instanceof Number) {
            return ((Number) val).intValue();
        }
        if (val != null) {
            try {
                return Integer.parseInt(String.valueOf(val));
            } catch (NumberFormatException e) {
                // fall through
            }
        }
        return defaultValue;
    }
}

package dev.phaseflag.sdk

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantReadWriteLock

/**
 * Phase Flag Android/Kotlin SDK client.
 *
 * Provides feature flag evaluation with local caching, background polling,
 * event batching, and server-side evaluation fallback.
 *
 * ```kotlin
 * val client = PhaseFlagClient(
 *     PhaseFlagConfig(
 *         baseUrl = "https://api.example.com/api/v1",
 *         apiKey = "your-api-key"
 *     )
 * )
 * client.start()
 * client.waitUntilReady(5000)
 *
 * val darkMode = client.getBooleanValue("dark-mode", false,
 *     EvaluationContext(userId = "user-123"))
 *
 * client.stop()
 * ```
 */
class PhaseFlagClient(private val config: PhaseFlagConfig) {

    private val gson = Gson()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val flagsLock = ReentrantReadWriteLock()
    private var flags: MutableMap<String, FlagDefinition> = mutableMapOf()

    private val readyLatch = CountDownLatch(1)
    private val ready = AtomicBoolean(false)

    private val listeners = CopyOnWriteArrayList<(List<FlagDefinition>) -> Unit>()

    private val eventLock = Any()
    private var eventQueue = mutableListOf<EvaluationEvent>()

    private val overrides = ConcurrentHashMap<String, Any?>()

    private var scheduler: ScheduledExecutorService? = null

    // -- Lifecycle --

    fun start() {
        fetchRuleset()
        scheduler = Executors.newScheduledThreadPool(2) { r ->
            Thread(r, "phaseflag-bg").apply { isDaemon = true }
        }.also { sched ->
            sched.scheduleAtFixedRate(
                { fetchRuleset() },
                config.pollingIntervalMs, config.pollingIntervalMs, TimeUnit.MILLISECONDS
            )
            sched.scheduleAtFixedRate(
                { runCatching { flushEvents() } },
                config.eventFlushIntervalMs, config.eventFlushIntervalMs, TimeUnit.MILLISECONDS
            )
        }
    }

    fun stop() {
        scheduler?.shutdown()
        scheduler?.awaitTermination(5, TimeUnit.SECONDS)
        scheduler = null
        runCatching { flushEvents() }
    }

    fun waitUntilReady(timeoutMs: Long): Boolean =
        readyLatch.await(timeoutMs, TimeUnit.MILLISECONDS)

    fun isReady(): Boolean = ready.get()

    // -- Flag mocking --

    fun setOverride(flagKey: String, value: Any?) {
        overrides[flagKey] = value
    }

    fun clearOverride(flagKey: String) {
        overrides.remove(flagKey)
    }

    fun clearAllOverrides() {
        overrides.clear()
    }

    // -- Local evaluation --

    fun getBooleanValue(
        flagKey: String,
        defaultValue: Boolean,
        ctx: EvaluationContext? = null
    ): Boolean {
        overrides[flagKey]?.let { return it as? Boolean ?: defaultValue }
        val result = resolve(flagKey, ctx) ?: return defaultValue
        return result.value as? Boolean ?: defaultValue
    }

    fun getStringValue(
        flagKey: String,
        defaultValue: String,
        ctx: EvaluationContext? = null
    ): String {
        overrides[flagKey]?.let { return it as? String ?: defaultValue }
        val result = resolve(flagKey, ctx) ?: return defaultValue
        return result.value as? String ?: defaultValue
    }

    @Suppress("UNCHECKED_CAST")
    fun <T> getJsonValue(
        flagKey: String,
        defaultValue: T,
        ctx: EvaluationContext? = null
    ): T {
        overrides[flagKey]?.let {
            return try { it as T } catch (_: ClassCastException) { defaultValue }
        }
        val result = resolve(flagKey, ctx) ?: return defaultValue
        return try { result.value as T } catch (_: ClassCastException) { defaultValue }
    }

    fun getVariation(flagKey: String, ctx: EvaluationContext? = null): EvaluationResult? {
        if (overrides.containsKey(flagKey)) {
            return EvaluationResult(
                flagKey = flagKey,
                variationId = null,
                variationKey = null,
                value = overrides[flagKey],
                reason = "override"
            )
        }
        return resolve(flagKey, ctx)
    }

    fun getAllFlags(): List<FlagDefinition> {
        flagsLock.readLock().lock()
        try {
            return flags.values.toList()
        } finally {
            flagsLock.readLock().unlock()
        }
    }

    // -- Event tracking --

    fun trackEvent(event: EvaluationEvent) {
        var shouldFlush = false
        synchronized(eventLock) {
            eventQueue.add(event)
            shouldFlush = eventQueue.size >= config.eventBatchSize
        }
        if (shouldFlush) flushEvents()
    }

    fun flushEvents() {
        val batch: List<EvaluationEvent>
        synchronized(eventLock) {
            if (eventQueue.isEmpty()) return
            batch = eventQueue.toList()
            eventQueue.clear()
        }

        val payload = mapOf("events" to batch.map { it.toMap() })
        val body = gson.toJson(payload)
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("${config.baseUrl}/sdk/events")
            .addHeader("X-API-Key", config.apiKey)
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()

        try {
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    synchronized(eventLock) {
                        eventQueue.addAll(0, batch)
                    }
                }
            }
        } catch (_: Exception) {
            synchronized(eventLock) {
                eventQueue.addAll(0, batch)
            }
        }
    }

    // -- Change listeners --

    fun onFlagsChanged(listener: (List<FlagDefinition>) -> Unit): () -> Unit {
        listeners.add(listener)
        return { listeners.remove(listener) }
    }

    // -- Internal --

    private fun resolve(flagKey: String, ctx: EvaluationContext?): EvaluationResult? {
        val flag: FlagDefinition
        flagsLock.readLock().lock()
        try {
            flag = flags[flagKey] ?: return null
        } finally {
            flagsLock.readLock().unlock()
        }
        return Evaluator.evaluate(flag, ctx ?: EvaluationContext())
    }

    private fun fetchRuleset() {
        try {
            val request = Request.Builder()
                .url("${config.baseUrl}/sdk/ruleset")
                .addHeader("X-API-Key", config.apiKey)
                .addHeader("Content-Type", "application/json")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return

                val responseBody = response.body?.string() ?: return
                val type = object : TypeToken<Map<String, Any>>() {}.type
                val data: Map<String, Any> = gson.fromJson(responseBody, type)

                val newFlags = mutableMapOf<String, FlagDefinition>()
                @Suppress("UNCHECKED_CAST")
                val flagsList = data["flags"] as? List<Map<String, Any>> ?: return
                for (raw in flagsList) {
                    val flag = FlagDefinition.fromMap(raw)
                    newFlags[flag.key] = flag
                }

                flagsLock.writeLock().lock()
                try {
                    flags = newFlags
                } finally {
                    flagsLock.writeLock().unlock()
                }

                if (!ready.get()) {
                    ready.set(true)
                    readyLatch.countDown()
                }

                notifyListeners()
            }
        } catch (_: Exception) {
            // Network errors are swallowed; stale flags are better than no flags
        }
    }

    private fun notifyListeners() {
        if (listeners.isEmpty()) return
        val snapshot: List<FlagDefinition>
        flagsLock.readLock().lock()
        try {
            snapshot = flags.values.toList()
        } finally {
            flagsLock.readLock().unlock()
        }
        for (listener in listeners) {
            runCatching { listener(snapshot) }
        }
    }
}

/// PhaseFlag feature flag client.
///
/// Provides local feature flag evaluation with background polling,
/// server-side evaluation fallback, event batching, and change
/// listeners -- all backed by Foundation's `URLSession` with no
/// external dependencies.
///
/// Usage:
/// ```swift
/// let config = PhaseFlagConfig(
///     baseURL: "https://api.example.com/api/v1",
///     apiKey: "your-api-key"
/// )
/// let client = PhaseFlagClient(config: config)
/// client.start()
/// _ = client.waitUntilReady()
///
/// if client.getBooleanValue("dark-mode", defaultValue: false) {
///     enableDarkMode()
/// }
///
/// client.stop()
/// ```
import Foundation
import os

// MARK: - Logging

private let logger = Logger(
    subsystem: "dev.phaseflag.sdk",
    category: "PhaseFlagClient"
)

// MARK: - Type Aliases

/// Signature for flag-change listener callbacks.
public typealias FlagChangeListener = ([FlagDefinition]) -> Void

// MARK: - Client

/// The main PhaseFlag client. This is a reference type (`class`) so
/// that background timers and shared mutable state work correctly.
///
/// All mutable state is protected by a dedicated `DispatchQueue` used
/// as a serial synchronisation barrier, making the client safe to use
/// from multiple threads concurrently.
public final class PhaseFlagClient {

    // MARK: - Configuration

    private let config: PhaseFlagConfig
    private let baseURL: String
    private let session: URLSession

    // MARK: - Thread-Safety

    /// Serial queue that protects all mutable state (flags, events, listeners).
    private let stateQueue = DispatchQueue(label: "dev.phaseflag.sdk.state")

    /// Background queue for polling and flushing work.
    private let workQueue = DispatchQueue(label: "dev.phaseflag.sdk.work", qos: .utility)

    // MARK: - Flag Store

    /// Current flag definitions keyed by flag key. Access on `stateQueue`.
    private var flags: [String: FlagDefinition] = [:]

    // MARK: - Readiness

    private let readySemaphore = DispatchSemaphore(value: 0)
    private var _isReady = false

    /// Whether the client has successfully fetched at least one ruleset.
    public var isReady: Bool {
        stateQueue.sync { _isReady }
    }

    // MARK: - Listeners

    /// Registered change listeners. Access on `stateQueue`.
    private var listeners: [UUID: FlagChangeListener] = [:]

    // MARK: - Event Queue

    /// Queued evaluation events. Access on `stateQueue`.
    private var eventQueue: [EvaluationEvent] = []

    // MARK: - Timers

    private var pollingTimer: DispatchSourceTimer?
    private var flushTimer: DispatchSourceTimer?

    // MARK: - JSON Coder

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    // MARK: - Initializer

    /// Create a new PhaseFlag client.
    ///
    /// The client does **not** start background work automatically;
    /// call ``start()`` to begin polling and event flushing.
    public init(config: PhaseFlagConfig) {
        self.config = config
        self.baseURL = config.baseURL.hasSuffix("/")
            ? String(config.baseURL.dropLast())
            : config.baseURL
        self.session = URLSession.shared
    }

    // MARK: - Lifecycle

    /// Fetch the initial ruleset and begin background polling and event flushing.
    public func start() {
        // Synchronous first fetch so the client becomes ready quickly.
        fetchRuleset()

        // Polling timer.
        let polling = DispatchSource.makeTimerSource(queue: workQueue)
        polling.schedule(
            deadline: .now() + config.pollingInterval,
            repeating: config.pollingInterval
        )
        polling.setEventHandler { [weak self] in
            self?.fetchRuleset()
        }
        polling.resume()
        pollingTimer = polling

        // Event flush timer.
        let flush = DispatchSource.makeTimerSource(queue: workQueue)
        flush.schedule(
            deadline: .now() + config.eventFlushInterval,
            repeating: config.eventFlushInterval
        )
        flush.setEventHandler { [weak self] in
            self?.flushEvents()
        }
        flush.resume()
        flushTimer = flush
    }

    /// Stop background timers and flush any remaining events.
    public func stop() {
        pollingTimer?.cancel()
        pollingTimer = nil

        flushTimer?.cancel()
        flushTimer = nil

        // Final flush -- best-effort.
        flushEvents()
    }

    /// Block the calling thread until the client has fetched its first ruleset.
    ///
    /// - Parameter timeout: Maximum time to wait, in seconds.
    /// - Returns: `true` if the client became ready within the timeout.
    @discardableResult
    public func waitUntilReady(timeout: TimeInterval = 10) -> Bool {
        if isReady { return true }
        let result = readySemaphore.wait(timeout: .now() + timeout)
        return result == .success
    }

    // MARK: - Local Evaluation: Typed Accessors

    /// Evaluate a boolean flag locally.
    ///
    /// Returns `defaultValue` if the flag is not found, is not active,
    /// or the resolved value is not a boolean.
    public func getBooleanValue(
        _ flagKey: String,
        defaultValue: Bool,
        context: EvaluationContext? = nil
    ) -> Bool {
        guard let result = resolve(flagKey, context: context),
              let boolVal = result.value.boolValue else {
            return defaultValue
        }
        return boolVal
    }

    /// Evaluate a string flag locally.
    ///
    /// Returns `defaultValue` if the flag is not found, is not active,
    /// or the resolved value is not a string.
    public func getStringValue(
        _ flagKey: String,
        defaultValue: String,
        context: EvaluationContext? = nil
    ) -> String {
        guard let result = resolve(flagKey, context: context),
              let strVal = result.value.stringValue else {
            return defaultValue
        }
        return strVal
    }

    /// Evaluate a JSON flag locally, decoding the result to `T`.
    ///
    /// Returns `defaultValue` if the flag is not found or if the value
    /// cannot be decoded to the requested type.
    public func getJsonValue<T: Decodable>(
        _ flagKey: String,
        defaultValue: T,
        context: EvaluationContext? = nil
    ) -> T {
        guard let result = resolve(flagKey, context: context) else {
            return defaultValue
        }
        // Re-encode the AnyCodable value, then decode to T.
        do {
            let data = try encoder.encode(result.value)
            return try decoder.decode(T.self, from: data)
        } catch {
            logger.warning("Failed to decode JSON value for flag '\(flagKey)': \(error.localizedDescription)")
            return defaultValue
        }
    }

    /// Get the full evaluation result for a flag, or `nil` if the flag
    /// is not found.
    public func getVariation(
        _ flagKey: String,
        context: EvaluationContext? = nil
    ) -> EvaluationResult? {
        resolve(flagKey, context: context)
    }

    /// Return all currently loaded flag definitions.
    public func getAllFlags() -> [FlagDefinition] {
        stateQueue.sync { Array(flags.values) }
    }

    // MARK: - Remote Evaluation

    /// Evaluate a flag server-side via `POST /evaluate`.
    ///
    /// This delegates evaluation to the API and is useful when targeting
    /// rules require server-side data that the SDK does not have.
    public func evaluate(
        _ flagKey: String,
        context: EvaluationContext? = nil
    ) async throws -> EvaluationResult {
        let ctx = context ?? EvaluationContext()
        let url = URL(string: "\(baseURL)/evaluate")!
        var request = makeRequest(url: url, method: "POST")

        let payload: [String: AnyCodable] = [
            "flag_key": AnyCodable(flagKey),
            "context": AnyCodable([
                "user_id": AnyCodable(ctx.userId ?? ""),
                "session_id": AnyCodable(ctx.sessionId ?? ""),
                "attributes": AnyCodable(ctx.attributes),
            ] as [String: AnyCodable]),
        ]
        request.httpBody = try encoder.encode(payload)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw PhaseFlagError.httpError(statusCode: statusCode)
        }

        return try decoder.decode(EvaluationResult.self, from: data)
    }

    // MARK: - Event Tracking

    /// Queue an evaluation event for later batched submission.
    ///
    /// Events are flushed automatically on a periodic interval, when the
    /// batch size threshold is reached, or when ``stop()`` is called.
    public func trackEvent(_ event: EvaluationEvent) {
        var shouldFlush = false
        stateQueue.sync {
            eventQueue.append(event)
            if eventQueue.count >= config.eventBatchSize {
                shouldFlush = true
            }
        }
        if shouldFlush {
            workQueue.async { [weak self] in
                self?.flushEvents()
            }
        }
    }

    /// Immediately send all queued events to `POST /sdk/events`.
    public func flushEvents() {
        let batch: [EvaluationEvent] = stateQueue.sync {
            guard !eventQueue.isEmpty else { return [] }
            let copy = eventQueue
            eventQueue.removeAll()
            return copy
        }

        guard !batch.isEmpty else { return }

        let url = URL(string: "\(baseURL)/sdk/events")!
        var request = makeRequest(url: url, method: "POST")

        let payload: [String: AnyCodable] = [
            "events": AnyCodable(batch.map { event -> AnyCodable in
                var dict: [String: AnyCodable] = [
                    "flag_key": AnyCodable(event.flagKey),
                    "metadata": AnyCodable(event.metadata),
                ]
                if let vk = event.variationKey { dict["variation_key"] = AnyCodable(vk) }
                if let uid = event.userId { dict["user_id"] = AnyCodable(uid) }
                if let ts = event.timestamp { dict["timestamp"] = AnyCodable(ts) }
                return AnyCodable(dict)
            })
        ]

        do {
            request.httpBody = try encoder.encode(payload)
        } catch {
            logger.error("Failed to encode events: \(error.localizedDescription)")
            // Re-enqueue the batch.
            stateQueue.sync { eventQueue.insert(contentsOf: batch, at: 0) }
            return
        }

        let semaphore = DispatchSemaphore(value: 0)
        let task = session.dataTask(with: request) { [weak self] _, response, error in
            defer { semaphore.signal() }

            if let error = error {
                logger.warning("Failed to flush \(batch.count) events: \(error.localizedDescription)")
                // Re-enqueue on failure so events are not lost.
                self?.stateQueue.sync {
                    self?.eventQueue.insert(contentsOf: batch, at: 0)
                }
                return
            }

            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode) else {
                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
                logger.warning("Event flush returned status \(statusCode); re-enqueuing \(batch.count) events")
                self?.stateQueue.sync {
                    self?.eventQueue.insert(contentsOf: batch, at: 0)
                }
                return
            }

            logger.debug("Flushed \(batch.count) events")
        }
        task.resume()
        semaphore.wait()
    }

    // MARK: - Change Listeners

    /// Register a callback invoked whenever the flag set changes.
    ///
    /// - Parameter listener: A closure receiving the current array of flag definitions.
    /// - Returns: An unsubscribe closure. Call it to remove the listener.
    @discardableResult
    public func onFlagsChanged(_ listener: @escaping FlagChangeListener) -> () -> Void {
        let id = UUID()
        stateQueue.sync {
            listeners[id] = listener
        }
        return { [weak self] in
            guard let self = self else { return }
            self.stateQueue.sync {
                _ = self.listeners.removeValue(forKey: id)
            }
        }
    }

    // MARK: - Internal

    /// Resolve a flag locally using the cached ruleset.
    private func resolve(_ flagKey: String, context: EvaluationContext?) -> EvaluationResult? {
        let flag: FlagDefinition? = stateQueue.sync { flags[flagKey] }
        guard let flag = flag else { return nil }
        let ctx = context ?? EvaluationContext()
        return Evaluator.evaluate(flag: flag, context: ctx)
    }

    /// Fetch the ruleset from `GET /sdk/ruleset` and update the local cache.
    private func fetchRuleset() {
        let url = URL(string: "\(baseURL)/sdk/ruleset")!
        let request = makeRequest(url: url, method: "GET")

        let semaphore = DispatchSemaphore(value: 0)

        let task = session.dataTask(with: request) { [weak self] data, response, error in
            defer { semaphore.signal() }
            guard let self = self else { return }

            if let error = error {
                logger.warning("Failed to fetch ruleset: \(error.localizedDescription)")
                return
            }

            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode),
                  let data = data else {
                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
                logger.warning("Ruleset fetch returned status \(statusCode)")
                return
            }

            do {
                let ruleset = try self.decoder.decode(RulesetResponse.self, from: data)
                var newFlags: [String: FlagDefinition] = [:]
                for flag in ruleset.flags {
                    newFlags[flag.key] = flag
                }

                self.stateQueue.sync {
                    self.flags = newFlags
                }

                // Mark ready after first successful fetch.
                let wasReady = self.stateQueue.sync { self._isReady }
                if !wasReady {
                    self.stateQueue.sync { self._isReady = true }
                    self.readySemaphore.signal()
                }

                // Notify listeners.
                self.notifyListeners()

                logger.debug("Fetched ruleset: \(newFlags.count) flags")
            } catch {
                logger.warning("Failed to decode ruleset: \(error.localizedDescription)")
            }
        }
        task.resume()
        semaphore.wait()
    }

    /// Notify all registered change listeners with the current flags snapshot.
    private func notifyListeners() {
        let (snapshot, currentListeners): ([FlagDefinition], [FlagChangeListener]) = stateQueue.sync {
            (Array(flags.values), Array(listeners.values))
        }

        for listener in currentListeners {
            listener(snapshot)
        }
    }

    /// Build a `URLRequest` with the standard headers.
    private func makeRequest(url: URL, method: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.apiKey, forHTTPHeaderField: "X-API-Key")
        request.timeoutInterval = 10
        return request
    }
}

// MARK: - Errors

/// Errors thrown by ``PhaseFlagClient``.
public enum PhaseFlagError: Error, LocalizedError {
    /// The server returned a non-2xx HTTP status code.
    case httpError(statusCode: Int)

    public var errorDescription: String? {
        switch self {
        case .httpError(let statusCode):
            return "PhaseFlag HTTP error: status \(statusCode)"
        }
    }
}

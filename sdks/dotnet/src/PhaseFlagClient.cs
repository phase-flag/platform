using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PhaseFlag.Models;

namespace PhaseFlag;

/// <summary>
/// Feature flag client with local evaluation, background polling, and event batching.
/// <para>
/// Usage:
/// <code>
/// var config = new PhaseFlagConfig("https://api.example.com/api/v1", "your-api-key");
/// using var client = new PhaseFlagClient(config);
/// await client.StartAsync();
/// await client.WaitUntilReadyAsync(TimeSpan.FromSeconds(5));
///
/// if (client.GetBooleanValue("dark-mode", false))
///     EnableDarkMode();
/// </code>
/// </para>
/// </summary>
public sealed class PhaseFlagClient : IDisposable
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly PhaseFlagConfig _config;
    private readonly HttpClient _httpClient;
    private readonly bool _ownsHttpClient;

    // Flag store (protected by ReaderWriterLockSlim)
    private readonly ReaderWriterLockSlim _flagLock = new();
    private Dictionary<string, FlagDefinition> _flags = new();

    // Readiness
    private readonly TaskCompletionSource _readyTcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private volatile bool _isReady;

    // Change listeners
    private readonly object _listenerLock = new();
    private readonly List<Action<IReadOnlyList<FlagDefinition>>> _listeners = [];

    // Event queue
    private readonly object _eventLock = new();
    private List<EvaluationEvent> _eventQueue = [];

    // Background timers
    private Timer? _pollingTimer;
    private Timer? _flushTimer;

    // Disposal
    private volatile bool _disposed;

    // -----------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------

    /// <summary>
    /// Create a new <see cref="PhaseFlagClient"/> with the given configuration.
    /// </summary>
    /// <param name="config">Client configuration (base URL, API key, intervals).</param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="config"/> is <c>null</c>.</exception>
    public PhaseFlagClient(PhaseFlagConfig config)
        : this(config, httpClient: null)
    {
    }

    /// <summary>
    /// Create a new <see cref="PhaseFlagClient"/> with an externally managed <see cref="HttpClient"/>.
    /// </summary>
    /// <param name="config">Client configuration.</param>
    /// <param name="httpClient">
    /// Optional pre-configured <see cref="HttpClient"/>. When <c>null</c>, the client
    /// creates and owns its own instance.
    /// </param>
    internal PhaseFlagClient(PhaseFlagConfig config, HttpClient? httpClient)
    {
        ArgumentNullException.ThrowIfNull(config);

        _config = config;

        if (httpClient is not null)
        {
            _httpClient = httpClient;
            _ownsHttpClient = false;
        }
        else
        {
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(config.BaseUrl.TrimEnd('/')),
                Timeout = TimeSpan.FromSeconds(10),
            };
            _httpClient.DefaultRequestHeaders.Add("X-API-Key", config.ApiKey);
            _ownsHttpClient = true;
        }
    }

    // -----------------------------------------------------------------
    // Properties
    // -----------------------------------------------------------------

    /// <summary>
    /// Whether the client has successfully fetched at least one ruleset.
    /// </summary>
    public bool IsReady => _isReady;

    // -----------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------

    /// <summary>
    /// Fetch the initial ruleset and start background polling and event flushing.
    /// </summary>
    /// <param name="ct">Cancellation token for the initial fetch.</param>
    public async Task StartAsync(CancellationToken ct = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        await FetchRulesetAsync(ct).ConfigureAwait(false);

        // Start background polling timer
        _pollingTimer = new Timer(
            _ => _ = FetchRulesetInBackgroundAsync(),
            state: null,
            dueTime: _config.PollingInterval,
            period: _config.PollingInterval);

        // Start background event flush timer
        _flushTimer = new Timer(
            _ => _ = FlushEventsInBackgroundAsync(),
            state: null,
            dueTime: _config.EventFlushInterval,
            period: _config.EventFlushInterval);
    }

    /// <summary>
    /// Stop background timers and flush any remaining events.
    /// </summary>
    public void Stop()
    {
        _pollingTimer?.Dispose();
        _pollingTimer = null;

        _flushTimer?.Dispose();
        _flushTimer = null;

        // Best-effort final flush (synchronous)
        try
        {
            FlushEventsAsync().GetAwaiter().GetResult();
        }
        catch
        {
            // Swallow -- shutdown should never throw
        }
    }

    /// <summary>
    /// Wait until the first successful ruleset fetch completes.
    /// </summary>
    /// <param name="timeout">Maximum time to wait.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><c>true</c> if the client became ready; <c>false</c> on timeout.</returns>
    public async Task<bool> WaitUntilReadyAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        if (_isReady)
            return true;

        using var timeoutCts = new CancellationTokenSource(timeout);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

        try
        {
            await _readyTcs.Task.WaitAsync(linkedCts.Token).ConfigureAwait(false);
            return true;
        }
        catch (OperationCanceledException)
        {
            return _isReady;
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;
        Stop();

        if (_ownsHttpClient)
            _httpClient.Dispose();

        _flagLock.Dispose();
    }

    // -----------------------------------------------------------------
    // Local evaluation
    // -----------------------------------------------------------------

    /// <summary>
    /// Evaluate a boolean flag locally.
    /// Returns <paramref name="defaultValue"/> if the flag is not found,
    /// is not active, or the resolved value is not a boolean.
    /// </summary>
    /// <param name="flagKey">The flag key to evaluate.</param>
    /// <param name="defaultValue">Value returned when evaluation fails or type does not match.</param>
    /// <param name="ctx">Optional evaluation context for targeting.</param>
    public bool GetBooleanValue(string flagKey, bool defaultValue, EvaluationContext? ctx = null)
    {
        var result = Resolve(flagKey, ctx);
        if (result is null)
            return defaultValue;

        if (result.Value.ValueKind == JsonValueKind.True)
            return true;
        if (result.Value.ValueKind == JsonValueKind.False)
            return false;

        return defaultValue;
    }

    /// <summary>
    /// Evaluate a string flag locally.
    /// Returns <paramref name="defaultValue"/> if the flag is not found,
    /// is not active, or the resolved value is not a string.
    /// </summary>
    /// <param name="flagKey">The flag key to evaluate.</param>
    /// <param name="defaultValue">Value returned when evaluation fails or type does not match.</param>
    /// <param name="ctx">Optional evaluation context for targeting.</param>
    public string GetStringValue(string flagKey, string defaultValue, EvaluationContext? ctx = null)
    {
        var result = Resolve(flagKey, ctx);
        if (result is null)
            return defaultValue;

        if (result.Value.ValueKind == JsonValueKind.String)
            return result.Value.GetString() ?? defaultValue;

        return defaultValue;
    }

    /// <summary>
    /// Evaluate a JSON flag locally, deserializing the value to <typeparamref name="T"/>.
    /// Returns <paramref name="defaultValue"/> if the flag is not found or deserialization fails.
    /// </summary>
    /// <typeparam name="T">The type to deserialize the flag value into.</typeparam>
    /// <param name="flagKey">The flag key to evaluate.</param>
    /// <param name="defaultValue">Value returned when evaluation fails.</param>
    /// <param name="ctx">Optional evaluation context for targeting.</param>
    public T GetJsonValue<T>(string flagKey, T defaultValue, EvaluationContext? ctx = null)
    {
        var result = Resolve(flagKey, ctx);
        if (result is null)
            return defaultValue;

        try
        {
            return result.Value.Deserialize<T>(s_jsonOptions) ?? defaultValue;
        }
        catch (JsonException)
        {
            return defaultValue;
        }
    }

    /// <summary>
    /// Get the full evaluation result for a flag, or <c>null</c> if the flag is not found.
    /// </summary>
    /// <param name="flagKey">The flag key to evaluate.</param>
    /// <param name="ctx">Optional evaluation context for targeting.</param>
    public EvaluationResult? GetVariation(string flagKey, EvaluationContext? ctx = null)
    {
        return Resolve(flagKey, ctx);
    }

    /// <summary>
    /// Return all currently loaded flag definitions.
    /// </summary>
    public IReadOnlyList<FlagDefinition> GetAllFlags()
    {
        _flagLock.EnterReadLock();
        try
        {
            return _flags.Values.ToList().AsReadOnly();
        }
        finally
        {
            _flagLock.ExitReadLock();
        }
    }

    // -----------------------------------------------------------------
    // Remote evaluation
    // -----------------------------------------------------------------

    /// <summary>
    /// Evaluate a flag server-side via <c>POST /evaluate</c>.
    /// <para>
    /// This delegates evaluation to the API and is useful when targeting
    /// rules require server-side data that the SDK does not have.
    /// </para>
    /// </summary>
    /// <param name="flagKey">The flag key to evaluate.</param>
    /// <param name="ctx">Optional evaluation context.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The server-side evaluation result.</returns>
    /// <exception cref="HttpRequestException">Thrown when the API returns an error status code.</exception>
    public async Task<EvaluationResult> EvaluateAsync(string flagKey, EvaluationContext? ctx = null, CancellationToken ct = default)
    {
        ctx ??= new EvaluationContext();

        var payload = new
        {
            flag_key = flagKey,
            context = new
            {
                user_id = ctx.UserId,
                session_id = ctx.SessionId,
                attributes = ctx.Attributes,
            },
        };

        var response = await _httpClient.PostAsJsonAsync("/evaluate", payload, s_jsonOptions, ct)
            .ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<EvaluationResult>(s_jsonOptions, ct)
            .ConfigureAwait(false);

        return result ?? new EvaluationResult { FlagKey = flagKey, Reason = "error" };
    }

    // -----------------------------------------------------------------
    // Event tracking
    // -----------------------------------------------------------------

    /// <summary>
    /// Queue an evaluation event for later batched submission.
    /// <para>
    /// Events are flushed automatically on a periodic interval, when the
    /// batch size threshold is reached, or when <see cref="Stop"/> / <see cref="Dispose"/> is called.
    /// </para>
    /// </summary>
    /// <param name="evt">The event to enqueue.</param>
    public void TrackEvent(EvaluationEvent evt)
    {
        ArgumentNullException.ThrowIfNull(evt);

        bool shouldFlush;
        lock (_eventLock)
        {
            _eventQueue.Add(evt);
            shouldFlush = _eventQueue.Count >= _config.EventBatchSize;
        }

        if (shouldFlush)
        {
            _ = FlushEventsInBackgroundAsync();
        }
    }

    /// <summary>
    /// Immediately send all queued events to <c>POST /sdk/events</c>.
    /// </summary>
    public async Task FlushEventsAsync()
    {
        List<EvaluationEvent> batch;
        lock (_eventLock)
        {
            if (_eventQueue.Count == 0)
                return;

            batch = _eventQueue;
            _eventQueue = new List<EvaluationEvent>();
        }

        var payload = new { events = batch };

        try
        {
            var response = await _httpClient.PostAsJsonAsync("/sdk/events", payload, s_jsonOptions)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
        }
        catch
        {
            // Re-enqueue on failure so events are not lost
            lock (_eventLock)
            {
                batch.AddRange(_eventQueue);
                _eventQueue = batch;
            }
        }
    }

    // -----------------------------------------------------------------
    // Change listeners
    // -----------------------------------------------------------------

    /// <summary>
    /// Register a listener that fires whenever the flag set changes after a poll.
    /// </summary>
    /// <param name="listener">Callback receiving the updated flag list.</param>
    /// <returns>
    /// An <see cref="Action"/> that, when invoked, removes the listener.
    /// </returns>
    public Action OnFlagsChanged(Action<IReadOnlyList<FlagDefinition>> listener)
    {
        ArgumentNullException.ThrowIfNull(listener);

        lock (_listenerLock)
        {
            _listeners.Add(listener);
        }

        return () =>
        {
            lock (_listenerLock)
            {
                _listeners.Remove(listener);
            }
        };
    }

    // -----------------------------------------------------------------
    // Internal -- ruleset fetching
    // -----------------------------------------------------------------

    private async Task FetchRulesetAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/sdk/ruleset", ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
                return;

            var json = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);

            var newFlags = new Dictionary<string, FlagDefinition>();

            if (doc.RootElement.TryGetProperty("flags", out var flagsArray)
                && flagsArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var flagElement in flagsArray.EnumerateArray())
                {
                    var flag = JsonSerializer.Deserialize<FlagDefinition>(flagElement.GetRawText(), s_jsonOptions);
                    if (flag is not null)
                    {
                        newFlags[flag.Key] = flag;
                    }
                }
            }

            _flagLock.EnterWriteLock();
            try
            {
                _flags = newFlags;
            }
            finally
            {
                _flagLock.ExitWriteLock();
            }

            // Mark ready after first successful fetch
            if (!_isReady)
            {
                _isReady = true;
                _readyTcs.TrySetResult();
            }

            NotifyListeners();
        }
        catch
        {
            // Network errors are swallowed; stale flags are better than no flags.
        }
    }

    private async Task FetchRulesetInBackgroundAsync()
    {
        try
        {
            await FetchRulesetAsync().ConfigureAwait(false);
        }
        catch
        {
            // Background polling must never crash.
        }
    }

    private async Task FlushEventsInBackgroundAsync()
    {
        try
        {
            await FlushEventsAsync().ConfigureAwait(false);
        }
        catch
        {
            // Background flushing must never crash.
        }
    }

    // -----------------------------------------------------------------
    // Internal -- local resolution
    // -----------------------------------------------------------------

    private EvaluationResult? Resolve(string flagKey, EvaluationContext? ctx)
    {
        FlagDefinition? flag;
        _flagLock.EnterReadLock();
        try
        {
            _flags.TryGetValue(flagKey, out flag);
        }
        finally
        {
            _flagLock.ExitReadLock();
        }

        if (flag is null)
            return null;

        return Evaluator.Evaluate(flag, ctx);
    }

    // -----------------------------------------------------------------
    // Internal -- listener notification
    // -----------------------------------------------------------------

    private void NotifyListeners()
    {
        List<Action<IReadOnlyList<FlagDefinition>>> snapshot;
        lock (_listenerLock)
        {
            if (_listeners.Count == 0)
                return;
            snapshot = [.. _listeners];
        }

        IReadOnlyList<FlagDefinition> flagsSnapshot;
        _flagLock.EnterReadLock();
        try
        {
            flagsSnapshot = _flags.Values.ToList().AsReadOnly();
        }
        finally
        {
            _flagLock.ExitReadLock();
        }

        foreach (var listener in snapshot)
        {
            try
            {
                listener(flagsSnapshot);
            }
            catch
            {
                // Listener errors should not break polling.
            }
        }
    }
}

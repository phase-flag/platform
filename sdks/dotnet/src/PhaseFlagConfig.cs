namespace PhaseFlag;

/// <summary>
/// Configuration for the <see cref="PhaseFlagClient"/>.
/// </summary>
/// <param name="BaseUrl">
/// Base URL of the PhaseFlag API (e.g. <c>"https://api.example.com/api/v1"</c>).
/// Trailing slashes are stripped automatically.
/// </param>
/// <param name="ApiKey">
/// API key for authentication, sent as <c>X-API-Key</c> header.
/// </param>
public record PhaseFlagConfig(string BaseUrl, string ApiKey)
{
    /// <summary>
    /// Interval between background polling requests for the flag ruleset.
    /// Default: 30 seconds.
    /// </summary>
    public TimeSpan PollingInterval { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Interval between automatic event flush cycles.
    /// Default: 30 seconds.
    /// </summary>
    public TimeSpan EventFlushInterval { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Maximum number of queued events before an automatic flush is triggered.
    /// Default: 100.
    /// </summary>
    public int EventBatchSize { get; init; } = 100;
}

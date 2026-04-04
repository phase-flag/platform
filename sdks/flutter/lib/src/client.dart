import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';
import 'evaluator.dart';

/// Phase Flag Flutter client.
///
/// Provides feature flag evaluation with local caching, background polling,
/// event batching, and server-side evaluation fallback.
///
/// ```dart
/// final client = PhaseFlagClient(
///   config: PhaseFlagConfig(
///     baseUrl: 'https://api.example.com/api/v1',
///     apiKey: 'your-api-key',
///   ),
/// );
/// await client.start();
///
/// if (client.getBooleanValue('dark-mode', false)) {
///   enableDarkMode();
/// }
///
/// client.stop();
/// ```
class PhaseFlagClient {
  final PhaseFlagConfig config;
  final http.Client _httpClient;

  final Map<String, FlagDefinition> _flags = {};
  final List<EvaluationEvent> _eventQueue = [];
  final List<void Function(List<FlagDefinition>)> _listeners = [];
  final Map<String, dynamic> _overrides = {};

  Timer? _pollingTimer;
  Timer? _flushTimer;
  Completer<void>? _readyCompleter;
  bool _isReady = false;

  PhaseFlagClient({required this.config, http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client();

  /// Whether the client has fetched at least one ruleset.
  bool get isReady => _isReady;

  /// Fetch the initial ruleset and start background polling.
  Future<void> start() async {
    _readyCompleter = Completer<void>();

    try {
      await _fetchRuleset();
      _isReady = true;
      _readyCompleter?.complete();
    } catch (_) {
      // Will retry via polling
    }

    _pollingTimer = Timer.periodic(config.pollingInterval, (_) {
      _fetchRuleset().catchError((_) {});
    });

    _flushTimer = Timer.periodic(config.eventFlushInterval, (_) {
      flushEvents().catchError((_) {});
    });
  }

  /// Stop polling and flush remaining events.
  void stop() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
    _flushTimer?.cancel();
    _flushTimer = null;
    flushEvents().catchError((_) {});
  }

  /// Wait until the first ruleset fetch completes.
  Future<void> waitUntilReady() async {
    if (_isReady) return;
    await _readyCompleter?.future;
  }

  // -- Flag mocking --

  void setOverride(String flagKey, dynamic value) {
    _overrides[flagKey] = value;
  }

  void clearOverride(String flagKey) {
    _overrides.remove(flagKey);
  }

  void clearAllOverrides() {
    _overrides.clear();
  }

  // -- Local evaluation --

  bool getBooleanValue(String flagKey, bool defaultValue,
      [EvaluationContext? ctx]) {
    if (_overrides.containsKey(flagKey)) {
      final v = _overrides[flagKey];
      return v is bool ? v : defaultValue;
    }
    final result = _resolve(flagKey, ctx);
    if (result == null || result.value is! bool) return defaultValue;
    return result.value as bool;
  }

  String getStringValue(String flagKey, String defaultValue,
      [EvaluationContext? ctx]) {
    if (_overrides.containsKey(flagKey)) {
      final v = _overrides[flagKey];
      return v is String ? v : defaultValue;
    }
    final result = _resolve(flagKey, ctx);
    if (result == null || result.value is! String) return defaultValue;
    return result.value as String;
  }

  T getJsonValue<T>(String flagKey, T defaultValue, [EvaluationContext? ctx]) {
    if (_overrides.containsKey(flagKey)) {
      try {
        return _overrides[flagKey] as T;
      } catch (_) {
        return defaultValue;
      }
    }
    final result = _resolve(flagKey, ctx);
    if (result == null) return defaultValue;
    try {
      return result.value as T;
    } catch (_) {
      return defaultValue;
    }
  }

  EvaluationResult? getVariation(String flagKey, [EvaluationContext? ctx]) {
    if (_overrides.containsKey(flagKey)) {
      return EvaluationResult(
        flagKey: flagKey,
        value: _overrides[flagKey],
        reason: 'override',
      );
    }
    return _resolve(flagKey, ctx);
  }

  List<FlagDefinition> getAllFlags() => _flags.values.toList();

  // -- Event tracking --

  void trackEvent(EvaluationEvent event) {
    _eventQueue.add(event);
    if (_eventQueue.length >= config.eventBatchSize) {
      flushEvents().catchError((_) {});
    }
  }

  Future<void> flushEvents() async {
    if (_eventQueue.isEmpty) return;

    final batch = List<EvaluationEvent>.from(_eventQueue);
    _eventQueue.clear();

    final payload = jsonEncode({
      'events': batch.map((e) => e.toMap()).toList(),
    });

    try {
      final response = await _httpClient.post(
        Uri.parse('${config.baseUrl}/sdk/events'),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: payload,
      );

      if (response.statusCode >= 400) {
        _eventQueue.insertAll(0, batch);
      }
    } catch (_) {
      _eventQueue.insertAll(0, batch);
    }
  }

  // -- Change listeners --

  void Function() onFlagsChanged(void Function(List<FlagDefinition>) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  // -- Internal --

  EvaluationResult? _resolve(String flagKey, EvaluationContext? ctx) {
    final flag = _flags[flagKey];
    if (flag == null) return null;
    return PhaseFlagEvaluator.evaluate(flag, ctx ?? EvaluationContext());
  }

  Future<void> _fetchRuleset() async {
    try {
      final response = await _httpClient.get(
        Uri.parse('${config.baseUrl}/sdk/ruleset'),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
      );

      if (response.statusCode >= 400) return;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final flagsList = data['flags'] as List? ?? [];

      _flags.clear();
      for (final raw in flagsList) {
        final flag =
            FlagDefinition.fromMap(Map<String, dynamic>.from(raw as Map));
        _flags[flag.key] = flag;
      }

      if (!_isReady) {
        _isReady = true;
        _readyCompleter?.complete();
      }

      _notifyListeners();
    } catch (_) {
      // Network errors are swallowed; stale flags preferred
    }
  }

  void _notifyListeners() {
    final snapshot = _flags.values.toList();
    for (final listener in List.from(_listeners)) {
      try {
        listener(snapshot);
      } catch (_) {
        // Listener errors should not break polling
      }
    }
  }
}

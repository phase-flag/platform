/// Phase Flag Flutter SDK
///
/// Provides feature flag evaluation with local caching, background polling,
/// event batching, and server-side evaluation fallback for Flutter apps.
///
/// ```dart
/// import 'package:phaseflag_flutter/phaseflag_flutter.dart';
///
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
library phaseflag_flutter;

export 'src/client.dart';
export 'src/evaluator.dart';
export 'src/models.dart';

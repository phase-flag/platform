//! Type definitions for the PhaseFlag Rust SDK.
//!
//! Mirrors the server-side models used by the PhaseFlag API so that
//! flag definitions, variations, evaluation results, and contexts can
//! be represented in a type-safe manner on the client side.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// SDK configuration
// ---------------------------------------------------------------------------

/// Configuration for the [`PhaseFlagClient`](crate::PhaseFlagClient).
///
/// # Examples
///
/// ```
/// use phaseflag::PhaseFlagConfig;
///
/// let config = PhaseFlagConfig {
///     base_url: "https://api.example.com/api/v1".into(),
///     api_key: "sdk-key-xxx".into(),
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PhaseFlagConfig {
    /// Base URL of the PhaseFlag API (e.g. `"https://api.example.com/api/v1"`).
    pub base_url: String,
    /// API key for authentication.
    pub api_key: String,
    /// How often (in seconds) the client polls for ruleset updates. Default: 30.
    #[serde(default = "default_polling_interval")]
    pub polling_interval_secs: u64,
    /// How often (in seconds) queued events are flushed. Default: 30.
    #[serde(default = "default_event_flush_interval")]
    pub event_flush_interval_secs: u64,
    /// Maximum number of events buffered before an automatic flush. Default: 100.
    #[serde(default = "default_event_batch_size")]
    pub event_batch_size: usize,
}

fn default_polling_interval() -> u64 {
    30
}
fn default_event_flush_interval() -> u64 {
    30
}
fn default_event_batch_size() -> usize {
    100
}

impl Default for PhaseFlagConfig {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            api_key: String::new(),
            polling_interval_secs: default_polling_interval(),
            event_flush_interval_secs: default_event_flush_interval(),
            event_batch_size: default_event_batch_size(),
        }
    }
}

// ---------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------

/// User/request attributes sent to targeting-rule evaluation.
///
/// `user_id` is the primary identifier for percentage rollouts;
/// `session_id` is a fallback when `user_id` is unavailable.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EvaluationContext {
    /// Stable user identifier used for percentage rollouts.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    /// Fallback identifier when `user_id` is unavailable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Arbitrary key-value pairs checked by targeting conditions.
    #[serde(default)]
    pub attributes: HashMap<String, serde_json::Value>,
}

impl EvaluationContext {
    /// Look up a value by key as a cloned [`serde_json::Value`].
    ///
    /// Checks the well-known fields (`user_id`, `session_id`) first --
    /// wrapping them as JSON strings -- then falls back to `attributes`.
    pub fn get(&self, key: &str) -> Option<serde_json::Value> {
        match key {
            "user_id" => self
                .user_id
                .as_ref()
                .map(|v| serde_json::Value::String(v.clone())),
            "session_id" => self
                .session_id
                .as_ref()
                .map(|v| serde_json::Value::String(v.clone())),
            _ => self.attributes.get(key).cloned(),
        }
    }

    /// Return the effective user identifier for percentage rollouts.
    ///
    /// Prefers `user_id`, falls back to `session_id`, returns `None`
    /// if both are absent.
    pub fn rollout_id(&self) -> Option<&str> {
        self.user_id
            .as_deref()
            .or(self.session_id.as_deref())
            .filter(|s| !s.is_empty())
    }
}

// ---------------------------------------------------------------------------
// Flag & variation structures (as returned by GET /sdk/ruleset)
// ---------------------------------------------------------------------------

/// A single variation of a feature flag.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Variation {
    pub id: String,
    pub key: String,
    pub name: String,
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// A single condition within a targeting rule.
///
/// Supported operators: `is`, `is_not`, `contains`, `not_contains`,
/// `one_of`, `not_one_of`, `gt`, `lt`, `matches_regex`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TargetingCondition {
    pub attribute: String,
    pub operator: String,
    pub value: serde_json::Value,
}

/// One slice of a percentage rollout.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PercentageRolloutEntry {
    pub variation_id: String,
    pub weight: u32,
}

/// Percentage-based traffic allocation among variations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PercentageRollout {
    #[serde(default)]
    pub variations: Vec<PercentageRolloutEntry>,
}

/// A targeting rule with conditions, an optional explicit variation,
/// and an optional percentage rollout.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TargetingRule {
    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub conditions: Vec<TargetingCondition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percentage_rollout: Option<PercentageRollout>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_id: Option<String>,
}

/// A complete flag definition as received from the API ruleset endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct FlagDefinition {
    pub id: String,
    pub key: String,
    pub name: String,
    pub flag_type: String,
    pub status: String,
    pub environment: String,
    pub default_variation_id: String,
    #[serde(default)]
    pub variations: Vec<Variation>,
    #[serde(default)]
    pub targeting_rules: Vec<TargetingRule>,
    #[serde(default)]
    pub tags: Vec<String>,
}

// ---------------------------------------------------------------------------
// Evaluation result (returned by POST /evaluate and local evaluation)
// ---------------------------------------------------------------------------

/// The result of evaluating a flag, whether locally or via the remote API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EvaluationResult {
    pub flag_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variation_key: Option<String>,
    pub value: serde_json::Value,
    #[serde(default = "default_reason")]
    pub reason: String,
}

fn default_reason() -> String {
    "default".into()
}

// ---------------------------------------------------------------------------
// Event types (sent to POST /sdk/events)
// ---------------------------------------------------------------------------

/// An evaluation event to be sent for analytics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct EvaluationEvent {
    pub flag_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variation_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

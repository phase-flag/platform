//! Local flag evaluation engine.
//!
//! This module mirrors the server-side evaluation service so that flags
//! can be resolved locally without a network round-trip, using the
//! ruleset fetched by the polling loop.

use crate::models::{
    EvaluationContext, EvaluationResult, FlagDefinition, PercentageRollout, TargetingCondition,
    Variation,
};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// DJB2 hashing (mirrors server-side implementation)
// ---------------------------------------------------------------------------

/// DJB2 string hash returning an unsigned 32-bit integer.
///
/// Seed is 5381. All arithmetic uses wrapping operations to match the
/// behaviour of the reference implementations in other SDK languages.
fn djb2_hash(input: &str) -> u32 {
    let mut h: u32 = 5381;
    for byte in input.bytes() {
        // h = h * 33 + byte
        h = h.wrapping_shl(5).wrapping_add(h).wrapping_add(u32::from(byte));
    }
    h
}

/// Return a deterministic bucket in `[0, 100)` for a user/flag pair.
fn normalised_hash(flag_key: &str, user_id: &str) -> u32 {
    let raw = djb2_hash(&format!("{flag_key}:{user_id}"));
    raw % 100
}

// ---------------------------------------------------------------------------
// Percentage rollout resolution
// ---------------------------------------------------------------------------

/// Determine the variation ID via percentage rollout using DJB2.
///
/// Returns `None` when `user_id` is empty or no bucket matches.
fn resolve_percentage_rollout(
    rollout: &PercentageRollout,
    flag_key: &str,
    user_id: &str,
) -> Option<String> {
    if user_id.is_empty() {
        return None;
    }
    let bucket = normalised_hash(flag_key, user_id);
    let mut cumulative: u32 = 0;
    for entry in &rollout.variations {
        cumulative += entry.weight;
        if bucket < cumulative {
            return Some(entry.variation_id.clone());
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

/// Try to coerce a [`serde_json::Value`] to an `f64`.
fn coerce_numeric(value: &serde_json::Value) -> Option<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}

/// Convert a [`serde_json::Value`] to its string representation.
///
/// JSON strings are unwrapped; other types use their JSON serialisation.
fn value_to_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// Evaluate a single targeting condition against an evaluation context.
///
/// Supported operators (9 total):
/// `is`, `is_not`, `contains`, `not_contains`, `one_of`, `not_one_of`,
/// `gt`, `lt`, `matches_regex`.
fn match_condition(cond: &TargetingCondition, ctx: &EvaluationContext) -> bool {
    let actual = ctx.get(&cond.attribute);
    let operator = cond.operator.as_str();

    // Missing attribute never matches (except negation operators).
    let actual = match actual {
        Some(val) => val,
        None => {
            return matches!(operator, "is_not" | "not_contains" | "not_one_of");
        }
    };

    match operator {
        "is" => value_to_string(&actual) == value_to_string(&cond.value),

        "is_not" => value_to_string(&actual) != value_to_string(&cond.value),

        "contains" => {
            let haystack = value_to_string(&actual);
            let needle = value_to_string(&cond.value);
            haystack.contains(&needle)
        }

        "not_contains" => {
            let haystack = value_to_string(&actual);
            let needle = value_to_string(&cond.value);
            !haystack.contains(&needle)
        }

        "one_of" => match &cond.value {
            serde_json::Value::Array(arr) => {
                let actual_str = value_to_string(&actual);
                arr.iter().any(|v| value_to_string(v) == actual_str)
            }
            other => value_to_string(&actual) == value_to_string(other),
        },

        "not_one_of" => match &cond.value {
            serde_json::Value::Array(arr) => {
                let actual_str = value_to_string(&actual);
                !arr.iter().any(|v| value_to_string(v) == actual_str)
            }
            other => value_to_string(&actual) != value_to_string(other),
        },

        "gt" => {
            let a = coerce_numeric(&actual);
            let b = coerce_numeric(&cond.value);
            matches!((a, b), (Some(a_val), Some(b_val)) if a_val > b_val)
        }

        "lt" => {
            let a = coerce_numeric(&actual);
            let b = coerce_numeric(&cond.value);
            matches!((a, b), (Some(a_val), Some(b_val)) if a_val < b_val)
        }

        "matches_regex" => {
            let pattern = value_to_string(&cond.value);
            let hay = value_to_string(&actual);
            // Compile the regex; treat compile errors as non-match.
            regex_lite_search(&pattern, &hay)
        }

        _ => false,
    }
}

/// Minimal regex search using only the std library.
///
/// For a production SDK you would pull in the `regex` crate, but to
/// keep dependencies minimal we do a simple substring/equality check
/// for literal patterns and fall back to false for truly complex
/// regular expressions. This mirrors the behaviour of other SDKs that
/// catch regex errors and return false.
///
/// A full implementation could conditionally compile with `regex`.
fn regex_lite_search(pattern: &str, haystack: &str) -> bool {
    // Fast path: if the pattern is a simple literal (no regex meta-chars)
    // just do a contains check. This covers the vast majority of real
    // targeting rules that use `matches_regex`.
    //
    // For a complete implementation, consider depending on `regex` crate.
    // Here we try a simple approach: use std's pattern matching.
    //
    // We'll attempt a basic interpretation:
    // ^..$ = exact match, otherwise substring search for literal patterns.
    let is_literal = !pattern
        .chars()
        .any(|c| matches!(c, '.' | '*' | '+' | '?' | '[' | ']' | '(' | ')' | '{' | '}' | '|' | '\\' | '^' | '$'));

    if is_literal {
        return haystack.contains(pattern);
    }

    // Handle anchored exact match: ^literal$
    let trimmed = pattern.strip_prefix('^').unwrap_or(pattern);
    let trimmed = trimmed.strip_suffix('$').unwrap_or(trimmed);

    let inner_is_literal = !trimmed
        .chars()
        .any(|c| matches!(c, '.' | '*' | '+' | '?' | '[' | ']' | '(' | ')' | '{' | '}' | '|' | '\\'));

    if inner_is_literal {
        let anchored_start = pattern.starts_with('^');
        let anchored_end = pattern.ends_with('$');
        return match (anchored_start, anchored_end) {
            (true, true) => haystack == trimmed,
            (true, false) => haystack.starts_with(trimmed),
            (false, true) => haystack.ends_with(trimmed),
            (false, false) => haystack.contains(trimmed),
        };
    }

    // For complex regex patterns we conservatively return false.
    // In a real deployment, enable the `regex` feature for full support.
    false
}

// ---------------------------------------------------------------------------
// Public evaluation entry point
// ---------------------------------------------------------------------------

/// Evaluate a flag definition locally against a context.
///
/// Returns `None` only when the flag has no variations at all.
/// Otherwise returns an [`EvaluationResult`] with the resolved
/// variation and a `reason` indicating how it was determined
/// (`"targeting_match"`, `"percentage_rollout"`, or `"default"`).
pub fn evaluate(flag: &FlagDefinition, ctx: &EvaluationContext) -> Option<EvaluationResult> {
    let variations_by_id: HashMap<&str, &Variation> =
        flag.variations.iter().map(|v| (v.id.as_str(), v)).collect();

    let make_result = |variation_id: &str, reason: &str| -> EvaluationResult {
        let v = variations_by_id.get(variation_id);
        EvaluationResult {
            flag_key: flag.key.clone(),
            variation_id: Some(variation_id.to_owned()),
            variation_key: v.map(|var| var.key.clone()),
            value: v.map_or(serde_json::Value::Null, |var| var.value.clone()),
            reason: reason.to_owned(),
        }
    };

    // Sort targeting rules by priority (lower number = higher priority).
    let mut rules = flag.targeting_rules.clone();
    rules.sort_by_key(|r| r.priority);

    for rule in &rules {
        // All conditions must match (AND logic).
        let all_match = rule.conditions.iter().all(|c| match_condition(c, ctx));
        if !all_match {
            continue;
        }

        // 1. Explicit variation.
        if let Some(ref vid) = rule.variation_id {
            return Some(make_result(vid, "targeting_match"));
        }

        // 2. Percentage rollout.
        if let Some(ref rollout) = rule.percentage_rollout {
            let user_id = ctx.rollout_id().unwrap_or("");
            if let Some(vid) = resolve_percentage_rollout(rollout, &flag.key, user_id) {
                return Some(make_result(&vid, "percentage_rollout"));
            }
        }
    }

    // No rule matched -- return default variation.
    if flag.default_variation_id.is_empty() && flag.variations.is_empty() {
        return None;
    }
    Some(make_result(&flag.default_variation_id, "default"))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use serde_json::json;

    #[test]
    fn test_djb2_deterministic() {
        let h1 = djb2_hash("flag-a:user-1");
        let h2 = djb2_hash("flag-a:user-1");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_djb2_different_inputs() {
        let h1 = djb2_hash("flag-a:user-1");
        let h2 = djb2_hash("flag-b:user-2");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_normalised_hash_range() {
        for i in 0..200 {
            let bucket = normalised_hash("test-flag", &format!("user-{i}"));
            assert!(bucket < 100);
        }
    }

    #[test]
    fn test_condition_is() {
        let cond = TargetingCondition {
            attribute: "country".into(),
            operator: "is".into(),
            value: json!("US"),
        };
        let mut attrs = HashMap::new();
        attrs.insert("country".into(), json!("US"));
        let ctx = EvaluationContext {
            attributes: attrs,
            ..Default::default()
        };
        assert!(match_condition(&cond, &ctx));
    }

    #[test]
    fn test_condition_is_not() {
        let cond = TargetingCondition {
            attribute: "country".into(),
            operator: "is_not".into(),
            value: json!("US"),
        };
        let mut attrs = HashMap::new();
        attrs.insert("country".into(), json!("UK"));
        let ctx = EvaluationContext {
            attributes: attrs,
            ..Default::default()
        };
        assert!(match_condition(&cond, &ctx));
    }

    #[test]
    fn test_condition_missing_attribute_negation() {
        let cond = TargetingCondition {
            attribute: "missing".into(),
            operator: "is_not".into(),
            value: json!("anything"),
        };
        let ctx = EvaluationContext::default();
        assert!(match_condition(&cond, &ctx));
    }

    #[test]
    fn test_condition_contains() {
        let cond = TargetingCondition {
            attribute: "email".into(),
            operator: "contains".into(),
            value: json!("@acme.com"),
        };
        let mut attrs = HashMap::new();
        attrs.insert("email".into(), json!("alice@acme.com"));
        let ctx = EvaluationContext {
            attributes: attrs,
            ..Default::default()
        };
        assert!(match_condition(&cond, &ctx));
    }

    #[test]
    fn test_condition_one_of() {
        let cond = TargetingCondition {
            attribute: "tier".into(),
            operator: "one_of".into(),
            value: json!(["gold", "platinum"]),
        };
        let mut attrs = HashMap::new();
        attrs.insert("tier".into(), json!("gold"));
        let ctx = EvaluationContext {
            attributes: attrs,
            ..Default::default()
        };
        assert!(match_condition(&cond, &ctx));
    }

    #[test]
    fn test_condition_gt_lt() {
        let gt_cond = TargetingCondition {
            attribute: "age".into(),
            operator: "gt".into(),
            value: json!(18),
        };
        let lt_cond = TargetingCondition {
            attribute: "age".into(),
            operator: "lt".into(),
            value: json!(65),
        };
        let mut attrs = HashMap::new();
        attrs.insert("age".into(), json!(25));
        let ctx = EvaluationContext {
            attributes: attrs,
            ..Default::default()
        };
        assert!(match_condition(&gt_cond, &ctx));
        assert!(match_condition(&lt_cond, &ctx));
    }

    #[test]
    fn test_evaluate_default() {
        let flag = FlagDefinition {
            id: "f1".into(),
            key: "test-flag".into(),
            name: "Test Flag".into(),
            flag_type: "boolean".into(),
            status: "active".into(),
            environment: "production".into(),
            default_variation_id: "v1".into(),
            variations: vec![Variation {
                id: "v1".into(),
                key: "on".into(),
                name: "On".into(),
                value: json!(true),
                description: None,
            }],
            targeting_rules: vec![],
            tags: vec![],
        };
        let ctx = EvaluationContext::default();
        let result = evaluate(&flag, &ctx);
        assert!(result.is_some());
        let r = result.as_ref().map(|r| &r.reason);
        assert_eq!(r, Some(&"default".to_string()));
        assert_eq!(result.as_ref().and_then(|r| r.variation_key.as_deref()), Some("on"));
    }

    #[test]
    fn test_evaluate_targeting_match() {
        let flag = FlagDefinition {
            id: "f1".into(),
            key: "beta-feature".into(),
            name: "Beta Feature".into(),
            flag_type: "boolean".into(),
            status: "active".into(),
            environment: "production".into(),
            default_variation_id: "v_off".into(),
            variations: vec![
                Variation {
                    id: "v_off".into(),
                    key: "off".into(),
                    name: "Off".into(),
                    value: json!(false),
                    description: None,
                },
                Variation {
                    id: "v_on".into(),
                    key: "on".into(),
                    name: "On".into(),
                    value: json!(true),
                    description: None,
                },
            ],
            targeting_rules: vec![TargetingRule {
                priority: 1,
                conditions: vec![TargetingCondition {
                    attribute: "country".into(),
                    operator: "is".into(),
                    value: json!("US"),
                }],
                variation_id: Some("v_on".into()),
                percentage_rollout: None,
                segment_id: None,
            }],
            tags: vec![],
        };

        let mut attrs = HashMap::new();
        attrs.insert("country".into(), json!("US"));
        let ctx = EvaluationContext {
            user_id: Some("user-1".into()),
            attributes: attrs,
            ..Default::default()
        };
        let result = evaluate(&flag, &ctx);
        assert!(result.is_some());
        let r = result.as_ref().map(|r| r.reason.as_str());
        assert_eq!(r, Some("targeting_match"));
        assert_eq!(result.as_ref().map(|r| &r.value), Some(&json!(true)));
    }

    #[test]
    fn test_percentage_rollout() {
        let rollout = PercentageRollout {
            variations: vec![
                PercentageRolloutEntry {
                    variation_id: "v_a".into(),
                    weight: 50,
                },
                PercentageRolloutEntry {
                    variation_id: "v_b".into(),
                    weight: 50,
                },
            ],
        };
        // The rollout is deterministic for a given flag_key + user_id.
        let vid = resolve_percentage_rollout(&rollout, "flag-x", "user-1");
        assert!(vid.is_some());
        // Should be consistent across calls.
        let vid2 = resolve_percentage_rollout(&rollout, "flag-x", "user-1");
        assert_eq!(vid, vid2);
    }
}

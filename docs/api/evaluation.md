# Flag Evaluation

This document explains how Phase Flag evaluates feature flags, including the targeting engine, percentage rollouts, and the DJB2 hashing algorithm.

## Evaluation Flow

```
Request: evaluate("my-flag", context)
  |
  v
1. Check prerequisites
   |-- Any prerequisite not met? -> return default variation (reason: prerequisite_failed)
   |
2. Check flag status
   |-- Flag inactive/archived? -> return default variation (reason: flag_inactive)
   |
3. Evaluate targeting rules (sorted by priority, ascending)
   |-- For each rule:
   |     |-- Evaluate all conditions (AND logic)
   |     |-- All conditions match?
   |           |-- Direct variation? -> return variation (reason: targeting_match)
   |           |-- Percentage rollout? -> hash user, return variation (reason: percentage_rollout)
   |
4. No rules matched -> return default variation (reason: default)
```

## Targeting Rules

Each flag can have multiple targeting rules, evaluated in priority order (lower number = higher priority).

```json
{
  "targeting_rules": [
    {
      "priority": 1,
      "conditions": [
        {"attribute": "plan", "operator": "is", "value": "enterprise"}
      ],
      "variation_id": "v-on"
    },
    {
      "priority": 2,
      "conditions": [],
      "percentage_rollout": {
        "variations": [
          {"variation_id": "v-on", "weight": 20},
          {"variation_id": "v-off", "weight": 80}
        ]
      }
    }
  ]
}
```

## Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `is` | Exact string match | `plan is "pro"` |
| `is_not` | Not equal | `country is_not "CN"` |
| `contains` | Substring match | `email contains "@company.com"` |
| `not_contains` | No substring | `email not_contains "test"` |
| `one_of` | In list | `country one_of ["US", "CA", "UK"]` |
| `not_one_of` | Not in list | `region not_one_of ["cn-1", "cn-2"]` |
| `gt` | Numeric greater than | `age gt 18` |
| `lt` | Numeric less than | `score lt 100` |
| `matches_regex` | Regex match | `email matches_regex ".*@company\\.com$"` |
| `version_gt` | Semver greater | `app_version version_gt "2.0.0"` |
| `version_lt` | Semver less | `sdk_version version_lt "3.0.0"` |

Missing attributes evaluate to `true` for negation operators (`is_not`, `not_contains`, `not_one_of`) and `false` for all others.

## DJB2 Hashing

Percentage rollouts use DJB2 hashing for deterministic, consistent bucketing.

### Algorithm

```python
def djb2_hash(value: str) -> int:
    h = 5381
    for ch in value:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h

def normalised_hash(flag_key: str, user_id: str) -> int:
    raw = djb2_hash(f"{flag_key}:{user_id}")
    return raw % 100  # Returns 0-99
```

### Properties

- **Deterministic**: Same user + flag always produces the same bucket
- **Uniform**: Buckets are evenly distributed across 0-99
- **Independent**: Changing the flag key redistributes all users
- **Fast**: Simple arithmetic, no cryptographic overhead

### Percentage Rollout Resolution

```python
bucket = normalised_hash(flag_key, user_id)
cumulative = 0
for variation in rollout.variations:
    cumulative += variation.weight
    if bucket < cumulative:
        return variation
```

Example with 20/80 split:
- Users with bucket 0-19 get variation A
- Users with bucket 20-99 get variation B

## Server-Side Evaluation

```bash
POST /api/v1/sdk/evaluate
Content-Type: application/json
X-API-Key: pf_env_...

{
  "flag_key": "new-checkout",
  "context": {
    "user_id": "user-123",
    "plan": "pro",
    "country": "US",
    "app_version": "2.5.0"
  }
}
```

Response:

```json
{
  "variation_id": "abc-123",
  "variation_key": "enabled",
  "value": true,
  "reason": "targeting_match"
}
```

## Batch Evaluation

Evaluate multiple flags in a single request:

```bash
POST /api/v1/sdk/evaluate/batch
Content-Type: application/json
X-API-Key: pf_env_...

{
  "flag_keys": ["new-checkout", "dark-mode", "api-rate-limit"],
  "context": {
    "user_id": "user-123",
    "plan": "pro"
  }
}
```

## Evaluation Explainability

Get a detailed trace of why a flag resolved to a particular value:

```bash
POST /api/v1/evaluation/explain
Content-Type: application/json

{
  "flag_key": "new-checkout",
  "context": {
    "user_id": "user-123",
    "plan": "pro"
  }
}
```

Response includes a `trace` object with per-rule evaluation details:

```json
{
  "variation_key": "enabled",
  "value": true,
  "reason": "targeting_match",
  "trace": {
    "rules_evaluated": 3,
    "matched_rule_index": 0,
    "rule_details": [
      {
        "rule_index": 0,
        "priority": 1,
        "all_conditions_matched": true,
        "conditions": [
          {
            "attribute": "plan",
            "operator": "is",
            "target_value": "pro",
            "actual_value": "pro",
            "matched": true
          }
        ]
      }
    ]
  }
}
```

## SDK Local Evaluation

SDKs download a compiled ruleset and evaluate flags locally:

```bash
GET /api/v1/sdk/ruleset
X-API-Key: pf_env_...
If-None-Match: "abc123"
```

The ruleset contains all flags, variations, and targeting rules needed for local evaluation. SDKs poll for updates on a configurable interval (default: 30 seconds).

The SDK implements the same DJB2 hashing and condition evaluation logic described above to ensure consistent results between local and server-side evaluation.

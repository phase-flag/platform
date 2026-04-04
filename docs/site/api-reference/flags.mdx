---
title: "Flag Management"
description: "Create, read, update, and delete feature flags via the Phase Flag REST API."
---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/flags` | List all flags in an environment |
| `POST` | `/flags` | Create a new feature flag |
| `GET` | `/flags/{flag_id}` | Get a specific flag |
| `PUT` | `/flags/{flag_id}` | Update a flag |
| `DELETE` | `/flags/{flag_id}` | Archive a flag |
| `POST` | `/flags/{flag_id}/toggle` | Enable or disable a flag |
| `GET` | `/flags/{flag_id}/history` | Get audit history for a flag |

All flag endpoints require a JWT token (`Authorization: Bearer <token>`) and an `environment_id` query parameter.

---

## GET /flags

List all feature flags in an environment.

### Request

```bash
curl "https://api.phaseflag.io/api/v1/flags?environment_id=env_abc&page=1&per_page=50" \
  -H "Authorization: Bearer <token>"
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `environment_id` | string | Yes | Environment to list flags for |
| `status` | string | No | Filter by status: `active`, `inactive`, `archived` |
| `flag_type` | string | No | Filter by type: `boolean`, `string`, `number`, `json` |
| `search` | string | No | Full-text search on flag name and key |
| `sort` | string | No | Sort field: `name`, `key`, `created_at`, `updated_at` |
| `order` | string | No | `asc` or `desc` (default: `desc`) |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Items per page (default: 50, max: 200) |

### Response `200 OK`

```json
{
  "data": [
    {
      "id": "flg_01HXKQ4R9C2BVNZFM5T7WE6J8D",
      "key": "new-checkout-flow",
      "name": "New Checkout Flow",
      "description": "Enables the redesigned checkout experience",
      "flag_type": "boolean",
      "status": "active",
      "enabled": true,
      "variations": [
        {"key": "on", "name": "On", "value": true},
        {"key": "off", "name": "Off", "value": false}
      ],
      "default_variation": "off",
      "targeting_rules_count": 2,
      "environment_id": "env_abc",
      "created_at": "2026-04-01T10:00:00Z",
      "updated_at": "2026-04-04T14:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 12
  }
}
```

---

## POST /flags

Create a new feature flag.

### Request

```bash
curl -X POST "https://api.phaseflag.io/api/v1/flags?environment_id=env_abc" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-checkout-flow",
    "name": "New Checkout Flow",
    "description": "Enables the redesigned checkout experience",
    "flag_type": "boolean",
    "variations": [
      {"key": "on", "name": "On", "value": true},
      {"key": "off", "name": "Off", "value": false}
    ],
    "default_variation": "off"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique slug (lowercase, hyphens). Immutable after creation. |
| `name` | string | Yes | Human-readable display name |
| `description` | string | No | Optional description |
| `flag_type` | string | Yes | `boolean`, `string`, `number`, or `json` |
| `variations` | array | Yes | Array of variation objects (see below) |
| `default_variation` | string | Yes | Key of the variation served when no rules match |
| `tags` | array | No | String tags for organization |
| `classification` | string | No | `release`, `experiment`, `ops_killswitch`, `permission`, `migration` |

#### Variation Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique key within this flag |
| `name` | string | Yes | Display name |
| `value` | any | Yes | The value returned for this variation (must match `flag_type`) |

### Response `201 Created`

```json
{
  "data": {
    "id": "flg_01HXKQ4R9C2BVNZFM5T7WE6J8D",
    "key": "new-checkout-flow",
    "name": "New Checkout Flow",
    "description": "Enables the redesigned checkout experience",
    "flag_type": "boolean",
    "status": "active",
    "enabled": false,
    "variations": [
      {"key": "on", "name": "On", "value": true},
      {"key": "off", "name": "Off", "value": false}
    ],
    "default_variation": "off",
    "targeting_rules": [],
    "environment_id": "env_abc",
    "created_at": "2026-04-04T15:00:00Z",
    "updated_at": "2026-04-04T15:00:00Z"
  }
}
```

---

## GET /flags/{flag_id}

Get a single feature flag with all its targeting rules.

### Request

```bash
curl "https://api.phaseflag.io/api/v1/flags/flg_01HXKQ4R9C2BVNZFM5T7WE6J8D?environment_id=env_abc" \
  -H "Authorization: Bearer <token>"
```

### Response `200 OK`

```json
{
  "data": {
    "id": "flg_01HXKQ4R9C2BVNZFM5T7WE6J8D",
    "key": "new-checkout-flow",
    "name": "New Checkout Flow",
    "flag_type": "boolean",
    "status": "active",
    "enabled": true,
    "variations": [
      {"key": "on", "name": "On", "value": true},
      {"key": "off", "name": "Off", "value": false}
    ],
    "default_variation": "off",
    "targeting_rules": [
      {
        "id": "rule_abc123",
        "priority": 1,
        "name": "Beta users",
        "conditions": [
          {"attribute": "plan", "operator": "one_of", "value": ["beta", "enterprise"]}
        ],
        "variation": "on"
      },
      {
        "id": "rule_def456",
        "priority": 2,
        "name": "10% rollout",
        "conditions": [],
        "percentage_rollout": [
          {"variation": "on", "percentage": 10},
          {"variation": "off", "percentage": 90}
        ]
      }
    ]
  }
}
```

---

## PUT /flags/{flag_id}

Update a feature flag's metadata or targeting rules.

### Request

```bash
curl -X PUT "https://api.phaseflag.io/api/v1/flags/flg_01HXKQ4R9C2BVNZFM5T7WE6J8D?environment_id=env_abc" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Checkout Flow (v2)",
    "description": "Updated description",
    "targeting_rules": [
      {
        "priority": 1,
        "name": "Enterprise users",
        "conditions": [
          {"attribute": "plan", "operator": "is", "value": "enterprise"}
        ],
        "variation": "on"
      }
    ]
  }'
```

---

## POST /flags/{flag_id}/toggle

Enable or disable a flag without modifying its targeting rules.

### Request

```bash
curl -X POST "https://api.phaseflag.io/api/v1/flags/flg_01HXKQ4R9C2BVNZFM5T7WE6J8D/toggle?environment_id=env_abc" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Response `200 OK`

```json
{
  "data": {
    "id": "flg_01HXKQ4R9C2BVNZFM5T7WE6J8D",
    "enabled": true,
    "updated_at": "2026-04-04T15:05:00Z"
  }
}
```

---

## DELETE /flags/{flag_id}

Archive a flag (soft delete). Archived flags still appear in the audit log and can be restored.

### Request

```bash
curl -X DELETE "https://api.phaseflag.io/api/v1/flags/flg_01HXKQ4R9C2BVNZFM5T7WE6J8D?environment_id=env_abc" \
  -H "Authorization: Bearer <token>"
```

### Response `204 No Content`

---

## GET /flags/{flag_id}/history

Get the full audit history for a flag.

### Request

```bash
curl "https://api.phaseflag.io/api/v1/flags/flg_01HXKQ4R9C2BVNZFM5T7WE6J8D/history?environment_id=env_abc" \
  -H "Authorization: Bearer <token>"
```

### Response `200 OK`

```json
{
  "data": [
    {
      "id": "evt_01HXKR7M2P3QNZFVM6T8WE9J0E",
      "action": "flag.toggled",
      "actor": {"id": "usr_abc", "email": "alice@example.com"},
      "changes": {"enabled": {"from": false, "to": true}},
      "timestamp": "2026-04-04T15:05:00Z"
    }
  ]
}
```

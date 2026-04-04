# Migrating from LaunchDarkly

This guide walks through migrating your feature flag setup from LaunchDarkly to Phase Flag.

## Overview

| LaunchDarkly Concept | Phase Flag Equivalent |
|---------------------|----------------------|
| Project | Project |
| Environment | Environment |
| Feature Flag | Feature Flag |
| Variation | Variation |
| Targeting Rule | Targeting Rule |
| User Segment | Segment |
| Percentage Rollout | Percentage Rollout |
| Individual User Targeting | Targeting Rule with `is` operator |
| Flag Prerequisite | Prerequisite |
| Custom Role | Role (admin, editor, viewer) |
| Experiment | Experiment |

## Step 1: Export from LaunchDarkly

Export your flags using the LaunchDarkly API:

```bash
# List all flags
curl -H "Authorization: <LD-API-KEY>" \
  https://app.launchdarkly.com/api/v2/flags/<PROJECT-KEY> \
  > ld-flags.json
```

Or use the Phase Flag migration tool:

```bash
python tools/migration-tools/launchdarkly.py \
  --input ld-flags.json \
  --output phaseflag-flags.json
```

## Step 2: Review the Converted Flags

The migration tool converts:

- Flag keys and names (preserved as-is)
- Boolean, string, number, and JSON variations
- Targeting rules with conditions
- Percentage rollouts (weights preserved)
- Individual user targets (converted to targeting rules)
- Flag descriptions and tags

Review `phaseflag-flags.json` to verify the conversion.

## Step 3: Import into Phase Flag

```bash
pfctl import --input phaseflag-flags.json --environment development
```

Or via the API:

```bash
python tools/import-export/importer.py \
  --input phaseflag-flags.json \
  --api-url http://localhost:8000 \
  --api-key pf_xxx
```

## Step 4: Update SDK Integration

### JavaScript

Before (LaunchDarkly):
```javascript
import * as LDClient from 'launchdarkly-js-client-sdk';

const client = LDClient.initialize('CLIENT-SIDE-ID', {
  key: 'user-123',
  custom: { plan: 'pro' },
});

const enabled = client.variation('new-checkout', false);
```

After (Phase Flag):
```javascript
import { PhaseFlagClient } from '@phaseflag/sdk-js';

const client = new PhaseFlagClient({
  apiKey: 'pf_env_...',
  context: { user_id: 'user-123', plan: 'pro' },
});
await client.initialize();

const enabled = client.getBooleanValue('new-checkout', false);
```

### Python

Before:
```python
import ldclient
ldclient.set_config(ldclient.Config("SDK-KEY"))
client = ldclient.get()
enabled = client.variation("new-checkout", {"key": "user-123"}, False)
```

After:
```python
from phaseflag import PhaseFlagClient
client = PhaseFlagClient(api_key="pf_env_...")
client.initialize()
enabled = client.get_boolean_value("new-checkout", default=False,
                                    context={"user_id": "user-123"})
```

### Go

Before:
```go
client, _ := ld.MakeClient("SDK-KEY", 5*time.Second)
enabled, _ := client.BoolVariation("new-checkout", lduser.NewUser("user-123"), false)
```

After:
```go
client, _ := phaseflag.NewClient(phaseflag.Config{APIKey: "pf_env_..."})
enabled := client.GetBooleanValue("new-checkout", false)
```

## Step 5: Run in Parallel

We recommend running both systems in parallel during migration:

1. Keep LaunchDarkly as the source of truth initially
2. Mirror flag changes to Phase Flag using webhooks or the migration tool
3. Switch SDKs to Phase Flag one service at a time
4. Monitor evaluation consistency
5. Decommission LaunchDarkly once all services are migrated

## Key Differences

| Feature | LaunchDarkly | Phase Flag |
|---------|-------------|------------|
| Pricing | Per-seat + MAU | Open source (self-hosted) or per-seat (cloud) |
| Hosting | Cloud only | Self-hosted, cloud, or hybrid |
| Evaluation | Local (SDK) or relay | Local (SDK), relay, or server-side |
| Data residency | Limited regions | Your infrastructure |
| Segments | Synced segments | Local segments (in ruleset) |
| Audit log | Cloud dashboard | API + dashboard |

## Operator Mapping

| LaunchDarkly Operator | Phase Flag Operator |
|----------------------|-------------------|
| `in` | `one_of` |
| `endsWith` | `matches_regex` (with `$` anchor) |
| `startsWith` | `matches_regex` (with `^` anchor) |
| `matches` | `matches_regex` |
| `contains` | `contains` |
| `lessThan` | `lt` |
| `greaterThan` | `gt` |
| `semVerEqual` | `is` (version string) |
| `semVerLessThan` | `version_lt` |
| `semVerGreaterThan` | `version_gt` |

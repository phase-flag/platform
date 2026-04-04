# Migrating from Unleash

This guide covers migrating from Unleash to Phase Flag.

## Concept Mapping

| Unleash Concept | Phase Flag Equivalent |
|----------------|----------------------|
| Project | Project |
| Environment | Environment |
| Feature Toggle | Feature Flag |
| Strategy | Targeting Rule |
| Constraint | Condition |
| Segment | Segment |
| Variant | Variation |
| Gradual Rollout | Percentage Rollout |
| UserID strategy | Targeting rule with `one_of` |
| Activation Strategy | Targeting Rule + Conditions |

## Step 1: Export from Unleash

Export features using the Unleash API:

```bash
curl -H "Authorization: <UNLEASH-API-TOKEN>" \
  https://your-unleash.example.com/api/admin/features \
  > unleash-features.json
```

Or export via the Unleash admin UI (Settings > Export).

## Step 2: Convert

```bash
python tools/migration-tools/unleash.py \
  --input unleash-features.json \
  --output phaseflag-flags.json
```

The converter handles:
- Feature toggle types (release, experiment, operational, kill-switch, permission)
- Gradual rollout strategies (converted to percentage rollouts)
- UserIDs strategy (converted to `one_of` targeting rules)
- Constraints (converted to conditions)
- Variants with weights (converted to variations)
- Tags and descriptions

## Step 3: Import

```bash
pfctl import --input phaseflag-flags.json --environment development
```

## Step 4: Update SDK

### Node.js

Before (Unleash):
```javascript
const { initialize } = require('unleash-client');
const unleash = initialize({
  url: 'https://unleash.example.com/api',
  appName: 'my-app',
  customHeaders: { Authorization: 'API-TOKEN' },
});

if (unleash.isEnabled('new-checkout', { userId: 'user-123' })) {
  // feature enabled
}
```

After (Phase Flag):
```javascript
import { PhaseFlagClient } from '@phaseflag/sdk-js';
const client = new PhaseFlagClient({
  apiKey: 'pf_env_...',
  context: { user_id: 'user-123' },
});
await client.initialize();

if (client.getBooleanValue('new-checkout', false)) {
  // feature enabled
}
```

### Python

Before:
```python
from UnleashClient import UnleashClient
client = UnleashClient(url="https://unleash.example.com/api", app_name="my-app")
client.initialize_client()
enabled = client.is_enabled("new-checkout", {"userId": "user-123"})
```

After:
```python
from phaseflag import PhaseFlagClient
client = PhaseFlagClient(api_key="pf_env_...")
client.initialize()
enabled = client.get_boolean_value("new-checkout", context={"user_id": "user-123"})
```

## Strategy Conversion

| Unleash Strategy | Phase Flag Equivalent |
|-----------------|----------------------|
| `default` (on/off) | Flag with no targeting rules |
| `userWithId` | Targeting rule: `user_id one_of [...]` |
| `gradualRolloutUserId` | Percentage rollout with DJB2 hash |
| `gradualRolloutSessionId` | Percentage rollout (session_id context) |
| `gradualRolloutRandom` | Percentage rollout |
| `remoteAddress` | Targeting rule: `ip_address one_of [...]` |
| `applicationHostname` | Targeting rule: `hostname is "..."` |
| `flexibleRollout` | Percentage rollout with conditions |
| Custom strategy | Targeting rules with conditions |

## Key Differences

| Feature | Unleash | Phase Flag |
|---------|---------|------------|
| Strategy model | Named strategies | Generic targeting rules |
| Toggle types | 5 types | 5 classifications |
| Variants | Separate from toggle | Variations on the flag |
| Metrics | Basic usage | Detailed analytics + experiments |
| Environments | Multi-env | Multi-env with promotion |
| Approval | Enterprise only | Built-in governance |

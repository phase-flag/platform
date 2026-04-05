# Phase Flag — CircleCI Orb

CircleCI orb for gating deployments and managing Phase Flag feature flags in your pipelines.

## Setup

### 1. Set Environment Variables

In your CircleCI project, go to **Project Settings > Environment Variables** and add:

| Variable | Description |
|----------|-------------|
| `PHASEFLAG_API_URL` | API base URL (e.g. `https://api.phaseflag.com`) |
| `PHASEFLAG_API_KEY` | API key with read/write access |

### 2. Reference the Orb

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  phaseflag: phaseflag/flag-check@1.0.0
```

## Usage Examples

### Gate a workflow on a flag

```yaml
version: 2.1

orbs:
  phaseflag: phaseflag/flag-check@1.0.0

workflows:
  deploy:
    jobs:
      - phaseflag/flag-gate:
          flag-key: "enable-new-checkout"
          context: phaseflag-credentials
      - deploy-production:
          requires:
            - phaseflag/flag-gate
```

### Check a flag inside a job

```yaml
jobs:
  deploy:
    docker:
      - image: alpine:3.19
    steps:
      - phaseflag/check-flag:
          flag-key: "enable-new-checkout"
      - run:
          name: Deploy
          command: ./deploy.sh
```

### Toggle a flag after deploy

```yaml
jobs:
  post-deploy:
    docker:
      - image: alpine:3.19
    steps:
      - phaseflag/toggle-flag:
          flag-key: "enable-new-checkout"
          enabled: true
```

### Archive a flag

```yaml
jobs:
  cleanup:
    docker:
      - image: alpine:3.19
    steps:
      - phaseflag/archive-flag:
          flag-key: "enable-new-checkout"
```

## Orb Reference

### Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `check-flag` | `flag-key`, `fail-if-disabled` | Check flag state, optionally fail if disabled |
| `toggle-flag` | `flag-key`, `enabled` | Toggle a flag on or off |
| `archive-flag` | `flag-key` | Archive a flag after full rollout |

### Jobs

| Job | Parameters | Description |
|-----|-----------|-------------|
| `flag-gate` | `flag-key`, `fail-if-disabled` | Standalone gate job for workflow use |

All commands and jobs accept optional `api-url` and `api-key` parameters that default to
`$PHASEFLAG_API_URL` and `$PHASEFLAG_API_KEY` environment variables.

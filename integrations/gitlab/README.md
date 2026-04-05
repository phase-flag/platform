# Phase Flag — GitLab CI Integration

Reusable GitLab CI template for gating deployments and managing feature flags directly from your pipeline.

## Setup

### 1. Add CI/CD Variables

In your GitLab project, go to **Settings > CI/CD > Variables** and add:

| Variable | Description | Protected | Masked |
|----------|-------------|-----------|--------|
| `PHASEFLAG_API_URL` | API base URL (e.g. `https://api.phaseflag.com`) | Yes | No |
| `PHASEFLAG_API_KEY` | API key with read/write access | Yes | Yes |

### 2. Include the Template

```yaml
# .gitlab-ci.yml
include:
  - remote: 'https://raw.githubusercontent.com/phaseflag/integrations/main/gitlab/.gitlab-ci-template.yml'

stages:
  - test
  - deploy
```

## Usage Examples

### Gate a deployment on a flag

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/phaseflag/integrations/main/gitlab/.gitlab-ci-template.yml'

stages:
  - gate
  - deploy

check-feature-flag:
  extends: .phaseflag-check
  stage: gate
  variables:
    PHASEFLAG_FLAG_KEY: "enable-new-checkout"

deploy-production:
  stage: deploy
  script:
    - echo "Deploying to production..."
  needs: [check-feature-flag]
```

### Toggle a flag after deploy

```yaml
enable-flag-after-deploy:
  extends: flag-toggle
  stage: deploy
  variables:
    PHASEFLAG_FLAG_KEY: "enable-new-checkout"
    PHASEFLAG_FLAG_ENABLED: "true"
  needs: [deploy-production]
```

### Archive a flag after full rollout

```yaml
cleanup-flag:
  extends: flag-archive
  stage: deploy
  variables:
    PHASEFLAG_FLAG_KEY: "enable-new-checkout"
```

## Jobs Reference

| Job | Stage | Description |
|-----|-------|-------------|
| `.phaseflag-check` | (template) | Base hidden template — extend to check a flag |
| `flag-check` | `test` | Concrete check job (manual trigger) |
| `flag-toggle` | `deploy` | Toggle a flag on/off (manual trigger) |
| `flag-archive` | `deploy` | Archive a flag after full rollout (manual trigger) |

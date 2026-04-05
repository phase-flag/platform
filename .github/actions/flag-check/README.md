# Phase Flag — flag-check Action

A composite GitHub Action for integrating [Phase Flag](https://phaseflag.com) feature flags directly into your CI/CD pipelines.

## Features

- **Check** whether a flag is enabled before proceeding with a deployment step
- **Toggle** a flag on successful deployment (e.g. enable a kill switch after rollout)
- **Archive** a flag automatically when its feature branch is merged

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-url` | Yes | — | Base URL of the Phase Flag API, e.g. `https://api.phaseflag.com` |
| `api-key` | Yes | — | Phase Flag API key. **Store as a GitHub secret.** |
| `flag-key` | Yes | — | The key/slug of the feature flag to operate on |
| `context` | No | `{}` | JSON evaluation context (userId, plan, region, etc.) |
| `action` | No | `check` | One of: `check`, `toggle`, `archive` |

## Outputs

| Output | Description |
|--------|-------------|
| `enabled` | `true` or `false` — whether the flag is currently enabled (populated for `check`) |
| `value` | Raw flag value or status string from the API |
| `variation` | The default variation ID the flag resolved to |

## Usage Examples

### Check a kill-switch flag before deploying

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Check kill-switch flag
        id: flag
        uses: ./.github/actions/flag-check
        with:
          api-url: ${{ secrets.PHASEFLAG_API_URL }}
          api-key: ${{ secrets.PHASEFLAG_API_KEY }}
          flag-key: kill-switch-payments
          action: check

      - name: Abort if kill switch is active
        if: steps.flag.outputs.enabled == 'true'
        run: |
          echo "Kill switch is ACTIVE — aborting deployment."
          exit 1

      - name: Deploy application
        run: |
          echo "Kill switch is off — proceeding with deployment."
          ./scripts/deploy.sh
```

### Toggle a flag after successful deployment

```yaml
      - name: Enable feature flag post-deploy
        uses: ./.github/actions/flag-check
        with:
          api-url: ${{ secrets.PHASEFLAG_API_URL }}
          api-key: ${{ secrets.PHASEFLAG_API_KEY }}
          flag-key: new-checkout-flow
          action: toggle
```

### Archive a flag when its feature branch is merged

```yaml
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Archive feature flag
        uses: ./.github/actions/flag-check
        with:
          api-url: ${{ secrets.PHASEFLAG_API_URL }}
          api-key: ${{ secrets.PHASEFLAG_API_KEY }}
          flag-key: ${{ github.event.pull_request.head.ref }}-flag
          action: archive
```

## Authentication

Store your Phase Flag API key as a GitHub Actions secret:

1. Go to **Settings → Secrets and variables → Actions** in your repository
2. Add a secret named `PHASEFLAG_API_KEY` with your API key value
3. Add a secret named `PHASEFLAG_API_URL` with your API base URL (e.g. `https://api.phaseflag.com`)

## Publishing to GitHub Marketplace

To publish this action to GitHub Marketplace:

1. Ensure the repository is public
2. Go to **Releases → Create a new release**
3. Check "Publish this Action to the GitHub Marketplace"
4. Choose a semantic version tag (e.g. `v1.0.0`)
5. Publish the release

After publishing, users can reference the action as:

```yaml
uses: phaseflag/flag-check-action@v1
```

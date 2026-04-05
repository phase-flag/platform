# Phase Flag — CI/CD & Editor Integrations

This directory contains official integrations for using Phase Flag in your CI/CD pipelines and development tools.

## Available Integrations

### CI/CD Pipelines

| Integration | Directory | Description |
|-------------|-----------|-------------|
| GitLab CI | [`gitlab/`](./gitlab/) | Reusable GitLab CI template with job templates for flag checks, toggles, and archival |
| CircleCI | [`circleci/`](./circleci/) | CircleCI orb (`phaseflag/flag-check`) with commands and jobs |
| Jenkins | [`jenkins/`](./jenkins/) | Jenkins Shared Library step (`phaseflagCheck`) for Groovy pipelines |

### Editor Extensions

| Integration | Directory | Description |
|-------------|-----------|-------------|
| VS Code | [`vscode/`](./vscode/) | VS Code extension with inline decorations, hover details, and code lens |

## Common Patterns

All CI/CD integrations support the same three core operations:

1. **Check** — Verify a flag's current state and gate a pipeline step
2. **Toggle** — Enable or disable a flag after a successful deploy
3. **Archive** — Soft-delete a flag after a feature is fully rolled out

### Required Configuration

All integrations require:

| Variable | Description |
|----------|-------------|
| `PHASEFLAG_API_URL` | API base URL (e.g. `https://api.phaseflag.com`) |
| `PHASEFLAG_API_KEY` | API key with appropriate scopes |

## Quick Links

- [GitLab CI Integration](./gitlab/README.md)
- [CircleCI Orb](./circleci/README.md)
- [Jenkins Shared Library](./jenkins/README.md)
- [VS Code Extension](./vscode/README.md)
- [Phase Flag Documentation](https://docs.phaseflag.com)
- [API Reference](https://docs.phaseflag.com/api-reference)

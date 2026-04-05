# Phase Flag — VS Code Extension

See your feature flags inline as you code. The Phase Flag extension connects to the Phase Flag API and decorates flag key references with live status indicators, hover details, and code lens counts.

## Features

### Inline Decorations

A green dot (`●`) or red dot (`●`) appears after every flag key string in your code:

```typescript
// Green dot = flag is enabled
client.booleanValue('enable-new-checkout')  ●

// Red dot = flag is disabled
client.booleanValue('old-payment-flow')     ●

// Grey hollow dot = flag key not found in API
client.booleanValue('unknown-flag')         ○
```

> Screenshot: `media/decorations.png` _(placeholder)_

### Hover Details

Hover over any flag key string to see:

- Current status (enabled / disabled)
- Flag type and variations
- Description
- Evaluation count
- Tags
- Last modified date

> Screenshot: `media/hover.png` _(placeholder)_

### Code Lens

A code lens appears above each flag usage line showing the current state and evaluation count:

```
Phase Flag: ● enabled · 42,301 evals
client.booleanValue('enable-new-checkout')
```

> Screenshot: `media/codelens.png` _(placeholder)_

## Supported Languages & SDK Patterns

| Language | Detected Patterns |
|----------|------------------|
| JavaScript / TypeScript | `client.booleanValue('key')`, `useFeatureFlag('key')`, `isFeatureEnabled('key')`, `getFlag('key')` |
| Python | `client.boolean_value('key')`, `client.string_value('key')`, `is_enabled('key')` |
| Go | `client.BooleanValue(ctx, "key")`, `client.StringValue(ctx, "key")` |
| Java | `client.booleanValue("key")`, `client.stringValue("key")` |

## Installation

### From the Marketplace

Search for **Phase Flag** in the VS Code Extensions panel (Ctrl+Shift+X / Cmd+Shift+X).

### From VSIX

```bash
code --install-extension phaseflag-0.1.0.vsix
```

## Configuration

Open VS Code Settings (Ctrl+, / Cmd+,) and search for **Phase Flag**:

| Setting | Default | Description |
|---------|---------|-------------|
| `phaseflag.apiUrl` | `https://api.phaseflag.com` | Phase Flag API base URL |
| `phaseflag.apiKey` | _(empty)_ | API key (store in user settings, not workspace) |
| `phaseflag.enableDecorations` | `true` | Show inline green/red dots |
| `phaseflag.enableCodeLens` | `true` | Show code lens with evaluation counts |
| `phaseflag.cacheTtlSeconds` | `60` | How long to cache flag data |

### Example user settings.json

```json
{
  "phaseflag.apiUrl": "https://api.phaseflag.com",
  "phaseflag.apiKey": "pfk_your_api_key_here",
  "phaseflag.enableDecorations": true,
  "phaseflag.enableCodeLens": true,
  "phaseflag.cacheTtlSeconds": 30
}
```

## Commands

| Command | Description |
|---------|-------------|
| `Phase Flag: Refresh Flags` | Invalidate cache and re-fetch all flags |
| `Phase Flag: Show Flag Details` | Show details for a flag in a quick pick panel |
| `Phase Flag: Open in Dashboard` | Open the flag in the Phase Flag web dashboard |

## Building from Source

```bash
cd integrations/vscode
npm install
npm run build
```

To package as a VSIX:

```bash
npm install -g @vscode/vsce
vsce package
```

## Development

```bash
# Watch mode (recompiles on change)
npm run watch

# Open in VS Code and press F5 to launch the Extension Development Host
code .
```

## License

MIT — see [LICENSE](../../LICENSE)

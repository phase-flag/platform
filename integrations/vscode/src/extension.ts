/**
 * Phase Flag VS Code Extension — entry point.
 *
 * Provides:
 *  - Inline decorations: green/red dot next to flag string literals
 *  - Hover provider: flag details (description, variations, last modified)
 *  - Code lens: evaluation count above flag usage
 *  - Command: phaseflag.refreshFlags
 *  - Command: phaseflag.showFlagDetails
 *  - Command: phaseflag.openInDashboard
 */

import * as vscode from "vscode";
import { PhaseFlagApiClient, Flag } from "./api";

// ---------------------------------------------------------------------------
// SDK usage patterns that reference a flag key by string literal.
// Each regex must have one capturing group for the flag key value.
// ---------------------------------------------------------------------------
const FLAG_PATTERNS: Record<string, RegExp[]> = {
  javascript: [
    /client\.booleanValue\(\s*['"]([^'"]+)['"]/g,
    /client\.stringValue\(\s*['"]([^'"]+)['"]/g,
    /client\.numberValue\(\s*['"]([^'"]+)['"]/g,
    /useFeatureFlag\(\s*['"]([^'"]+)['"]/g,
    /isFeatureEnabled\(\s*['"]([^'"]+)['"]/g,
    /getFlag\(\s*['"]([^'"]+)['"]/g,
  ],
  typescript: [
    /client\.booleanValue\(\s*['"`]([^'"`]+)['"`]/g,
    /client\.stringValue\(\s*['"`]([^'"`]+)['"`]/g,
    /client\.numberValue\(\s*['"`]([^'"`]+)['"`]/g,
    /useFeatureFlag\(\s*['"`]([^'"`]+)['"`]/g,
    /isFeatureEnabled\(\s*['"`]([^'"`]+)['"`]/g,
    /getFlag\(\s*['"`]([^'"`]+)['"`]/g,
  ],
  python: [
    /client\.boolean_value\(\s*['"]([^'"]+)['"]/g,
    /client\.string_value\(\s*['"]([^'"]+)['"]/g,
    /client\.number_value\(\s*['"]([^'"]+)['"]/g,
    /get_flag\(\s*['"]([^'"]+)['"]/g,
    /is_enabled\(\s*['"]([^'"]+)['"]/g,
  ],
  go: [
    /client\.BooleanValue\(\s*ctx,\s*"([^"]+)"/g,
    /client\.StringValue\(\s*ctx,\s*"([^"]+)"/g,
    /client\.NumberValue\(\s*ctx,\s*"([^"]+)"/g,
    /GetFlag\(\s*"([^"]+)"/g,
  ],
  java: [
    /client\.booleanValue\(\s*"([^"]+)"/g,
    /client\.stringValue\(\s*"([^"]+)"/g,
    /client\.numberValue\(\s*"([^"]+)"/g,
    /getFlag\(\s*"([^"]+)"/g,
  ],
};

// Map VS Code language IDs to our pattern groups.
const LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript",
  javascriptreact: "javascript",
  typescript: "typescript",
  typescriptreact: "typescript",
  python: "python",
  go: "go",
  java: "java",
};

// ---------------------------------------------------------------------------
// Decoration types
// ---------------------------------------------------------------------------

function createDecorationTypes(): {
  enabled: vscode.TextEditorDecorationType;
  disabled: vscode.TextEditorDecorationType;
  unknown: vscode.TextEditorDecorationType;
} {
  return {
    enabled: vscode.window.createTextEditorDecorationType({
      after: {
        contentText: " ●",
        color: new vscode.ThemeColor("charts.green"),
        fontStyle: "normal",
      },
    }),
    disabled: vscode.window.createTextEditorDecorationType({
      after: {
        contentText: " ●",
        color: new vscode.ThemeColor("charts.red"),
        fontStyle: "normal",
      },
    }),
    unknown: vscode.window.createTextEditorDecorationType({
      after: {
        contentText: " ○",
        color: new vscode.ThemeColor("disabledForeground"),
        fontStyle: "normal",
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Flag reference found in a document
// ---------------------------------------------------------------------------

interface FlagReference {
  flagKey: string;
  range: vscode.Range;
}

// ---------------------------------------------------------------------------
// Parse a document and extract all flag references
// ---------------------------------------------------------------------------

function findFlagReferences(document: vscode.TextDocument): FlagReference[] {
  const languageKey = LANGUAGE_MAP[document.languageId];
  if (!languageKey) {
    return [];
  }

  const patterns = FLAG_PATTERNS[languageKey] ?? [];
  const text = document.getText();
  const refs: FlagReference[] = [];

  for (const pattern of patterns) {
    // Reset lastIndex to scan from the start.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const flagKey = match[1];
      if (!flagKey) {
        continue;
      }

      // Position of the flag key string (the captured group, not the whole match).
      const matchStart = match.index + match[0].indexOf(flagKey);
      const startPos = document.positionAt(matchStart);
      const endPos = document.positionAt(matchStart + flagKey.length);

      refs.push({
        flagKey,
        range: new vscode.Range(startPos, endPos),
      });
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Hover provider — shows flag details on hover over a flag key string
// ---------------------------------------------------------------------------

class PhaseFlagHoverProvider implements vscode.HoverProvider {
  constructor(private readonly client: PhaseFlagApiClient) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const refs = findFlagReferences(document);
    const ref = refs.find((r) => r.range.contains(position));
    if (!ref) {
      return undefined;
    }

    if (!this.client.isConfigured()) {
      const md = new vscode.MarkdownString(
        "**Phase Flag** — Not configured. Set `phaseflag.apiUrl` and `phaseflag.apiKey` in settings."
      );
      return new vscode.Hover(md, ref.range);
    }

    try {
      const flag = await this.client.getFlag(ref.flagKey);
      if (!flag) {
        const md = new vscode.MarkdownString(
          `**Phase Flag**: \`${ref.flagKey}\` — Flag not found in the API.`
        );
        return new vscode.Hover(md, ref.range);
      }

      return new vscode.Hover(buildFlagHoverMarkdown(flag), ref.range);
    } catch {
      const md = new vscode.MarkdownString(
        `**Phase Flag**: \`${ref.flagKey}\` — Error fetching flag details.`
      );
      return new vscode.Hover(md, ref.range);
    }
  }
}

function buildFlagHoverMarkdown(flag: Flag): vscode.MarkdownString {
  const statusIcon = flag.enabled ? "🟢" : "🔴";
  const statusText = flag.enabled ? "Enabled" : "Disabled";

  const lines: string[] = [
    `**Phase Flag** — \`${flag.key}\``,
    "",
    `${statusIcon} **${statusText}** | Type: \`${flag.type}\``,
    "",
  ];

  if (flag.name && flag.name !== flag.key) {
    lines.push(`**Name:** ${flag.name}`, "");
  }
  if (flag.description) {
    lines.push(`**Description:** ${flag.description}`, "");
  }
  if (flag.variations && flag.variations.length > 0) {
    lines.push("**Variations:**");
    for (const v of flag.variations) {
      lines.push(`- \`${v.key}\`: \`${JSON.stringify(v.value)}\`${v.description ? ` — ${v.description}` : ""}`);
    }
    lines.push("");
  }
  if (flag.evaluationCount !== undefined) {
    lines.push(`**Evaluations:** ${flag.evaluationCount.toLocaleString()}`, "");
  }
  if (flag.tags && flag.tags.length > 0) {
    lines.push(`**Tags:** ${flag.tags.map((t) => `\`${t}\``).join(", ")}`, "");
  }
  if (flag.updatedAt) {
    const updated = new Date(flag.updatedAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    lines.push(`**Last modified:** ${updated}`);
  }

  const md = new vscode.MarkdownString(lines.join("\n"));
  md.isTrusted = true;
  return md;
}

// ---------------------------------------------------------------------------
// Code Lens provider — shows evaluation count above flag usage lines
// ---------------------------------------------------------------------------

class PhaseFlagCodeLensProvider implements vscode.CodeLensProvider {
  private readonly onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  constructor(private readonly client: PhaseFlagApiClient) {}

  refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration("phaseflag");
    if (!config.get<boolean>("enableCodeLens", true)) {
      return [];
    }
    if (!this.client.isConfigured()) {
      return [];
    }

    const refs = findFlagReferences(document);
    if (refs.length === 0) {
      return [];
    }

    let flagsMap: Map<string, Flag>;
    try {
      flagsMap = await this.client.getFlagsMap();
    } catch {
      return [];
    }

    // Deduplicate by line — one lens per line even if multiple refs exist.
    const byLine = new Map<number, FlagReference>();
    for (const ref of refs) {
      if (!byLine.has(ref.range.start.line)) {
        byLine.set(ref.range.start.line, ref);
      }
    }

    const lenses: vscode.CodeLens[] = [];

    for (const ref of byLine.values()) {
      const flag = flagsMap.get(ref.flagKey);
      const lensRange = new vscode.Range(ref.range.start.line, 0, ref.range.start.line, 0);

      if (!flag) {
        lenses.push(
          new vscode.CodeLens(lensRange, {
            title: `Phase Flag: '${ref.flagKey}' — not found`,
            command: "phaseflag.showFlagDetails",
            arguments: [ref.flagKey],
          })
        );
        continue;
      }

      const statusIcon = flag.enabled ? "●" : "○";
      const statusText = flag.enabled ? "enabled" : "disabled";
      const evalText =
        flag.evaluationCount !== undefined
          ? ` · ${flag.evaluationCount.toLocaleString()} evals`
          : "";

      lenses.push(
        new vscode.CodeLens(lensRange, {
          title: `Phase Flag: ${statusIcon} ${statusText}${evalText}`,
          command: "phaseflag.showFlagDetails",
          arguments: [ref.flagKey],
        })
      );
    }

    return lenses;
  }
}

// ---------------------------------------------------------------------------
// Decoration applier — applies enabled/disabled/unknown decorations
// ---------------------------------------------------------------------------

class DecorationApplier {
  private decorations = createDecorationTypes();

  constructor(private readonly client: PhaseFlagApiClient) {}

  async applyToEditor(editor: vscode.TextEditor): Promise<void> {
    const config = vscode.workspace.getConfiguration("phaseflag");
    if (!config.get<boolean>("enableDecorations", true)) {
      this.clear(editor);
      return;
    }
    if (!this.client.isConfigured()) {
      return;
    }

    const refs = findFlagReferences(editor.document);
    if (refs.length === 0) {
      this.clear(editor);
      return;
    }

    let flagsMap: Map<string, Flag>;
    try {
      flagsMap = await this.client.getFlagsMap();
    } catch {
      return;
    }

    const enabledRanges: vscode.DecorationOptions[] = [];
    const disabledRanges: vscode.DecorationOptions[] = [];
    const unknownRanges: vscode.DecorationOptions[] = [];

    for (const ref of refs) {
      const flag = flagsMap.get(ref.flagKey);
      // Decorate the end of the matched range (after the closing quote).
      const decorationRange = new vscode.Range(ref.range.end, ref.range.end);

      if (!flag) {
        unknownRanges.push({ range: decorationRange });
      } else if (flag.enabled) {
        enabledRanges.push({ range: decorationRange });
      } else {
        disabledRanges.push({ range: decorationRange });
      }
    }

    editor.setDecorations(this.decorations.enabled, enabledRanges);
    editor.setDecorations(this.decorations.disabled, disabledRanges);
    editor.setDecorations(this.decorations.unknown, unknownRanges);
  }

  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorations.enabled, []);
    editor.setDecorations(this.decorations.disabled, []);
    editor.setDecorations(this.decorations.unknown, []);
  }

  dispose(): void {
    this.decorations.enabled.dispose();
    this.decorations.disabled.dispose();
    this.decorations.unknown.dispose();
  }

  /**
   * Recreate decoration types (e.g. after theme change).
   */
  recreate(): void {
    this.decorations.enabled.dispose();
    this.decorations.disabled.dispose();
    this.decorations.unknown.dispose();
    this.decorations = createDecorationTypes();
  }
}

// ---------------------------------------------------------------------------
// Extension activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration("phaseflag");

  // Build the API client from current configuration.
  const client = new PhaseFlagApiClient({
    apiUrl: config.get<string>("apiUrl", "https://api.phaseflag.com"),
    apiKey: config.get<string>("apiKey", ""),
    cacheTtlMs: config.get<number>("cacheTtlSeconds", 60) * 1000,
  });

  const decorationApplier = new DecorationApplier(client);
  const codeLensProvider = new PhaseFlagCodeLensProvider(client);
  const hoverProvider = new PhaseFlagHoverProvider(client);

  // Supported language selectors
  const SUPPORTED_LANGUAGES: vscode.DocumentSelector = [
    { language: "javascript" },
    { language: "javascriptreact" },
    { language: "typescript" },
    { language: "typescriptreact" },
    { language: "python" },
    { language: "go" },
    { language: "java" },
  ];

  // Register hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(SUPPORTED_LANGUAGES, hoverProvider)
  );

  // Register code lens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(SUPPORTED_LANGUAGES, codeLensProvider)
  );

  // Apply decorations to the active editor on activation.
  if (vscode.window.activeTextEditor) {
    void decorationApplier.applyToEditor(vscode.window.activeTextEditor);
  }

  // Re-apply decorations when the active editor changes.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        void decorationApplier.applyToEditor(editor);
      }
    })
  );

  // Re-apply decorations when document content changes (debounced).
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          void decorationApplier.applyToEditor(editor);
          codeLensProvider.refresh();
        }, 500);
      }
    })
  );

  // Reload configuration when settings change.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("phaseflag")) {
        const updated = vscode.workspace.getConfiguration("phaseflag");
        client.updateOptions({
          apiUrl: updated.get<string>("apiUrl", "https://api.phaseflag.com"),
          apiKey: updated.get<string>("apiKey", ""),
          cacheTtlMs: updated.get<number>("cacheTtlSeconds", 60) * 1000,
        });
        decorationApplier.recreate();
        codeLensProvider.refresh();
        if (vscode.window.activeTextEditor) {
          void decorationApplier.applyToEditor(vscode.window.activeTextEditor);
        }
      }
    })
  );

  // Command: refresh flags (invalidate cache and re-apply decorations)
  context.subscriptions.push(
    vscode.commands.registerCommand("phaseflag.refreshFlags", async () => {
      client.invalidateCache();
      codeLensProvider.refresh();
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await decorationApplier.applyToEditor(editor);
      }
      void vscode.window.showInformationMessage("Phase Flag: flags refreshed.");
    })
  );

  // Command: show flag details in an output channel / quick pick
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "phaseflag.showFlagDetails",
      async (flagKey?: string) => {
        // If called from the command palette without an argument, prompt for the key.
        if (!flagKey) {
          flagKey = await vscode.window.showInputBox({
            prompt: "Enter the flag key",
            placeHolder: "e.g. enable-new-checkout",
          });
        }
        if (!flagKey) {
          return;
        }

        if (!client.isConfigured()) {
          void vscode.window.showWarningMessage(
            "Phase Flag: Configure phaseflag.apiUrl and phaseflag.apiKey in settings."
          );
          return;
        }

        try {
          const flag = await client.getFlag(flagKey);
          if (!flag) {
            void vscode.window.showWarningMessage(`Phase Flag: Flag '${flagKey}' not found.`);
            return;
          }

          // Show details in a quick pick (read-only info list).
          const details: vscode.QuickPickItem[] = [
            { label: "Key", description: flag.key },
            { label: "Name", description: flag.name },
            { label: "Status", description: flag.enabled ? "Enabled" : "Disabled" },
            { label: "Type", description: flag.type },
            ...(flag.description ? [{ label: "Description", description: flag.description }] : []),
            ...(flag.evaluationCount !== undefined
              ? [{ label: "Evaluations", description: flag.evaluationCount.toLocaleString() }]
              : []),
            { label: "Updated", description: new Date(flag.updatedAt).toLocaleString() },
          ];

          await vscode.window.showQuickPick(details, {
            title: `Phase Flag — ${flag.key}`,
            placeHolder: "Flag details (read-only)",
          });
        } catch (err) {
          void vscode.window.showErrorMessage(
            `Phase Flag: Error fetching flag '${flagKey}': ${String(err)}`
          );
        }
      }
    )
  );

  // Command: open flag in dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "phaseflag.openInDashboard",
      (flagKey?: string) => {
        const apiUrl = config.get<string>("apiUrl", "https://api.phaseflag.com");
        // Derive dashboard URL from API URL
        const dashboardBase = apiUrl
          .replace("api.", "app.")
          .replace(":8000", ":3000");
        const url = flagKey
          ? `${dashboardBase}/flags/${encodeURIComponent(flagKey)}`
          : `${dashboardBase}/flags`;
        void vscode.env.openExternal(vscode.Uri.parse(url));
      }
    )
  );

  // Dispose decoration applier on deactivation.
  context.subscriptions.push({
    dispose: () => decorationApplier.dispose(),
  });
}

// ---------------------------------------------------------------------------
// Extension deactivation
// ---------------------------------------------------------------------------

export function deactivate(): void {
  // All disposables are registered on context.subscriptions and will be
  // cleaned up automatically by VS Code.
}

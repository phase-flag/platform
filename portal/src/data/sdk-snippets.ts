/**
 * SDK installation and initialization code snippets for each supported language.
 * The placeholder {{API_KEY}} is replaced at runtime with the user's real API key.
 */

export interface SdkSnippet {
  id: string;
  label: string;
  icon: string;
  install: string;
  init: string;
  evaluate: string;
}

export const SDK_SNIPPETS: SdkSnippet[] = [
  {
    id: 'javascript',
    label: 'JavaScript / TypeScript',
    icon: 'JS',
    install: 'npm install @phaseflag/js-sdk',
    init: `import { PhaseFlagClient } from '@phaseflag/js-sdk';

const client = new PhaseFlagClient({ apiKey: '{{API_KEY}}' });
await client.init();`,
    evaluate: `const isEnabled = await client.boolVariation('my-first-flag', false);
console.log('Flag value:', isEnabled);`,
  },
  {
    id: 'python',
    label: 'Python',
    icon: 'PY',
    install: 'pip install phaseflag-sdk',
    init: `from phaseflag import PhaseFlagClient

client = PhaseFlagClient(api_key='{{API_KEY}}')
client.init()`,
    evaluate: `is_enabled = client.bool_variation('my-first-flag', False)
print('Flag value:', is_enabled)`,
  },
  {
    id: 'go',
    label: 'Go',
    icon: 'GO',
    install: 'go get github.com/phaseflag/go-sdk',
    init: `import phaseflag "github.com/phaseflag/go-sdk"

client := phaseflag.NewClient(phaseflag.Options{
    APIKey: "{{API_KEY}}",
})
client.Init()`,
    evaluate: `isEnabled := client.BoolVariation("my-first-flag", false)
fmt.Println("Flag value:", isEnabled)`,
  },
  {
    id: 'react',
    label: 'React',
    icon: 'RE',
    install: 'npm install @phaseflag/react',
    init: `import { PhaseFlagProvider, useFlag } from '@phaseflag/react';

// Wrap your app root:
<PhaseFlagProvider apiKey="{{API_KEY}}">
  <App />
</PhaseFlagProvider>`,
    evaluate: `function MyComponent() {
  const isEnabled = useFlag('my-first-flag', false);
  return <div>{isEnabled ? 'Feature ON' : 'Feature OFF'}</div>;
}`,
  },
  {
    id: 'java',
    label: 'Java',
    icon: 'JA',
    install: 'implementation "io.phaseflag:phaseflag-sdk:1.0.0"',
    init: `import io.phaseflag.PhaseFlagClient;

PhaseFlagClient client = new PhaseFlagClient.Builder()
    .apiKey("{{API_KEY}}")
    .build();
client.init();`,
    evaluate: `boolean isEnabled = client.boolVariation("my-first-flag", false);
System.out.println("Flag value: " + isEnabled);`,
  },
];

export function getSnippetWithKey(snippet: SdkSnippet, apiKey: string): SdkSnippet {
  const replace = (s: string) => s.replace(/\{\{API_KEY\}\}/g, apiKey || 'YOUR_API_KEY');
  return {
    ...snippet,
    init: replace(snippet.init),
    evaluate: replace(snippet.evaluate),
  };
}

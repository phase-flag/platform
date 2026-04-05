import { useState } from 'react';

interface SDKSnippet {
  id: string;
  name: string;
  language: string;
  icon: string;
  install: string;
  code: string;
}

const sdks: SDKSnippet[] = [
  {
    id: 'javascript',
    name: 'JavaScript / Node.js',
    language: 'javascript',
    icon: 'JS',
    install: 'npm install @phaseflag/sdk-js',
    code: `import { PhaseFlag } from '@phaseflag/sdk-js';

const client = new PhaseFlag({
  sdkKey: 'your-sdk-key',
  // Optional: bootstrap from file for instant startup
  // bootstrap: require('./phaseflag-bootstrap.json'),
});

await client.waitForInitialization();

const user = {
  key: 'user_123',
  email: 'alice@example.com',
  custom: { plan: 'enterprise', country: 'US' },
};

// Evaluate a boolean flag
const showFeature = client.boolVariation('new_checkout', user, false);

if (showFeature) {
  renderNewCheckout();
} else {
  renderClassicCheckout();
}

// Listen for real-time updates
client.on('change', (key) => {
  console.log(\`Flag \${key} updated\`);
});`,
  },
  {
    id: 'python',
    name: 'Python',
    language: 'python',
    icon: 'PY',
    install: 'pip install phaseflag-sdk',
    code: `from phaseflag import PhaseFlag

client = PhaseFlag(sdk_key="your-sdk-key")
client.wait_for_initialization()

user = {
    "key": "user_123",
    "email": "alice@example.com",
    "custom": {"plan": "enterprise", "country": "US"},
}

# Evaluate a boolean flag
show_feature = client.bool_variation("new_checkout", user, False)

if show_feature:
    render_new_checkout()
else:
    render_classic_checkout()

# Get evaluation details
detail = client.bool_variation_detail("new_checkout", user, False)
print(f"Value: {detail.value}, Reason: {detail.reason}")`,
  },
  {
    id: 'go',
    name: 'Go',
    language: 'go',
    icon: 'GO',
    install: 'go get github.com/phaseflag/sdk-go',
    code: `package main

import (
    "context"
    "fmt"
    pf "github.com/phaseflag/sdk-go"
)

func main() {
    client, err := pf.NewClient("your-sdk-key")
    if err != nil {
        panic(err)
    }
    defer client.Close()

    client.WaitForInitialization(context.Background())

    user := pf.User{
        Key:   "user_123",
        Email: "alice@example.com",
        Custom: map[string]interface{}{
            "plan":    "enterprise",
            "country": "US",
        },
    }

    showFeature := client.BoolVariation("new_checkout", user, false)

    if showFeature {
        fmt.Println("Showing new checkout")
    }
}`,
  },
  {
    id: 'java',
    name: 'Java',
    language: 'java',
    icon: 'JV',
    install: `<dependency>
  <groupId>dev.phaseflag</groupId>
  <artifactId>sdk-java</artifactId>
  <version>1.0.0</version>
</dependency>`,
    code: `import dev.phaseflag.sdk.PhaseFlag;
import dev.phaseflag.sdk.User;

PhaseFlag client = PhaseFlag.builder()
    .sdkKey("your-sdk-key")
    .build();

client.waitForInitialization();

User user = User.builder("user_123")
    .email("alice@example.com")
    .custom("plan", "enterprise")
    .custom("country", "US")
    .build();

boolean showFeature = client.boolVariation("new_checkout", user, false);

if (showFeature) {
    renderNewCheckout();
}

// Clean up
client.close();`,
  },
  {
    id: 'react',
    name: 'React',
    language: 'tsx',
    icon: 'RX',
    install: 'npm install @phaseflag/react',
    code: `import { PhaseFlagProvider, useFlag, useFlags } from '@phaseflag/react';

// Wrap your app
function App() {
  return (
    <PhaseFlagProvider
      sdkKey="your-client-sdk-key"
      user={{ key: 'user_123', email: 'alice@example.com' }}
    >
      <MyComponent />
    </PhaseFlagProvider>
  );
}

function MyComponent() {
  // Simple boolean flag
  const showNewUI = useFlag('new_ui', false);

  // Flag with full details
  const { value, reason } = useFlags('banner_text', 'Welcome!');

  return (
    <div>
      {showNewUI ? <NewDashboard /> : <ClassicDashboard />}
      <Banner text={value} />
    </div>
  );
}`,
  },
  {
    id: 'dotnet',
    name: '.NET / C#',
    language: 'csharp',
    icon: 'C#',
    install: 'dotnet add package PhaseFlag.Sdk',
    code: `using PhaseFlag.Sdk;

var client = new PhaseFlagClient("your-sdk-key");
await client.WaitForInitializationAsync();

var user = new User("user_123")
{
    Email = "alice@example.com",
    Custom = new Dictionary<string, object>
    {
        ["plan"] = "enterprise",
        ["country"] = "US"
    }
};

bool showFeature = client.BoolVariation("new_checkout", user, false);

if (showFeature)
{
    RenderNewCheckout();
}

// Get detailed evaluation
var detail = client.BoolVariationDetail("new_checkout", user, false);
Console.WriteLine($"Value: {detail.Value}, Reason: {detail.Reason}");`,
  },
  {
    id: 'rust',
    name: 'Rust',
    language: 'rust',
    icon: 'RS',
    install: 'cargo add phaseflag',
    code: `use phaseflag::{Client, User};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new("your-sdk-key").await?;
    client.wait_for_initialization().await;

    let user = User::builder("user_123")
        .email("alice@example.com")
        .custom("plan", "enterprise")
        .custom("country", "US")
        .build();

    let show_feature = client.bool_variation("new_checkout", &user, false);

    if show_feature {
        println!("Showing new checkout");
    }

    Ok(())
}`,
  },
  {
    id: 'swift',
    name: 'Swift (iOS)',
    language: 'swift',
    icon: 'SW',
    install: '.package(url: "https://github.com/phaseflag/swift-sdk", from: "1.0.0")',
    code: `import PhaseFlag

let client = try PhaseFlagClient(sdkKey: "your-mobile-sdk-key")
try await client.waitForInitialization()

let user = PFUser(
    key: "user_123",
    email: "alice@example.com",
    custom: ["plan": "enterprise", "country": "US"]
)

let showFeature = client.boolVariation(
    "new_checkout",
    user: user,
    defaultValue: false
)

if showFeature {
    showNewCheckoutView()
}`,
  },
];

export default function SDKDemo() {
  const [activeSDK, setActiveSDK] = useState('javascript');
  const [copied, setCopied] = useState<string | null>(null);

  const sdk = sdks.find((s) => s.id === activeSDK)!;

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-light uppercase tracking-wider text-[#E8F0F2] mb-3">
          SDK Integration
        </h1>
        <p className="text-[#8FA3AD] max-w-2xl leading-relaxed">
          Phase Flag provides SDKs for 19 platforms. Select a language to see installation
          instructions and usage examples. All code is copy-paste ready.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SDK selector */}
        <div className="lg:col-span-1">
          <h3 className="font-heading text-xs font-medium uppercase tracking-wider text-[#8FA3AD] mb-3 px-1">
            Select SDK
          </h3>
          <div className="space-y-1">
            {sdks.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSDK(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors ${
                  activeSDK === s.id
                    ? 'bg-pf-primary/10 text-pf-primary'
                    : 'text-[#8FA3AD] hover:text-[#E8F0F2] hover:bg-white/5'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-mono font-bold ${
                  activeSDK === s.id
                    ? 'bg-pf-primary text-white'
                    : 'bg-[#1E1B4B] text-[#8FA3AD]'
                }`}>
                  {s.icon}
                </span>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Code display */}
        <div className="lg:col-span-3 space-y-4">
          {/* Install command */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading text-xs font-medium uppercase tracking-wider text-[#8FA3AD]">
                Installation
              </h3>
              <button
                onClick={() => copyToClipboard(sdk.install, 'install')}
                className="text-xs text-pf-primary hover:text-pf-primary-light transition-colors flex items-center gap-1"
              >
                {copied === 'install' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="code-block p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">{sdk.install}</pre>
            </div>
          </div>

          {/* Usage code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading text-xs font-medium uppercase tracking-wider text-[#8FA3AD]">
                Usage
              </h3>
              <button
                onClick={() => copyToClipboard(sdk.code, 'code')}
                className="text-xs text-pf-primary hover:text-pf-primary-light transition-colors flex items-center gap-1"
              >
                {copied === 'code' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="code-block p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">{sdk.code}</pre>
            </div>
          </div>

          {/* SDK info */}
          <div className="bg-pf-primary/5 border border-pf-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-pf-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-[#E8F0F2]">
                <p className="font-medium mb-1">All SDKs include:</p>
                <ul className="text-[#8FA3AD] space-y-0.5">
                  <li>Local evaluation (sub-millisecond, no network calls)</li>
                  <li>Streaming updates via SSE</li>
                  <li>Offline mode with bootstrap files</li>
                  <li>Flag mocking for tests</li>
                  <li>TypeScript definitions (where applicable)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

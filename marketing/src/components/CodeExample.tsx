import { useState } from 'react';

const tabs = [
  {
    id: 'react',
    label: 'React',
    code: `import { PhaseFlagProvider, useFlag } from '@phaseflag/react'

function App() {
  return (
    <PhaseFlagProvider sdkKey="pk_live_abc123">
      <Dashboard />
    </PhaseFlagProvider>
  )
}

function Dashboard() {
  const showAnalytics = useFlag('analytics_v2', false)

  return showAnalytics
    ? <AnalyticsV2 />
    : <AnalyticsV1 />
}`,
  },
  {
    id: 'node',
    label: 'Node.js',
    code: `import { PhaseFlag } from '@phaseflag/sdk-js'

const pf = new PhaseFlag({ sdkKey: 'sk_live_abc123' })
await pf.waitForInitialization()

app.get('/api/checkout', (req, res) => {
  const user = { key: req.userId, plan: req.plan }
  const useNewFlow = pf.boolVariation('new_checkout', user, false)

  if (useNewFlow) {
    return handleNewCheckout(req, res)
  }
  return handleClassicCheckout(req, res)
})`,
  },
  {
    id: 'python',
    label: 'Python',
    code: `from phaseflag import PhaseFlag

pf = PhaseFlag(sdk_key="sk_live_abc123")
pf.wait_for_initialization()

@app.route("/api/recommendations")
def recommendations():
    user = {"key": request.user_id, "plan": request.plan}
    use_ml = pf.bool_variation("ml_recommendations", user, False)

    if use_ml:
        return get_ml_recommendations(request.user_id)
    return get_classic_recommendations(request.user_id)`,
  },
  {
    id: 'go',
    label: 'Go',
    code: `import pf "github.com/phaseflag/sdk-go"

client, _ := pf.NewClient("sk_live_abc123")
client.WaitForInitialization(ctx)

func handler(w http.ResponseWriter, r *http.Request) {
    user := pf.User{
        Key: r.Header.Get("X-User-ID"),
        Custom: map[string]interface{}{"plan": "enterprise"},
    }

    if client.BoolVariation("new_search", user, false) {
        newSearchHandler(w, r)
    } else {
        classicSearchHandler(w, r)
    }
}`,
  },
];

export default function CodeExample() {
  const [activeTab, setActiveTab] = useState('react');
  const tab = tabs.find((t) => t.id === activeTab)!;

  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Simple Integration
          </h2>
          <p className="text-pf-text-muted text-lg">
            A few lines of code to add feature flags to any application.
          </p>
        </div>

        <div className="bg-pf-dark rounded-2xl shadow-2xl shadow-black/30 overflow-hidden border border-[rgba(91,186,167,0.15)]">
          {/* Tab bar */}
          <div className="flex items-center border-b border-white/10 px-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-5 py-3.5 text-sm font-medium transition-colors relative ${
                  activeTab === t.id
                    ? 'text-pf-mint'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-pf-mint rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="p-6 overflow-x-auto">
            <pre className="text-sm font-mono leading-relaxed text-white/85">
              {tab.code}
            </pre>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { metric: '<1ms', label: 'Evaluation latency' },
            { metric: '19', label: 'SDK targets' },
            { metric: '0', label: 'Network calls during evaluation' },
          ].map((item) => (
            <div key={item.label} className="text-center bg-pf-surface border border-[rgba(91,186,167,0.15)] rounded-xl p-4">
              <div className="text-2xl font-heading font-light text-pf-mint">{item.metric}</div>
              <div className="text-xs text-pf-text-muted mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

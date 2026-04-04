export default function LiveDemo() {
  const flags = [
    { key: 'nexus-dark-mode', type: 'boolean', desc: 'Toggle light/dark theme across the app' },
    { key: 'nexus-task-layout', type: 'string', desc: 'Switch between compact, standard, and detailed card layouts' },
    { key: 'nexus-max-projects', type: 'number', desc: 'Limit projects by plan tier (3 / 10 / unlimited)' },
    { key: 'nexus-dashboard-widgets', type: 'json', desc: 'Configure dashboard KPI widgets via JSON' },
    { key: 'nexus-beta-features', type: 'boolean', desc: 'Targeting rule: enterprise users and internal emails only' },
    { key: 'nexus-chat-widget', type: 'boolean', desc: '30% percentage rollout using DJB2 hashing' },
    { key: 'nexus-ai-summaries', type: 'boolean', desc: 'Lifecycle demo: activate to see AI summary panel appear' },
    { key: 'nexus-notifications', type: 'boolean', desc: 'Environment-specific: active in dev, off in production' },
    { key: 'nexus-onboarding', type: 'string', desc: 'A/B experiment: classic checklist vs guided tour' },
    { key: 'nexus-power-tools', type: 'boolean', desc: 'Segment targeting: only shown to power users (50+ tasks, 30+ days)' },
  ];

  const typeBadge: Record<string, string> = {
    boolean: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    string: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    number: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    json: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  };

  return (
    <section id="live-demo" className="py-20 lg:py-28 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-pf-mint/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-mint/10 text-pf-mint border border-pf-mint/20 mb-6">
            Interactive Playground
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-wider text-white mb-6">
            See It <span className="text-pf-mint">Live</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            We built a demo app called <strong className="text-white">Nexus</strong> — a project management tool powered
            entirely by Phase Flag. Toggle flags in the dashboard and watch the app change in real time.
          </p>
        </div>

        {/* Two-column: Access card + How it works */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Access Card */}
          <div className="bg-pf-surface-light rounded-2xl border border-[rgba(91,186,167,0.15)] p-8 flex flex-col">
            <h3 className="text-xl font-semibold text-white mb-2">Try it yourself</h3>
            <p className="text-sm text-white/50 mb-6">Open both links side-by-side, toggle a flag, and watch the demo app update instantly.</p>

            <div className="space-y-4 flex-1">
              {/* Demo App Link */}
              <div className="bg-[#0F1A20] rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-pf-mint/15 flex items-center justify-center">
                    <svg className="w-5 h-5 text-pf-mint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Demo App (Nexus)</div>
                    <div className="text-xs text-white/40">The app being controlled by flags</div>
                  </div>
                </div>
                <a
                  href="http://localhost:5176"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 text-sm font-medium text-white bg-pf-mint rounded-lg hover:bg-pf-mint-light transition-colors"
                >
                  Open Demo App
                </a>
              </div>

              {/* Dashboard Link */}
              <div className="bg-[#0F1A20] rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Phase Flag Dashboard</div>
                    <div className="text-xs text-white/40">Where you control the flags</div>
                  </div>
                </div>
                <a
                  href="http://localhost:5173/flags"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 text-sm font-medium text-white bg-violet-500/80 rounded-lg hover:bg-violet-500 transition-colors"
                >
                  Open Dashboard
                </a>
              </div>
            </div>

            {/* Credentials */}
            <div className="mt-6 bg-[#0F1A20] rounded-xl p-5 border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-sm font-medium text-white">Login Credentials</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Email</div>
                  <code className="text-sm text-pf-mint font-mono">demo@phaseflag.dev</code>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Password</div>
                  <code className="text-sm text-pf-mint font-mono">TryPhaseFlag!</code>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/30">
                Editor role — can view, create, toggle, and update flags. Cannot delete flags or manage users.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-pf-surface-light rounded-2xl border border-[rgba(91,186,167,0.15)] p-8">
            <h3 className="text-xl font-semibold text-white mb-6">What to try</h3>
            <div className="space-y-5">
              {[
                {
                  step: '1',
                  title: 'Toggle a flag',
                  desc: 'Open the dashboard, find nexus-dark-mode, and flip the toggle. The demo app\'s theme changes instantly via SSE.',
                },
                {
                  step: '2',
                  title: 'Switch user personas',
                  desc: 'In the demo app, use the user switcher (top-right) to switch between Alice (free), Bob (pro), Carol (enterprise), and Dan (internal). Watch how targeting rules serve different values.',
                },
                {
                  step: '3',
                  title: 'Change an environment',
                  desc: 'In the demo app sidebar, switch between dev, staging, and production. Notification bell visibility changes per environment.',
                },
                {
                  step: '4',
                  title: 'Inspect evaluations',
                  desc: 'Click the floating inspector button (bottom-right of the demo app) to see every flag\'s current value, variation, and evaluation reason in real time.',
                },
                {
                  step: '5',
                  title: 'Explore the showcase page',
                  desc: 'Navigate to the Showcase tab in the demo app for a guided walkthrough of all 10 capabilities with live code snippets.',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-pf-mint/15 flex items-center justify-center text-sm font-semibold text-pf-mint">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white mb-1">{item.title}</div>
                    <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Flag table */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Demo flags powering the app</h3>
          <div className="bg-pf-surface-light rounded-2xl border border-[rgba(91,186,167,0.15)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/40 font-medium">Flag Key</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/40 font-medium">Type</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/40 font-medium">Capability Demonstrated</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((flag, i) => (
                    <tr key={flag.key} className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3">
                        <code className="text-pf-mint font-mono text-xs">{flag.key}</code>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium border ${typeBadge[flag.type]}`}>
                          {flag.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white/60">{flag.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

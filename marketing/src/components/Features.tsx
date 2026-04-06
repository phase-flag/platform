const features = [
  {
    title: 'Local Evaluation',
    description: 'Evaluate flags in <1ms, right in your app. SDKs download the ruleset and evaluate locally with zero network calls.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'text-amber-400',
  },
  {
    title: 'Progressive Rollouts',
    description: 'Canary, blue-green, ring deployments built in. Gradually roll out features with automatic metric-based advancement.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'text-blue-400',
  },
  {
    title: '19 SDKs',
    description: 'JavaScript, Python, Go, Java, React, Vue, Angular, Swift, Kotlin, and 10 more. Every platform covered.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    color: 'text-violet-400',
  },
  {
    title: 'Experiments',
    description: 'Built-in A/B testing with Bayesian and frequentist statistics. Sequential testing, power analysis, and holdout groups.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    color: 'text-rose-400',
  },
  {
    title: 'Open Source',
    description: 'Apache 2.0 core, no vendor lock-in. Self-host on your infrastructure, inspect the code, and contribute.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-emerald-400',
  },
  {
    title: 'Enterprise Ready',
    description: 'SSO/SAML, RBAC, audit logs, compliance exports, environment freeze windows, and break-glass workflows.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: 'text-orange-400',
  },
  {
    title: 'Targeting Rules',
    description: '11 operators including regex, semver comparison, and list membership. Precise targeting with segment reuse.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'text-sky-400',
  },
  {
    title: 'Real-time Streaming',
    description: 'SSE streaming for instant flag updates. Polling and webhook invalidation patterns as fallback.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
      </svg>
    ),
    color: 'text-pink-400',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-16">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-4">Platform Features</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-[#888] leading-relaxed">
            A complete feature flag platform — from local evaluation to enterprise governance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.05]">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-[#0A0A0A] hover:bg-[#111] p-6 transition-colors duration-200"
            >
              <div className={`${feature.color} mb-4 opacity-80 group-hover:opacity-100 transition-opacity`}>
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-white/90 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[#666] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

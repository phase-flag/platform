import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Flag Management',
    description: 'Create, toggle, and manage feature flags with an intuitive interface. Support for boolean, string, number, and JSON types.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
    link: '/flags',
    color: 'bg-blue-900/30 text-blue-400',
  },
  {
    title: 'Evaluation Engine',
    description: 'Build targeting rules with 8+ operators and see real-time evaluation results with full explainability traces.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    link: '/evaluation',
    color: 'bg-green-900/30 text-green-400',
  },
  {
    title: 'Percentage Rollouts',
    description: 'Visualize DJB2 deterministic hashing and see exactly which users fall into each rollout bucket.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    link: '/rollouts',
    color: 'bg-purple-900/30 text-purple-400',
  },
  {
    title: 'SDK Integration',
    description: 'Copy-paste ready code snippets for 19 SDK targets. JavaScript, Python, Go, Java, React, and more.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    link: '/sdks',
    color: 'bg-orange-900/30 text-orange-400',
  },
  {
    title: 'Local Evaluation',
    description: 'Flags evaluate locally in under 1ms. No network calls during evaluation means zero latency impact.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    link: '/evaluation',
    color: 'bg-yellow-900/30 text-yellow-400',
  },
  {
    title: 'Open Source',
    description: 'Apache 2.0 licensed core. Self-host, inspect the code, contribute. No vendor lock-in ever.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    link: '/sdks',
    color: 'bg-teal-900/30 text-teal-400',
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0F1A] via-[#111827] to-[#0B0F1A]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-primary/10 text-pf-primary border border-pf-primary/20 mb-6">
              Interactive Demo -- No Sign-up Required
            </span>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-[#E8F0F2] mb-6">
              Try Phase Flag<br />
              <span className="text-pf-primary">Right Now</span>
            </h1>
            <p className="text-lg text-[#8FA3AD] mb-10 max-w-2xl mx-auto leading-relaxed">
              Explore feature flags, targeting rules, percentage rollouts, and SDK integration
              without creating an account. Everything runs in your browser.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/flags"
                className="px-6 py-3 text-sm font-medium text-white bg-pf-primary rounded-xl hover:bg-pf-primary-light transition-colors shadow-lg shadow-pf-primary/20"
              >
                Start with Flags
              </Link>
              <Link
                to="/evaluation"
                className="px-6 py-3 text-sm font-medium text-[#E8F0F2] bg-[#1E1B4B] border border-[rgba(99,102,241,0.15)] rounded-xl hover:bg-[#252B4B] transition-colors"
              >
                Try Evaluation Engine
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="font-heading text-2xl sm:text-3xl font-light uppercase tracking-wider text-[#E8F0F2] mb-4">
            Explore the Platform
          </h2>
          <p className="text-[#8FA3AD] max-w-xl mx-auto">
            Each demo is fully interactive. Click through to see Phase Flag in action.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.link}
              className="group bg-[#111827] border border-[rgba(99,102,241,0.15)] rounded-2xl p-6 hover:border-pf-primary/30 hover:shadow-lg hover:shadow-pf-primary/5 transition-all duration-300"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="font-heading text-lg font-light uppercase tracking-wider text-[#E8F0F2] mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[#8FA3AD] leading-relaxed">
                {feature.description}
              </p>
              <div className="mt-4 text-sm font-medium text-pf-primary group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Try it
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#111827] border-y border-[rgba(99,102,241,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="font-heading text-2xl sm:text-3xl font-light uppercase tracking-wider text-[#E8F0F2] text-center mb-12">
            How Evaluation Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Check Prerequisites', desc: 'Evaluate any prerequisite flags first. If they fail, return the default value.' },
              { step: '2', title: 'Match Rules', desc: 'Evaluate targeting rules by priority. Each rule has conditions checked with AND logic.' },
              { step: '3', title: 'Apply Rollout', desc: 'If a rule matches, apply percentage rollout using deterministic DJB2 hashing.' },
              { step: '4', title: 'Return Value', desc: 'Return the matched variation with a full evaluation reason trace for debugging.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-pf-primary text-white text-lg font-heading font-light mb-4">
                  {item.step}
                </div>
                <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-[#E8F0F2] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[#8FA3AD] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

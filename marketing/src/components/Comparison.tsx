const features = [
  { name: 'Open Source Core', phaseflag: true, launchdarkly: false, unleash: true, flagsmith: true },
  { name: 'Self-Hosted Option', phaseflag: true, launchdarkly: false, unleash: true, flagsmith: true },
  { name: 'Local Evaluation', phaseflag: true, launchdarkly: true, unleash: true, flagsmith: true },
  { name: 'Sub-ms Evaluation', phaseflag: true, launchdarkly: true, unleash: true, flagsmith: false },
  { name: 'Progressive Rollouts', phaseflag: true, launchdarkly: true, unleash: true, flagsmith: true },
  { name: 'Built-in A/B Testing', phaseflag: true, launchdarkly: true, unleash: false, flagsmith: false },
  { name: 'Bayesian Statistics', phaseflag: true, launchdarkly: false, unleash: false, flagsmith: false },
  { name: '19+ SDK Targets', phaseflag: true, launchdarkly: true, unleash: false, flagsmith: false },
  { name: 'Formal Verification', phaseflag: true, launchdarkly: false, unleash: false, flagsmith: false },
  { name: 'Monte Carlo Simulation', phaseflag: true, launchdarkly: false, unleash: false, flagsmith: false },
  { name: 'Autonomous Optimization', phaseflag: true, launchdarkly: false, unleash: false, flagsmith: false },
  { name: 'Evaluation Explainability', phaseflag: true, launchdarkly: true, unleash: false, flagsmith: false },
  { name: 'OpenFeature Support', phaseflag: true, launchdarkly: true, unleash: true, flagsmith: true },
  { name: 'Free Tier', phaseflag: 'Unlimited flags', launchdarkly: '1,000 MAU', unleash: '2 envs', flagsmith: '50k requests' },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-xs text-pf-text-muted">{value}</span>;
  }
  return value ? (
    <svg className="w-5 h-5 text-pf-success mx-auto" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-white/20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  );
}

export default function Comparison() {
  return (
    <section id="compare" className="py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-primary/10 text-pf-primary mb-4">
            Comparison
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            How We Compare
          </h2>
          <p className="text-pf-text-muted text-lg">
            Phase Flag combines the best of open source with enterprise-grade intelligence.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[rgba(99,102,241,0.15)]">
                <th className="text-left py-4 pr-4 font-heading text-xs font-medium uppercase tracking-wider text-pf-text-muted">
                  Feature
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="font-heading text-sm font-medium uppercase tracking-wider text-pf-primary">Phase Flag</div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="font-heading text-xs font-medium uppercase tracking-wider text-pf-text-muted">LaunchDarkly</div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="font-heading text-xs font-medium uppercase tracking-wider text-pf-text-muted">Unleash</div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="font-heading text-xs font-medium uppercase tracking-wider text-pf-text-muted">Flagsmith</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr
                  key={feature.name}
                  className={`border-b border-[rgba(99,102,241,0.1)] ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                >
                  <td className="py-3.5 pr-4 text-pf-text font-medium">{feature.name}</td>
                  <td className="px-4 py-3.5 text-center bg-pf-primary/5">
                    <Cell value={feature.phaseflag} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Cell value={feature.launchdarkly} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Cell value={feature.unleash} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Cell value={feature.flagsmith} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

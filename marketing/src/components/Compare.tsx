import { phaseAdvantages } from '../data/comparisons';

// ─── Competitor card data ─────────────────────────────────────────────────────

interface CompetitorDiff {
  competitor: string;
  tagline: string;
  differences: Array<{ label: string; phaseflag: string; them: string; pfWins: boolean }>;
}

const competitorDiffs: CompetitorDiff[] = [
  {
    competitor: 'LaunchDarkly',
    tagline: 'Enterprise SaaS, per-seat pricing',
    differences: [
      { label: 'Pricing model', phaseflag: 'MAU-based, no per-seat', them: 'Per-seat billing', pfWins: true },
      { label: 'Open source', phaseflag: 'Apache 2.0 core', them: 'Proprietary', pfWins: true },
      { label: 'Self-hosting', phaseflag: 'Free self-host option', them: 'SaaS only', pfWins: true },
      { label: 'Bayesian statistics', phaseflag: 'Built in', them: 'Not available', pfWins: true },
      { label: 'Free tier', phaseflag: 'Unlimited flags', them: '1,000 MAU limit', pfWins: true },
      { label: 'Flag verification', phaseflag: 'Formal Z3-based', them: 'Not available', pfWins: true },
    ],
  },
  {
    competitor: 'Unleash',
    tagline: 'Open-source core, limited experimentation',
    differences: [
      { label: 'Built-in A/B testing', phaseflag: 'Full Bayesian + frequentist', them: 'Not available', pfWins: true },
      { label: 'Edge relay proxy', phaseflag: 'Open-source Go relay', them: 'Not included', pfWins: true },
      { label: 'SDK breadth', phaseflag: '15+ incl. Rust, Svelte, Edge', them: '10+ mainstream only', pfWins: true },
      { label: 'Enterprise AI', phaseflag: 'Autonomous optimization', them: 'Not available', pfWins: true },
      { label: 'FinOps attribution', phaseflag: 'Cost per flag', them: 'Not available', pfWins: true },
      { label: 'OpenFeature support', phaseflag: 'Python + TypeScript', them: 'Available', pfWins: false },
    ],
  },
  {
    competitor: 'Flagsmith',
    tagline: 'Open-source, limited SDK breadth',
    differences: [
      { label: 'Local evaluation', phaseflag: 'Sub-millisecond, in-process', them: 'No local eval', pfWins: true },
      { label: 'A/B testing', phaseflag: 'Full built-in experiments', them: 'Not available', pfWins: true },
      { label: 'Rust / Svelte / Solid SDKs', phaseflag: 'Included', them: 'Not available', pfWins: true },
      { label: 'Flag dependency graph', phaseflag: 'Full interaction graph', them: 'Not available', pfWins: true },
      { label: 'Approval workflows', phaseflag: 'Change requests + freezes', them: 'Not available', pfWins: true },
      { label: 'OpenFeature support', phaseflag: 'Available', them: 'Available', pfWins: false },
    ],
  },
  {
    competitor: 'Split.io',
    tagline: 'Experiment-first, proprietary, per-seat',
    differences: [
      { label: 'Open source', phaseflag: 'Apache 2.0 core', them: 'Proprietary', pfWins: true },
      { label: 'Self-hosting', phaseflag: 'Free self-host option', them: 'SaaS only', pfWins: true },
      { label: 'Pricing model', phaseflag: 'MAU-based', them: 'Per-seat billing', pfWins: true },
      { label: 'Counterfactual analysis', phaseflag: 'Built in', them: 'Not available', pfWins: true },
      { label: 'OpenFeature support', phaseflag: 'Available', them: 'Not available', pfWins: true },
      { label: 'Free tier', phaseflag: 'Unlimited flags', them: '10 seats only', pfWins: true },
    ],
  },
];

// ─── Competitor Card ──────────────────────────────────────────────────────────

function CompetitorCard({ data }: { data: CompetitorDiff }) {
  return (
    <div className="bg-pf-surface border border-[rgba(99,102,241,0.15)] rounded-2xl p-6 flex flex-col">
      {/* Header */}
      <div className="mb-5">
        <h3 className="font-heading text-base font-medium uppercase tracking-wider text-white mb-1">
          vs {data.competitor}
        </h3>
        <p className="text-xs text-pf-text-muted">{data.tagline}</p>
      </div>

      {/* Differences */}
      <ul className="space-y-3 flex-1">
        {data.differences.map((diff) => (
          <li key={diff.label} className="flex items-start gap-3">
            {diff.pfWins ? (
              <svg className="w-4 h-4 text-pf-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white/30 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium text-white/70 mb-0.5">{diff.label}</div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-pf-primary">{diff.phaseflag}</span>
                <span className="text-xs text-white/35 line-through decoration-white/20">{diff.them}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Compare (main export) ───────────────────────────────────────────────────

export default function Compare() {
  return (
    <section id="compare-full" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-primary/10 text-pf-primary mb-4">
            Comparison
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Phase Flag vs The Field
          </h2>
          <p className="text-pf-text-muted text-lg">
            See how Phase Flag stacks up against LaunchDarkly, Unleash, Flagsmith, and Split.io.
          </p>
        </div>

        {/* Why Phase Flag — advantage bullets */}
        <div className="mb-12 p-6 rounded-2xl bg-pf-primary/5 border border-pf-primary/20">
          <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-pf-primary mb-4">
            Key Advantages
          </h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {phaseAdvantages.map((adv) => (
              <li key={adv} className="flex items-start gap-2.5 text-sm text-pf-text">
                <svg className="w-4 h-4 text-pf-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                {adv}
              </li>
            ))}
          </ul>
        </div>

        {/* Competitor cards — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {competitorDiffs.map((data) => (
            <CompetitorCard key={data.competitor} data={data} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-pf-text-muted mb-6">
            Ready to see Phase Flag in action?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://app.phaseflag.dev"
              className="px-6 py-3 text-sm font-medium text-white bg-pf-primary rounded-xl hover:bg-pf-primary-light transition-colors shadow-lg shadow-pf-primary/20"
            >
              Get Started Free
            </a>
            <a
              href="https://docs.phaseflag.dev/self-host"
              className="px-6 py-3 text-sm font-medium text-pf-text-muted hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-colors"
            >
              Self-Host Docs
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}

import CompareTable from './CompareTable';
import { phaseAdvantages, competitors, comparisonCategories } from '../data/comparisons';

// ─── Individual competitor summary cards ─────────────────────────────────────

function CompetitorCard({ competitor }: { competitor: typeof competitors[number] }) {
  if (competitor.isSelf) return null;

  // Count features where Phase Flag wins (true and competitor is false or fewer)
  // We'll just link to the relevant section anchor instead of computing dynamically.
  return (
    <a
      href={`#compare-${competitor.id}`}
      className="block p-5 rounded-xl bg-white/[0.03] border border-[rgba(91,186,167,0.12)] hover:border-pf-mint/30 hover:bg-white/[0.06] transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-white group-hover:text-pf-mint transition-colors">
          Phase Flag vs {competitor.name}
        </h3>
        <svg className="w-4 h-4 text-pf-text-muted group-hover:text-pf-mint transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-xs text-pf-text-muted">{competitor.tagline}</p>
    </a>
  );
}

// ─── Compare (main export) ───────────────────────────────────────────────────

export default function Compare() {
  return (
    <section id="compare-full" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-mint/10 text-pf-mint mb-4">
            Detailed Comparison
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Phase Flag vs The Field
          </h2>
          <p className="text-pf-text-muted text-lg">
            See exactly how Phase Flag compares to LaunchDarkly, Unleash, Flagsmith, and Split.io
            across every dimension that matters.
          </p>
        </div>

        {/* ── Why Phase Flag — advantage bullets ── */}
        <div className="mb-14 p-6 rounded-2xl bg-pf-mint/5 border border-pf-mint/20">
          <h3 className="font-heading text-sm font-medium uppercase tracking-wider text-pf-mint mb-4">
            Key Advantages
          </h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {phaseAdvantages.map((adv) => (
              <li key={adv} className="flex items-start gap-2.5 text-sm text-pf-text">
                <svg className="w-4 h-4 text-pf-mint shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                {adv}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Full interactive comparison table ── */}
        <div className="mb-16">
          <CompareTable />
        </div>

        {/* ── Per-competitor deep-dive sections ── */}
        <div className="mb-14">
          <h3 className="font-heading text-xl font-light uppercase tracking-wider text-white mb-6 text-center">
            Head-to-Head Breakdowns
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {competitors.filter((c) => !c.isSelf).map((c) => (
              <CompetitorCard key={c.id} competitor={c} />
            ))}
          </div>

          {/* Per-competitor focused tables */}
          {competitors
            .filter((c) => !c.isSelf)
            .map((competitor) => (
              <div
                key={competitor.id}
                id={`compare-${competitor.id}`}
                className="mb-12 scroll-mt-24"
              >
                <div className="flex items-center gap-3 mb-5">
                  <h4 className="font-heading text-base font-medium uppercase tracking-wider text-white">
                    Phase Flag vs {competitor.name}
                  </h4>
                  <a
                    href={competitor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pf-text-muted hover:text-pf-mint transition-colors"
                  >
                    {competitor.url.replace('https://', '')} ↗
                  </a>
                </div>
                {/* Show a representative subset: core + that competitor's weaknesses */}
                {comparisonCategories.map((cat) => {
                  // Only show categories where there's at least one difference
                  const hasDiff = cat.features.some(
                    (f) => f.phaseflag !== f[competitor.id as keyof typeof f],
                  );
                  if (!hasDiff) return null;
                  return (
                    <div key={cat.id} className="mb-4">
                      <p className="text-xs font-medium text-pf-text-muted uppercase tracking-wider mb-2 px-1">
                        {cat.label}
                      </p>
                      <div className="overflow-x-auto rounded-xl border border-[rgba(91,186,167,0.12)]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[rgba(91,186,167,0.15)]">
                              <th className="text-left px-4 py-3 text-xs text-pf-text-muted font-medium uppercase tracking-wider min-w-[180px]">
                                Feature
                              </th>
                              <th className="px-4 py-3 text-center bg-pf-mint/5 text-xs font-heading font-medium uppercase tracking-wider text-pf-mint">
                                Phase Flag
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-heading font-medium uppercase tracking-wider text-pf-text-muted">
                                {competitor.name}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.features
                              .filter(
                                (f) =>
                                  f.phaseflag !== f[competitor.id as keyof typeof f],
                              )
                              .map((feature, i) => (
                                <tr
                                  key={feature.name}
                                  className={`border-b border-[rgba(91,186,167,0.08)] ${
                                    i % 2 === 0 ? 'bg-white/[0.01]' : ''
                                  }`}
                                >
                                  <td className="px-4 py-3 text-pf-text font-medium">
                                    {feature.name}
                                  </td>
                                  {/* Phase Flag cell */}
                                  {typeof feature.phaseflag === 'string' ? (
                                    <td className="px-4 py-3 text-center bg-pf-mint/5">
                                      <span className="text-xs font-medium text-pf-mint">
                                        {feature.phaseflag}
                                      </span>
                                    </td>
                                  ) : (
                                    <td className="px-4 py-3 text-center bg-pf-mint/5">
                                      {feature.phaseflag ? (
                                        <svg className="w-5 h-5 mx-auto text-pf-mint" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4 mx-auto text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        </svg>
                                      )}
                                    </td>
                                  )}
                                  {/* Competitor cell */}
                                  {typeof feature[competitor.id as keyof typeof feature] === 'string' ? (
                                    <td className="px-4 py-3 text-center">
                                      <span className="text-xs text-pf-text-muted">
                                        {feature[competitor.id as keyof typeof feature] as string}
                                      </span>
                                    </td>
                                  ) : (
                                    <td className="px-4 py-3 text-center">
                                      {feature[competitor.id as keyof typeof feature] ? (
                                        <svg className="w-5 h-5 mx-auto text-white/40" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4 mx-auto text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        </svg>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>

        {/* ── CTA ── */}
        <div className="text-center">
          <p className="text-pf-text-muted mb-6">
            Ready to see Phase Flag in action?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://app.phaseflag.dev"
              className="px-6 py-3 text-sm font-medium text-white bg-pf-mint rounded-xl hover:bg-pf-mint-light transition-colors shadow-lg shadow-pf-mint/20"
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

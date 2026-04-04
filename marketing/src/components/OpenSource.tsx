export default function OpenSource() {
  return (
    <section id="open-source" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-mint/10 text-pf-mint mb-6">
              Open Source
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-6">
              Built in the Open
            </h2>
            <p className="text-lg text-pf-text-muted leading-relaxed mb-8">
              Phase Flag's core is Apache 2.0 licensed. Inspect the code, self-host on your
              infrastructure, and contribute. No vendor lock-in, no surprise pricing changes.
            </p>

            <div className="space-y-4 mb-8">
              {[
                {
                  title: 'Full Source Access',
                  desc: 'Every line of the core platform is open source. Audit, modify, and extend.',
                },
                {
                  title: 'Self-Host Anywhere',
                  desc: 'Deploy with Docker, Kubernetes, or your existing infrastructure.',
                },
                {
                  title: 'Community Driven',
                  desc: 'Public roadmap, open issues, and community contributions welcome.',
                },
                {
                  title: 'No Lock-in',
                  desc: 'Standard OpenFeature integration. Import/export flags in JSON. Migrate freely.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-pf-mint shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <div>
                    <span className="font-medium text-white">{item.title}</span>
                    <p className="text-sm text-pf-text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/phaseflag"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-pf-dark rounded-xl hover:bg-pf-surface-light transition-colors border border-[rgba(91,186,167,0.15)]"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                View on GitHub
              </a>
              <a
                href="https://docs.phaseflag.dev/self-host"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-pf-text border border-[rgba(91,186,167,0.15)] rounded-xl hover:bg-white/5 transition-colors"
              >
                Self-Hosting Guide
              </a>
            </div>
          </div>

          {/* License card */}
          <div className="space-y-6">
            <div className="bg-pf-surface border border-[rgba(91,186,167,0.15)] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading text-base font-medium uppercase tracking-wider text-white">
                    Core Platform
                  </h3>
                  <p className="text-xs text-pf-success font-medium">Apache License 2.0</p>
                </div>
              </div>
              <p className="text-sm text-pf-text-muted leading-relaxed">
                The complete feature flag platform including API, dashboard, CLI, SDKs,
                and relay. Use commercially, modify, distribute freely.
              </p>
            </div>

            <div className="bg-pf-surface border border-[rgba(91,186,167,0.15)] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading text-base font-medium uppercase tracking-wider text-white">
                    Enterprise Modules
                  </h3>
                  <p className="text-xs text-purple-400 font-medium">Business Source License 1.1</p>
                </div>
              </div>
              <p className="text-sm text-pf-text-muted leading-relaxed">
                Advanced experimentation, simulation, verification, compliance,
                and autonomous optimization. Converts to Apache 2.0 after 4 years.
              </p>
            </div>

            <div className="bg-pf-dark rounded-2xl p-5 border border-[rgba(91,186,167,0.15)]">
              <pre className="text-sm font-mono text-white/80 leading-relaxed overflow-x-auto">
{`# Self-host in minutes
git clone https://github.com/phaseflag/phaseflag
cd phaseflag/infra/docker
docker compose up -d

# API: http://localhost:8000
# Dashboard: http://localhost:3000`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

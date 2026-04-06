const steps = [
  {
    number: '01',
    title: 'Create a Flag',
    description: 'Define a feature flag with targeting rules, percentage rollouts, and variations. Configure per environment.',
    detail: 'Boolean, string, number, or JSON values with typed variations.',
  },
  {
    number: '02',
    title: 'Integrate Your SDK',
    description: 'Install the SDK for your platform. Initialize with your SDK key. Evaluation happens locally in <1ms.',
    detail: '19 SDKs: JS, Python, Go, Java, React, Vue, Swift, Kotlin, and more.',
  },
  {
    number: '03',
    title: 'Ship with Confidence',
    description: 'Progressively roll out to users. Monitor metrics. Roll back instantly if something goes wrong.',
    detail: 'Canary rollouts, automatic advancement, instant kill switch.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-border py-20 lg:py-28" style={{ background: '#0E0E0E' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-16">
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-4">Getting Started</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Three Steps to Safer Releases
          </h2>
          <p className="text-[#888]">Go from zero to feature flags in under five minutes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-16">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-white/10 to-transparent -translate-x-8" />
              )}

              <div>
                {/* Number */}
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/[0.04] mb-5">
                  <span className="text-xs font-mono text-[#888]">{step.number}</span>
                </div>

                <h3 className="text-base font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-[#888] leading-relaxed mb-3">{step.description}</p>
                <p className="text-xs text-[#555] font-mono">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

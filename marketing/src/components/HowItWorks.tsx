export default function HowItWorks() {
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

  return (
    <section id="how-it-works" className="bg-pf-surface border-y border-[rgba(91,186,167,0.15)] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-mint/10 text-pf-mint mb-4">
            Getting Started
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Three Steps to Safer Releases
          </h2>
          <p className="text-pf-text-muted text-lg">
            Go from zero to feature flags in under five minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-pf-mint/40 to-transparent -translate-x-1/2" />
              )}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-pf-mint text-white text-xl font-heading font-light mb-6 shadow-lg shadow-pf-mint/20">
                  {step.number}
                </div>
                <h3 className="font-heading text-xl font-light uppercase tracking-wider text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-pf-text-muted leading-relaxed mb-3">
                  {step.description}
                </p>
                <p className="text-xs text-pf-mint font-medium">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

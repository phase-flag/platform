const testimonials = [
  {
    quote: "Phase Flag's local evaluation changed our game. We went from 50ms flag checks to sub-millisecond. Our P99 latency dropped significantly.",
    name: 'Sarah Chen',
    title: 'VP of Engineering',
    company: 'TechScale',
    avatar: 'SC',
  },
  {
    quote: "The evaluation explainability is something we couldn't find anywhere else. When a flag misbehaves, we know exactly why within seconds.",
    name: 'Marcus Rivera',
    title: 'Staff SRE',
    company: 'DataFlow',
    avatar: 'MR',
  },
  {
    quote: "We migrated from LaunchDarkly and saved 80% on our feature flag costs. The open-source core gives us full control over our infrastructure.",
    name: 'Aisha Patel',
    title: 'CTO',
    company: 'Nimbus Cloud',
    avatar: 'AP',
  },
];

export default function Testimonials() {
  return (
    <section className="bg-pf-surface border-y border-[rgba(99,102,241,0.15)] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Trusted by Engineering Teams
          </h2>
          <p className="text-pf-text-muted text-lg">
            Teams of all sizes rely on Phase Flag for safe, fast releases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-[#162029] border border-[rgba(99,102,241,0.15)] rounded-2xl p-6 hover:shadow-lg hover:shadow-pf-primary/5 transition-shadow"
            >
              <svg className="w-8 h-8 text-pf-primary/30 mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z" />
              </svg>
              <p className="text-pf-text leading-relaxed mb-6">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-[rgba(99,102,241,0.1)]">
                <div className="w-10 h-10 rounded-full bg-pf-primary flex items-center justify-center text-white text-sm font-medium">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{t.name}</div>
                  <div className="text-xs text-pf-text-muted">{t.title}, {t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

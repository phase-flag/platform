export default function CTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-pf-surface-light to-pf-dark rounded-3xl p-10 sm:p-16 text-center overflow-hidden border border-[rgba(91,186,167,0.15)]">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-pf-mint/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-pf-mint/5 rounded-full blur-3xl" />

          <div className="relative">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-wider text-white mb-6">
              Start Shipping<br />
              <span className="text-pf-mint">Fearlessly</span>
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of engineering teams using Phase Flag to ship features
              safely with progressive rollouts, instant rollbacks, and full observability.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://app.phaseflag.dev"
                className="px-8 py-4 text-sm font-medium text-pf-dark bg-pf-mint rounded-xl hover:bg-pf-mint-light transition-all shadow-lg shadow-pf-mint/30 hover:-translate-y-0.5"
              >
                Get Started Free
              </a>
              <a
                href="https://docs.phaseflag.dev"
                className="px-8 py-4 text-sm font-medium text-white border border-white/20 rounded-xl hover:bg-white/10 transition-all hover:-translate-y-0.5"
              >
                Read the Docs
              </a>
            </div>
            <p className="mt-6 text-sm text-white/40">
              Free forever for unlimited flags. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

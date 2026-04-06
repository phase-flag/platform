export default function CTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-6">Get started</p>

        <h2 className="font-heading text-4xl sm:text-5xl font-light uppercase tracking-wider text-white mb-4 leading-tight">
          Ship Fearlessly.<br />
          Roll Back Instantly.
        </h2>

        <p className="text-[#888] mb-10 max-w-md mx-auto leading-relaxed">
          Join thousands of engineering teams using Phase Flag to safely deploy
          features with progressive rollouts and full observability.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="https://app.phaseflag.com"
             className="btn-primary px-7 py-3 text-sm rounded-lg">
            Get Started Free
          </a>
          <a href="https://docs.phaseflag.com"
             className="btn-secondary px-7 py-3 text-sm rounded-lg">
            Read the Docs
          </a>
        </div>

        <p className="mt-6 text-xs text-[#444] font-mono">
          Unlimited flags · No credit card · Self-host or cloud
        </p>
      </div>
    </section>
  )
}

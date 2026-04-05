const tiers = [
  {
    name: 'Community',
    price: 'Free',
    priceDetail: 'forever',
    description: 'For individuals and small teams getting started with feature flags.',
    features: [
      'Unlimited feature flags',
      '3 environments',
      '5 team members',
      'Local evaluation SDKs',
      'Boolean, string, number, JSON types',
      'Targeting rules with 11 operators',
      'Percentage rollouts',
      'Audit log',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaHref: 'https://app.phaseflag.dev',
    highlighted: false,
  },
  {
    name: 'Team',
    price: '$29',
    priceDetail: 'per seat / month',
    description: 'For growing teams that need progressive rollouts and experimentation.',
    features: [
      'Everything in Community',
      '10 environments',
      'Unlimited team members',
      'Progressive rollouts',
      'A/B experiments',
      'Segments and groups',
      'Webhooks and integrations',
      'SSE real-time streaming',
      'Priority email support',
      'OpenFeature providers',
    ],
    cta: 'Start Free Trial',
    ctaHref: 'https://app.phaseflag.dev',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceDetail: 'annual contract',
    description: 'For organizations needing SSO, compliance, and advanced intelligence.',
    features: [
      'Everything in Team',
      'Unlimited environments',
      'SSO / SAML / SCIM',
      'Formal verification (Z3)',
      'Monte Carlo simulation',
      'Counterfactual analysis',
      'Autonomous optimization',
      'GDPR / HIPAA / SOC 2 compliance',
      'Environment freeze windows',
      'Break-glass workflows',
      'Dedicated support + SLA',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@phaseflag.dev',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-pf-surface border-y border-[rgba(99,102,241,0.15)] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-primary/10 text-pf-primary mb-4">
            Pricing
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-pf-text-muted text-lg">
            Start free, scale as you grow. No hidden fees, no per-flag charges.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-8 transition-all ${
                tier.highlighted
                  ? 'bg-pf-surface-light border-2 border-pf-primary shadow-xl shadow-pf-primary/10 relative'
                  : 'bg-pf-surface border border-[rgba(99,102,241,0.15)]'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-medium text-white bg-pf-primary rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="font-heading text-lg font-medium uppercase tracking-wider text-white mb-2">
                {tier.name}
              </h3>
              <div className="mb-1">
                <span className="text-4xl font-heading font-light text-white">{tier.price}</span>
                {tier.priceDetail !== 'forever' && (
                  <span className="text-sm text-pf-text-muted ml-2">/ {tier.priceDetail}</span>
                )}
              </div>
              {tier.priceDetail === 'forever' && (
                <p className="text-sm text-pf-primary font-medium mb-4">Free forever</p>
              )}
              {tier.priceDetail !== 'forever' && <div className="mb-4" />}
              <p className="text-sm text-pf-text-muted mb-6">{tier.description}</p>

              <a
                href={tier.ctaHref}
                className={`block text-center px-6 py-3 text-sm font-medium rounded-xl transition-all ${
                  tier.highlighted
                    ? 'text-white bg-pf-primary hover:bg-pf-primary-light shadow-lg shadow-pf-primary/20'
                    : 'text-pf-text border border-[rgba(99,102,241,0.15)] hover:bg-white/5'
                }`}
              >
                {tier.cta}
              </a>

              <ul className="mt-8 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-pf-text-muted">
                    <svg className="w-4 h-4 text-pf-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

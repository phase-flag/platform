interface PricingTier {
  name: string;
  badge?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  variant: 'outlined' | 'featured' | 'premium';
}

const tiers: PricingTier[] = [
  {
    name: 'Open Source',
    description: 'Full-featured flag management, free forever. Self-host on your own infrastructure.',
    features: [
      'Unlimited feature flags',
      'Up to 3 environments (dev, staging, production)',
      'Up to 1,000 Monthly Tracked Users',
      'All 15+ SDK languages',
      'Local evaluation engine (<1ms)',
      'REST API + Swagger docs',
      'Docker self-hosting',
      'Community support',
      'Apache 2.0 licensed',
    ],
    cta: 'Get Started',
    ctaHref: 'https://docs.phaseflag.dev/self-host',
    variant: 'outlined',
  },
  {
    name: 'Pro',
    badge: 'Most Popular',
    description: 'For growing teams that need scale, experimentation, and governance.',
    features: [
      'Everything in Open Source, plus:',
      'Unlimited environments and projects',
      'Up to 50,000 Monthly Tracked Users',
      'A/B testing and experiments',
      'Progressive delivery pipelines',
      'Governance (approvals, freeze windows)',
      'Remote configuration',
      'Webhooks and integrations',
      'Priority support',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@phaseflag.com',
    variant: 'featured',
  },
  {
    name: 'Enterprise',
    description: 'For organizations needing compliance, SSO, and advanced intelligence.',
    features: [
      'Everything in Pro, plus:',
      'Unlimited Monthly Tracked Users',
      'SSO (SAML 2.0, OIDC, SCIM)',
      'Compliance (GDPR, HIPAA, SOC 2)',
      'Advanced experimentation (Thompson Sampling, mutual exclusion)',
      'Causal counterfactual analysis',
      'FinOps cost attribution',
      'Vendor migration tools',
      'Flag rule verification',
      'Dedicated support + SLA',
      'On-premise deployment option',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@phaseflag.com',
    variant: 'premium',
  },
];

function CheckIcon({ highlighted }: { highlighted?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 mt-0.5 ${highlighted ? 'text-pf-primary' : 'text-pf-primary'}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="bg-pf-surface border-y border-[rgba(99,102,241,0.15)] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pf-primary/10 text-pf-primary mb-4">
            Pricing
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-light uppercase tracking-wider text-white mb-4">
            Start Free, Scale Your Way
          </h2>
          <p className="text-pf-text-muted text-lg">
            Open source core is free forever. Contact us for Pro and Enterprise pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier) => {
            const isFeatured = tier.variant === 'featured';
            const isPremium = tier.variant === 'premium';

            const cardClass = [
              'relative rounded-2xl p-8 transition-all',
              isFeatured
                ? 'bg-pf-surface-light border-2 border-pf-primary shadow-xl shadow-pf-primary/10'
                : isPremium
                ? 'bg-[rgba(99,102,241,0.04)] border border-pf-primary/30'
                : 'bg-pf-surface border border-[rgba(99,102,241,0.15)]',
            ].join(' ');

            const ctaClass = [
              'block text-center px-6 py-3 text-sm font-medium rounded-xl transition-colors',
              isFeatured
                ? 'text-white bg-pf-primary hover:bg-pf-primary-light shadow-lg shadow-pf-primary/20'
                : isPremium
                ? 'text-pf-primary border border-pf-primary/40 hover:bg-pf-primary/10'
                : 'text-pf-text border border-[rgba(99,102,241,0.15)] hover:bg-white/5',
            ].join(' ');

            return (
              <div key={tier.name} className={cardClass}>
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-medium text-white bg-pf-primary rounded-full">
                    {tier.badge}
                  </span>
                )}

                <div className="mb-6">
                  <h3 className="font-heading text-lg font-medium uppercase tracking-wider text-white mb-2">
                    {tier.name}
                  </h3>
                  <p className="text-sm text-pf-text-muted leading-relaxed">{tier.description}</p>
                </div>

                {/* Price display */}
                {tier.variant === 'outlined' ? (
                  <div className="mb-6">
                    <div className="text-3xl font-heading font-light text-white">Free</div>
                    <p className="text-sm text-pf-primary font-medium mt-1">Open source, self-host for free</p>
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-sm font-medium text-pf-text-muted uppercase tracking-wider">Pricing on request</div>
                    <p className="text-xs text-pf-text-muted mt-1">Flexible plans based on your needs</p>
                  </div>
                )}

                <a href={tier.ctaHref} className={ctaClass}>
                  {tier.cta}
                </a>

                <ul className="mt-8 space-y-3">
                  {tier.features.map((feature) =>
                    feature.endsWith(':') ? (
                      <li key={feature} className="pt-2">
                        <span className="font-medium text-white/50 text-xs uppercase tracking-wider">{feature}</span>
                      </li>
                    ) : (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-pf-text-muted">
                        <CheckIcon highlighted={isFeatured} />
                        {feature}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-pf-text-muted mt-10">
          All plans include the Apache 2.0 core. Enterprise includes all Pro features plus dedicated support and compliance tooling.
        </p>
      </div>
    </section>
  );
}

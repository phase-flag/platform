/**
 * Competitor comparison data for Phase Flag marketing site.
 * All information is based on publicly available documentation and pricing pages
 * as of Q1 2026. Accuracy is best-effort; verify before using in paid media.
 */

export type FeatureValue = boolean | string;

export interface ComparisonFeature {
  name: string;
  phaseflag: FeatureValue;
  launchdarkly: FeatureValue;
  unleash: FeatureValue;
  flagsmith: FeatureValue;
  splitio: FeatureValue;
  /** Optional tooltip / footnote */
  note?: string;
}

export interface ComparisonCategory {
  id: string;
  label: string;
  features: ComparisonFeature[];
}

// ─── Core Features ───────────────────────────────────────────────────────────

const coreFeatures: ComparisonCategory = {
  id: 'core',
  label: 'Core Features',
  features: [
    {
      name: 'Boolean flags',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Multivariate / JSON flags',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Progressive rollouts',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Targeting rules (user / segment)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Local / edge evaluation (sub-ms)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: false,
      splitio: true,
      note: 'Phase Flag ships a dedicated Relay edge proxy with in-process caching.',
    },
    {
      name: 'Edge relay proxy',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
      note: 'Phase Flag relay is open-source Go; LaunchDarkly Relay is proprietary.',
    },
    {
      name: 'OpenFeature provider',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
    {
      name: 'Flag dependencies / interactions graph',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Flag scheduling (time-based activation)',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Stale flag detection',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
  ],
};

// ─── SDKs ────────────────────────────────────────────────────────────────────

const sdkFeatures: ComparisonCategory = {
  id: 'sdks',
  label: 'SDK Coverage',
  features: [
    {
      name: 'SDK languages / platforms',
      phaseflag: '15+',
      launchdarkly: '20+',
      unleash: '10+',
      flagsmith: '10+',
      splitio: '10+',
      note: 'Phase Flag: JS/TS, Python, Go, Rust, Java, .NET, PHP, Swift/iOS, React, Angular, Vue, Svelte, Solid, Edge, OpenFeature (Python + TS).',
    },
    {
      name: 'React / Vue / Angular SDKs',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Rust SDK',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Edge runtime SDK (Cloudflare Workers, Deno)',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'iOS / Swift SDK',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Svelte / Solid SDKs',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'OpenFeature providers (multiple languages)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
  ],
};

// ─── Deployment ───────────────────────────────────────────────────────────────

const deploymentFeatures: ComparisonCategory = {
  id: 'deployment',
  label: 'Deployment Options',
  features: [
    {
      name: 'Open-source core (Apache 2.0)',
      phaseflag: true,
      launchdarkly: false,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
    {
      name: 'Self-hosted / on-prem',
      phaseflag: true,
      launchdarkly: false,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
    {
      name: 'Managed cloud (SaaS)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Three deployment modes (OSS / SaaS / Enterprise)',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
      note: 'Phase Flag ships a single binary configurable via PHASEFLAG_DEPLOYMENT_MODE.',
    },
    {
      name: 'Docker + Helm chart included',
      phaseflag: true,
      launchdarkly: false,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
    {
      name: 'Terraform provider / IaC examples',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Multi-region / geo routing',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: true,
    },
  ],
};

// ─── Pricing ─────────────────────────────────────────────────────────────────

const pricingFeatures: ComparisonCategory = {
  id: 'pricing',
  label: 'Pricing',
  features: [
    {
      name: 'Free tier',
      phaseflag: 'Unlimited flags',
      launchdarkly: '1,000 MAU',
      unleash: '2 environments',
      flagsmith: '50k requests/mo',
      splitio: '10 seats',
    },
    {
      name: 'Per-seat pricing',
      phaseflag: false,
      launchdarkly: true,
      unleash: true,
      flagsmith: false,
      splitio: true,
      note: 'Phase Flag is priced on MAU/evaluations, not per developer seat.',
    },
    {
      name: 'Per-MAU (monthly active users) pricing',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: true,
      splitio: false,
    },
    {
      name: 'Usage-based / evaluation pricing',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Predictable flat plans',
      phaseflag: true,
      launchdarkly: false,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
    {
      name: 'Self-host for free (OSS)',
      phaseflag: true,
      launchdarkly: false,
      unleash: true,
      flagsmith: true,
      splitio: false,
    },
  ],
};

// ─── Experimentation ─────────────────────────────────────────────────────────

const experimentationFeatures: ComparisonCategory = {
  id: 'experimentation',
  label: 'Experimentation & Analytics',
  features: [
    {
      name: 'Built-in A/B testing',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: true,
    },
    {
      name: 'Bayesian / Thompson Sampling statistics',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
      note: 'Phase Flag uses Thompson Sampling for autonomous experiment optimization.',
    },
    {
      name: 'Frequentist (p-value) statistics',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: true,
    },
    {
      name: 'Counterfactual analysis',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Monte Carlo simulation',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Flag evaluation explainability',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Autonomous flag optimization (AI)',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Metric-driven rollout decisions',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: true,
    },
  ],
};

// ─── Enterprise Features ──────────────────────────────────────────────────────

const enterpriseFeatures: ComparisonCategory = {
  id: 'enterprise',
  label: 'Enterprise Features',
  features: [
    {
      name: 'SSO (SAML 2.0 / OIDC)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'SCIM user provisioning',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: false,
      splitio: true,
    },
    {
      name: 'Change requests & approval workflows',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Freeze windows / release governance',
      phaseflag: true,
      launchdarkly: true,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'Audit log (immutable)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Role-based access control (RBAC)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
    {
      name: 'Formal verification of flag logic',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'FinOps cost attribution per flag',
      phaseflag: true,
      launchdarkly: false,
      unleash: false,
      flagsmith: false,
      splitio: false,
    },
    {
      name: 'SOC 2 Type II ready (cloud)',
      phaseflag: true,
      launchdarkly: true,
      unleash: true,
      flagsmith: true,
      splitio: true,
    },
  ],
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export const comparisonCategories: ComparisonCategory[] = [
  coreFeatures,
  sdkFeatures,
  deploymentFeatures,
  pricingFeatures,
  experimentationFeatures,
  enterpriseFeatures,
];

export interface Competitor {
  id: keyof Omit<ComparisonFeature, 'name' | 'note'>;
  name: string;
  tagline: string;
  url: string;
  isSelf?: boolean;
}

export const competitors: Competitor[] = [
  {
    id: 'phaseflag',
    name: 'Phase Flag',
    tagline: 'Open-source, three deployment modes, AI-native',
    url: 'https://phaseflag.dev',
    isSelf: true,
  },
  {
    id: 'launchdarkly',
    name: 'LaunchDarkly',
    tagline: 'Enterprise SaaS, per-seat pricing',
    url: 'https://launchdarkly.com',
  },
  {
    id: 'unleash',
    name: 'Unleash',
    tagline: 'Open-source core, limited experimentation',
    url: 'https://www.getunleash.io',
  },
  {
    id: 'flagsmith',
    name: 'Flagsmith',
    tagline: 'Open-source, limited SDK breadth',
    url: 'https://flagsmith.com',
  },
  {
    id: 'splitio',
    name: 'Split.io',
    tagline: 'Experiment-first, proprietary, per-seat',
    url: 'https://www.split.io',
  },
];

/** Summary bullets shown on the /compare landing card */
export const phaseAdvantages = [
  '15+ SDK targets including Rust, Svelte, Solid, and Edge runtimes',
  'Three deployment modes: OSS (self-host free), SaaS, and Enterprise',
  'Open-source edge relay proxy for sub-millisecond evaluation',
  'Bayesian Thompson Sampling + counterfactual analysis built in',
  'No per-seat pricing — scale engineers without scaling your bill',
  'Formal flag logic verification and FinOps cost attribution',
  'Apache 2.0 licensed — no vendor lock-in',
];

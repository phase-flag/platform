import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Plan {
  id: string;
  name: string;
  price_monthly_usd: number | null;
  features: string[];
  stripe_price_id: string | null;
}

const PLAN_FEATURES = {
  free: ['Up to 5 flags', '1 environment', '1 project', 'Community support'],
  pro: ['Unlimited flags', '5 environments', '10 projects', 'Segments & targeting', 'Audit log', 'Email support'],
  enterprise: ['Everything in Pro', 'Unlimited projects & environments', 'SSO / SAML', 'SLA', 'Dedicated support'],
};

export default function Billing() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentTier, setCurrentTier] = useState('free');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/billing/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {});

    // Fetch user's org to get current tier
    fetch(`${API_URL}/api/v1/organizations/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((orgs: { subscription_tier?: string }[]) => {
        if (orgs.length > 0 && orgs[0].subscription_tier) {
          setCurrentTier(orgs[0].subscription_tier);
        }
      })
      .catch(() => {});
  }, [token]);

  async function upgrade(plan: Plan) {
    if (!plan.stripe_price_id) {
      setError('This plan is not yet available. Contact sales.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const orgsRes = await fetch(`${API_URL}/api/v1/organizations/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orgs = await orgsRes.json();
      if (!orgs.length) throw new Error('No organization found');
      const orgId = orgs[0].id;

      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_id: plan.id,
          org_id: orgId,
          success_url: `${window.location.origin}/billing?success=1`,
          cancel_url: `${window.location.origin}/billing`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create checkout session');
      }
      const data = await res.json();
      window.location.href = data.checkout_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setIsLoading(false);
    }
  }

  const displayPlans: Plan[] = plans.length
    ? plans
    : [
        { id: 'free', name: 'Free', price_monthly_usd: 0, features: PLAN_FEATURES.free, stripe_price_id: null },
        { id: 'pro', name: 'Pro', price_monthly_usd: 29, features: PLAN_FEATURES.pro, stripe_price_id: null },
        { id: 'enterprise', name: 'Enterprise', price_monthly_usd: null, features: PLAN_FEATURES.enterprise, stripe_price_id: null },
      ];

  return (
    <div className="min-h-screen bg-[#0F1A20] px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-white/50 mt-1">
            Current plan:{' '}
            <span className="text-[#34D399] font-semibold capitalize">{currentTier}</span>
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {new URLSearchParams(window.location.search).get('success') && (
          <div className="mb-6 bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] rounded-xl px-4 py-3 text-sm">
            Subscription activated! Your plan will be reflected shortly.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayPlans.map((plan) => {
            const isCurrent = plan.id === currentTier;
            const isPro = plan.id === 'pro';
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  isPro
                    ? 'border-[#34D399] bg-[#34D399]/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#34D399] text-[#0F1A20] text-xs font-bold px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="mt-2">
                    {plan.price_monthly_usd === null ? (
                      <p className="text-2xl font-bold text-white">Custom</p>
                    ) : plan.price_monthly_usd === 0 ? (
                      <p className="text-2xl font-bold text-white">Free</p>
                    ) : (
                      <p className="text-2xl font-bold text-white">
                        ${plan.price_monthly_usd}
                        <span className="text-sm font-normal text-white/40">/mo</span>
                      </p>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-[#34D399] mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl border border-white/20 text-white/40 text-sm cursor-default"
                  >
                    Current plan
                  </button>
                ) : plan.id === 'enterprise' ? (
                  <a
                    href="mailto:sales@phaseflag.io"
                    className="block w-full py-2.5 rounded-xl border border-white/20 text-white text-sm text-center hover:bg-white/5 transition-colors"
                  >
                    Contact sales
                  </a>
                ) : (
                  <button
                    onClick={() => upgrade(plan)}
                    disabled={isLoading}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isPro
                        ? 'bg-[#34D399] hover:bg-[#6EE7B7] text-[#0F1A20]'
                        : 'border border-white/20 text-white hover:bg-white/5'
                    }`}
                  >
                    {isLoading ? 'Loading…' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

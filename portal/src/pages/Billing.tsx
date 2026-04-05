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

interface BillingStatus {
  payment_failed: boolean;
  trial_ends_in_days: number | null;
  downgraded: boolean;
  mtu_count: number;
  mtu_limit: number;
  unlimited: boolean;
  customer_portal_url: string | null;
}

const PLAN_FEATURES = {
  free: ['Up to 5 flags', '1 environment', '1 project', 'Community support'],
  pro: ['Unlimited flags', '5 environments', '10 projects', 'Segments & targeting', 'Audit log', 'Email support'],
  enterprise: ['Everything in Pro', 'Unlimited projects & environments', 'SSO / SAML', 'SLA', 'Dedicated support'],
};

function BillingBanners({ status, onUpdatePayment }: { status: BillingStatus; onUpdatePayment: () => void }) {
  const mtuPct = status.unlimited || status.mtu_limit === 0 ? 0 : (status.mtu_count / status.mtu_limit) * 100;
  const mtuExceeded = !status.unlimited && mtuPct > 100;
  const mtuWarning = !status.unlimited && mtuPct >= 80 && !mtuExceeded;

  return (
    <div className="space-y-3 mb-6">
      {status.payment_failed && (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          <span>
            Your last payment failed. Please update your payment method to continue using Phase Flag.
          </span>
          <button
            onClick={onUpdatePayment}
            className="ml-4 shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors"
          >
            Update Payment Method
          </button>
        </div>
      )}

      {status.trial_ends_in_days !== null && status.trial_ends_in_days >= 0 && !status.payment_failed && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl px-4 py-3 text-sm">
          Your trial ends in {status.trial_ends_in_days} day{status.trial_ends_in_days !== 1 ? 's' : ''}. Upgrade to keep your flags running.
        </div>
      )}

      {status.downgraded && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl px-4 py-3 text-sm">
          You've been downgraded to the Free plan. Some features may be limited.
        </div>
      )}

      {mtuWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl px-4 py-3 text-sm">
          You've used {Math.round(mtuPct)}% of your monthly tracked users (MTU) limit.
        </div>
      )}

      {mtuExceeded && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          You've exceeded your MTU limit. Evaluations may be throttled.
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentTier, setCurrentTier] = useState('free');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/billing/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {});

    // Fetch user's org to get current tier and billing status
    fetch(`${API_URL}/api/v1/organizations/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((orgs: { id?: string; subscription_tier?: string }[]) => {
        if (orgs.length > 0) {
          const org = orgs[0];
          if (org.subscription_tier) setCurrentTier(org.subscription_tier);
          if (org.id) {
            setOrgId(org.id);
            // Fetch billing status
            fetch(`${API_URL}/api/v1/billing/status?org_id=${org.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => { if (data) setBillingStatus(data); })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [token]);

  async function openCustomerPortal() {
    if (!orgId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          org_id: orgId,
          return_url: `${window.location.origin}/billing`,
        }),
      });
      if (!res.ok) throw new Error('Unable to open billing portal');
      const data = await res.json();
      window.location.href = data.portal_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setIsLoading(false);
    }
  }

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
      const id = orgs[0].id;

      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_id: plan.id,
          org_id: id,
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

        {billingStatus && (
          <BillingBanners status={billingStatus} onUpdatePayment={openCustomerPortal} />
        )}

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
                    href="mailto:sales@phaseflag.com"
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

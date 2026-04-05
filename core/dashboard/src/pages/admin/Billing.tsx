import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { DollarSign, TrendingUp, Users, CreditCard } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import clsx from 'clsx'

/* eslint-disable @typescript-eslint/no-explicit-any */
const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RTooltip = Tooltip as any
const RBar = Bar as any
const RCartesianGrid = CartesianGrid as any
/* eslint-enable @typescript-eslint/no-explicit-any */

interface TenantUsage {
    tenant_id: string
    tenant_name: string
    plan: 'free' | 'pro' | 'enterprise'
    current_month_evals: number
    previous_month_evals: number
    plan_limit: number
    billing_status: 'current' | 'overdue' | 'trial'
}

interface BillingOverview {
    mrr: number
    total_customers: number
    free_count: number
    pro_count: number
    enterprise_count: number
    tenants: TenantUsage[]
}

const MOCK_DATA: BillingOverview = {
    mrr: 12_450,
    total_customers: 24,
    free_count: 14,
    pro_count: 7,
    enterprise_count: 3,
    tenants: [
        { tenant_id: '1', tenant_name: 'Stark Industries', plan: 'enterprise', current_month_evals: 4_200_000, previous_month_evals: 3_900_000, plan_limit: Infinity, billing_status: 'current' },
        { tenant_id: '2', tenant_name: 'Umbrella Labs', plan: 'enterprise', current_month_evals: 1_350_000, previous_month_evals: 1_100_000, plan_limit: Infinity, billing_status: 'current' },
        { tenant_id: '3', tenant_name: 'Wayne Enterprises', plan: 'pro', current_month_evals: 820_000, previous_month_evals: 740_000, plan_limit: 1_000_000, billing_status: 'current' },
        { tenant_id: '4', tenant_name: 'Acme Corp', plan: 'pro', current_month_evals: 560_000, previous_month_evals: 490_000, plan_limit: 1_000_000, billing_status: 'current' },
        { tenant_id: '5', tenant_name: 'Globex Inc', plan: 'pro', current_month_evals: 230_000, previous_month_evals: 210_000, plan_limit: 1_000_000, billing_status: 'overdue' },
        { tenant_id: '6', tenant_name: 'Initech', plan: 'free', current_month_evals: 8_200, previous_month_evals: 7_500, plan_limit: 10_000, billing_status: 'trial' },
        { tenant_id: '7', tenant_name: 'Cyberdyne', plan: 'free', current_month_evals: 4_100, previous_month_evals: 3_200, plan_limit: 10_000, billing_status: 'current' },
        { tenant_id: '8', tenant_name: 'Oscorp', plan: 'enterprise', current_month_evals: 2_100_000, previous_month_evals: 1_800_000, plan_limit: Infinity, billing_status: 'current' },
    ],
}

function formatNumber(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toString()
}

function formatCurrency(n: number) {
    return '$' + n.toLocaleString()
}

export default function Billing() {
    const { data: rawUsage, isError: usageError } = useQuery({
        queryKey: ['admin', 'usage'],
        queryFn: () => adminApi.getUsage().then(r => r.data as BillingOverview),
        retry: false,
    })

    const data = usageError || !rawUsage ? MOCK_DATA : rawUsage
    const showBanner = usageError || !rawUsage

    const chartData = [...data.tenants]
        .sort((a, b) => b.current_month_evals - a.current_month_evals)
        .slice(0, 10)
        .map(t => ({
            name: t.tenant_name.length > 12 ? t.tenant_name.slice(0, 12) + '...' : t.tenant_name,
            evaluations: t.current_month_evals,
        }))

    const planBadge = (plan: string) => {
        switch (plan) {
            case 'enterprise': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            case 'pro': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        }
    }

    const billingBadge = (status: string) => {
        switch (status) {
            case 'current': return 'badge-success'
            case 'overdue': return 'badge-danger'
            case 'trial': return 'badge-warning'
            default: return ''
        }
    }

    const stats = [
        { label: 'MRR', value: formatCurrency(data.mrr), icon: DollarSign, gradient: 'from-primary-500 to-green-500' },
        { label: 'Total Customers', value: data.total_customers, icon: Users, gradient: 'from-primary-800 to-primary-500' },
        { label: 'Pro Plans', value: data.pro_count, icon: CreditCard, gradient: 'from-primary-900 to-primary-950' },
        { label: 'Enterprise Plans', value: data.enterprise_count, icon: TrendingUp, gradient: 'from-primary-950 to-primary-500' },
    ]

    return (
        <div className="p-8">
            {showBanner && (
                <div className="mb-6 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Admin endpoints coming soon &mdash; showing sample data
                    </p>
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Usage & Billing</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Evaluation usage, plans, and revenue</p>
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {stats.map(s => (
                    <div key={s.label} className="card relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${s.gradient}`} />
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                            </div>
                            <div className={`p-2.5 rounded-lg bg-gradient-to-br ${s.gradient}`}>
                                <s.icon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Usage Chart */}
            <div className="card mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Evaluation Volume by Tenant (Current Month)</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} layout="vertical">
                        <RCartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <RXAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 11 }} />
                        <RYAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                        <RTooltip
                            formatter={(v: number) => [v.toLocaleString(), 'Evaluations']}
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                        />
                        <RBar dataKey="evaluations" fill="#6366F1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Tenant Usage Table */}
            <div className="card overflow-hidden">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 px-1">Tenant Usage Details</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tenant</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">This Month</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Month</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billing</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tenants.map((t, idx) => {
                                const usagePct = t.plan_limit === Infinity ? 0 : Math.min((t.current_month_evals / t.plan_limit) * 100, 100)
                                const isOverLimit = t.plan_limit !== Infinity && t.current_month_evals > t.plan_limit * 0.8
                                return (
                                    <tr
                                        key={t.tenant_id}
                                        className={clsx(
                                            'border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                                            idx % 2 === 1 && 'bg-gray-50/50 dark:bg-gray-800/20'
                                        )}
                                    >
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{t.tenant_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={clsx('text-xs px-2 py-1 rounded font-medium', planBadge(t.plan))}>
                                                {t.plan}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{formatNumber(t.current_month_evals)}</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">{formatNumber(t.previous_month_evals)}</td>
                                        <td className="px-4 py-3">
                                            {t.plan_limit === Infinity ? (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">Unlimited</span>
                                            ) : (
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full max-w-[120px]">
                                                        <div
                                                            className={clsx(
                                                                'h-2 rounded-full transition-all',
                                                                isOverLimit ? 'bg-red-500' : 'bg-primary-500'
                                                            )}
                                                            style={{ width: `${usagePct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(usagePct)}%</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={clsx('badge text-xs', billingBadge(t.billing_status))}>
                                                {t.billing_status}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Plan tiers info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">
                {[
                    { name: 'Free', limit: '10K evals/mo', price: '$0', color: 'border-gray-300 dark:border-gray-600' },
                    { name: 'Pro', limit: '1M evals/mo', price: '$99/mo', color: 'border-primary-500' },
                    { name: 'Enterprise', limit: 'Unlimited', price: 'Custom', color: 'border-purple-500' },
                ].map(plan => (
                    <div key={plan.name} className={clsx('card border-t-4', plan.color)}>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{plan.name}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{plan.price}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{plan.limit}</p>
                        <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-2">
                            {plan.name === 'Free' ? data.free_count : plan.name === 'Pro' ? data.pro_count : data.enterprise_count} tenants
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

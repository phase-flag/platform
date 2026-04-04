import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { Activity, Clock, AlertTriangle, Database, Wifi, Zap } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import clsx from 'clsx'

/* eslint-disable @typescript-eslint/no-explicit-any */
const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RTooltip = Tooltip as any
const RArea = Area as any
const RCartesianGrid = CartesianGrid as any
/* eslint-enable @typescript-eslint/no-explicit-any */

interface PlatformHealthData {
    api_response_times: Array<{ time: string; p50: number; p95: number; p99: number }>
    error_rates: Array<{ time: string; rate: number }>
    active_sse_connections: number
    database_size_mb: number
    cache_hit_rate: number
    evaluation_latency: { p50: number; p95: number; p99: number }
    uptime_percent: number
    total_requests_24h: number
    error_count_24h: number
}

const MOCK_DATA: PlatformHealthData = {
    api_response_times: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        p50: 8 + Math.random() * 6,
        p95: 25 + Math.random() * 15,
        p99: 60 + Math.random() * 40,
    })),
    error_rates: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        rate: Math.random() * 0.5,
    })),
    active_sse_connections: 142,
    database_size_mb: 2_340,
    cache_hit_rate: 94.7,
    evaluation_latency: { p50: 2.1, p95: 8.4, p99: 22.3 },
    uptime_percent: 99.98,
    total_requests_24h: 1_240_000,
    error_count_24h: 347,
}

function formatNumber(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toString()
}

function StatusIndicator({ value, thresholds }: { value: number; thresholds: [number, number] }) {
    const status = value <= thresholds[0] ? 'good' : value <= thresholds[1] ? 'warn' : 'bad'
    return (
        <div className={clsx(
            'w-2.5 h-2.5 rounded-full',
            status === 'good' && 'bg-green-500',
            status === 'warn' && 'bg-yellow-500',
            status === 'bad' && 'bg-red-500',
        )} />
    )
}

export default function PlatformHealth() {
    const { data: rawData, isError } = useQuery({
        queryKey: ['admin', 'health'],
        queryFn: () => adminApi.getPlatformHealth().then(r => r.data as PlatformHealthData),
        retry: false,
        refetchInterval: 30_000,
    })

    const data = isError || !rawData ? MOCK_DATA : rawData
    const showBanner = isError || !rawData

    const metrics = [
        {
            label: 'Uptime',
            value: data.uptime_percent + '%',
            icon: Activity,
            sub: 'Last 30 days',
            gradient: 'from-[#22C55E] to-[#5BBAA7]',
        },
        {
            label: 'Active SSE',
            value: data.active_sse_connections,
            icon: Wifi,
            sub: 'Connections',
            gradient: 'from-[#5BBAA7] to-[#7ED4C1]',
        },
        {
            label: 'DB Size',
            value: (data.database_size_mb / 1024).toFixed(1) + ' GB',
            icon: Database,
            sub: 'PostgreSQL',
            gradient: 'from-[#2B4C5C] to-[#5BBAA7]',
        },
        {
            label: 'Cache Hit Rate',
            value: data.cache_hit_rate + '%',
            icon: Zap,
            sub: 'Redis',
            gradient: 'from-[#1E3A4A] to-[#2B4C5C]',
        },
        {
            label: 'Requests (24h)',
            value: formatNumber(data.total_requests_24h),
            icon: Clock,
            sub: `${data.error_count_24h} errors`,
            gradient: 'from-[#2B4C5C] to-[#1E3A4A]',
        },
        {
            label: 'Error Rate (24h)',
            value: ((data.error_count_24h / data.total_requests_24h) * 100).toFixed(3) + '%',
            icon: AlertTriangle,
            sub: `${data.error_count_24h} total errors`,
            gradient: data.error_count_24h > 1000 ? 'from-[#EF4444] to-[#F59E0B]' : 'from-[#5BBAA7] to-[#22C55E]',
        },
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Platform Health</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">System-wide monitoring and performance metrics</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {metrics.map(m => (
                    <div key={m.label} className="card relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${m.gradient}`} />
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{m.label}</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{m.value}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.sub}</p>
                            </div>
                            <div className={`p-2.5 rounded-lg bg-gradient-to-br ${m.gradient}`}>
                                <m.icon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* API Response Times Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">API Response Times (24h)</h2>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={data.api_response_times}>
                            <RCartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                            <RXAxis dataKey="time" tick={{ fontSize: 10 }} />
                            <RYAxis tickFormatter={(v: number) => v + 'ms'} tick={{ fontSize: 10 }} />
                            <RTooltip
                                formatter={(v: number, name: string) => [v.toFixed(1) + 'ms', name.toUpperCase()]}
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                            />
                            <defs>
                                <linearGradient id="p99Grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#5BBAA7" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#5BBAA7" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <RArea type="monotone" dataKey="p99" stroke="#EF4444" strokeWidth={1.5} fill="url(#p99Grad)" />
                            <RArea type="monotone" dataKey="p95" stroke="#F59E0B" strokeWidth={1.5} fill="url(#p95Grad)" />
                            <RArea type="monotone" dataKey="p50" stroke="#5BBAA7" strokeWidth={2} fill="url(#p50Grad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Error Rate (24h)</h2>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={data.error_rates}>
                            <RCartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                            <RXAxis dataKey="time" tick={{ fontSize: 10 }} />
                            <RYAxis tickFormatter={(v: number) => v.toFixed(1) + '%'} tick={{ fontSize: 10 }} />
                            <RTooltip
                                formatter={(v: number) => [v.toFixed(2) + '%', 'Error Rate']}
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#f3f4f6' }}
                            />
                            <defs>
                                <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <RArea type="monotone" dataKey="rate" stroke="#EF4444" strokeWidth={2} fill="url(#errorGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Evaluation Latency */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Evaluation Latency Percentiles</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                        { label: 'P50', value: data.evaluation_latency.p50, threshold: [5, 15] as [number, number] },
                        { label: 'P95', value: data.evaluation_latency.p95, threshold: [15, 50] as [number, number] },
                        { label: 'P99', value: data.evaluation_latency.p99, threshold: [50, 100] as [number, number] },
                    ].map(p => (
                        <div key={p.label} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <StatusIndicator value={p.value} thresholds={p.threshold} />
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{p.label}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{p.value}ms</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

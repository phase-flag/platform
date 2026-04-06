import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { Activity, Clock, AlertTriangle, Database, Wifi, Zap } from 'lucide-react'
import clsx from 'clsx'

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
    // Extra fields from the API we surface directly
    api_version?: string
    database_status?: string
    python_version?: string
    memory_usage_mb?: string | number
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

function normalizeHealth(raw: Record<string, unknown>): PlatformHealthData {
    // API returns: api_version, uptime_seconds, database, active_sse_connections,
    //              total_flags, active_flags, python_version, memory_usage_mb
    return {
        api_response_times: (raw.api_response_times as PlatformHealthData['api_response_times'] | undefined) ?? [],
        error_rates: (raw.error_rates as PlatformHealthData['error_rates'] | undefined) ?? [],
        active_sse_connections: (raw.active_sse_connections as number | undefined) ?? 0,
        database_size_mb: (raw.database_size_mb as number | undefined) ?? 0,
        cache_hit_rate: (raw.cache_hit_rate as number | undefined) ?? 0,
        evaluation_latency: (raw.evaluation_latency as PlatformHealthData['evaluation_latency'] | undefined) ?? { p50: 0, p95: 0, p99: 0 },
        uptime_percent: (raw.uptime_percent as number | undefined) ?? 100,
        total_requests_24h: (raw.total_requests_24h as number | undefined) ?? 0,
        error_count_24h: (raw.error_count_24h as number | undefined) ?? 0,
        api_version: String(raw.api_version ?? ''),
        database_status: String(raw.database ?? raw.database_status ?? 'unknown'),
        python_version: String(raw.python_version ?? ''),
        memory_usage_mb: raw.memory_usage_mb != null ? String(raw.memory_usage_mb) : undefined,
    }
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
        queryFn: () => adminApi.getPlatformHealth().then(r => normalizeHealth(r.data as Record<string, unknown>)),
        retry: false,
        refetchInterval: 30_000,
    })

    const data = isError || !rawData ? MOCK_DATA : rawData
    const showBanner = isError || !rawData

    const metrics = [
        {
            label: 'Uptime',
            value: String(data.uptime_percent) + '%',
            icon: Activity,
            sub: 'Last 30 days',
            gradient: 'from-green-500 to-primary-500',
        },
        {
            label: 'Active SSE',
            value: String(data.active_sse_connections),
            icon: Wifi,
            sub: 'Connections',
            gradient: 'from-primary-500 to-primary-400',
        },
        {
            label: 'DB Size',
            value: data.database_size_mb > 0 ? (data.database_size_mb / 1024).toFixed(1) + ' GB' : (data.database_status ?? 'connected'),
            icon: Database,
            sub: 'PostgreSQL',
            gradient: 'from-primary-800 to-primary-500',
        },
        {
            label: 'Cache Hit Rate',
            value: data.cache_hit_rate > 0 ? String(data.cache_hit_rate) + '%' : '—',
            icon: Zap,
            sub: 'Redis',
            gradient: 'from-primary-950 to-primary-800',
        },
        {
            label: 'Requests (24h)',
            value: formatNumber(data.total_requests_24h),
            icon: Clock,
            sub: `${String(data.error_count_24h)} errors`,
            gradient: 'from-primary-900 to-primary-950',
        },
        {
            label: 'Error Rate (24h)',
            value: data.total_requests_24h > 0
                ? ((data.error_count_24h / data.total_requests_24h) * 100).toFixed(3) + '%'
                : '0.000%',
            icon: AlertTriangle,
            sub: `${String(data.error_count_24h)} total errors`,
            gradient: data.error_count_24h > 1000 ? 'from-red-500 to-amber-500' : 'from-primary-500 to-green-500',
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

            {/* API info strip (from real API) */}
            {!showBanner && (data.api_version || data.python_version) && (
                <div className="mb-6 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {data.api_version && <span>API: <span className="font-medium text-gray-700 dark:text-gray-300">{data.api_version}</span></span>}
                    {data.python_version && <span>Python: <span className="font-medium text-gray-700 dark:text-gray-300">{data.python_version}</span></span>}
                    {data.memory_usage_mb && <span>Memory: <span className="font-medium text-gray-700 dark:text-gray-300">{data.memory_usage_mb} MB</span></span>}
                    {data.database_status && <span>DB: <span className="font-medium text-gray-700 dark:text-gray-300">{data.database_status}</span></span>}
                </div>
            )}

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

            {/* API Response Times — simple sparkline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">API Response Times (24h)</h2>
                    {data.api_response_times.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No response time data available</p>
                    ) : (
                        <div className="flex items-end gap-0.5 h-32">
                            {data.api_response_times.map((d, i) => {
                                const max = Math.max(...data.api_response_times.map(x => x.p99), 1)
                                const pctP99 = Math.max((d.p99 / max) * 100, 2)
                                const pctP50 = Math.max((d.p50 / max) * 100, 2)
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative" title={`${d.time} — p50: ${d.p50.toFixed(1)}ms p95: ${d.p95.toFixed(1)}ms p99: ${d.p99.toFixed(1)}ms`}>
                                        <div className="w-full bg-red-400 dark:bg-red-500 rounded-t absolute bottom-0" style={{ height: `${pctP99}%`, opacity: 0.4 }} />
                                        <div className="w-full bg-primary-500 dark:bg-primary-400 rounded-t absolute bottom-0" style={{ height: `${pctP50}%` }} />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary-500" /> P50</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400 opacity-60" /> P99</span>
                    </div>
                </div>

                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Error Rate (24h)</h2>
                    {data.error_rates.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No error rate data available</p>
                    ) : (
                        <div className="flex items-end gap-0.5 h-32">
                            {data.error_rates.map((d, i) => {
                                const max = Math.max(...data.error_rates.map(x => x.rate), 0.01)
                                const pct = Math.max((d.rate / max) * 100, 2)
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.time}: ${d.rate.toFixed(2)}%`}>
                                        <div className="w-full bg-red-500 dark:bg-red-400 rounded-t" style={{ height: `${pct}%` }} />
                                    </div>
                                )
                            })}
                        </div>
                    )}
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
                                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{String(p.value)}ms</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

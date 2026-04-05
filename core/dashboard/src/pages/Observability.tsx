import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, type SystemMetrics, type FlagHealth } from '@/lib/api'
import { Gauge, Activity, Zap, Server, Clock, AlertTriangle, CheckCircle, BarChart3, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const HEALTH_COLORS = ['#6366F1', '#F59E0B', '#EF4444', '#6B7F8A']

export default function Observability() {
    const [healthLimit, setHealthLimit] = useState(20)

    const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
        queryKey: ['system-metrics'],
        queryFn: () => analyticsApi.systemMetrics(),
        refetchInterval: 30000,
    })

    const { data: healthData, isLoading: healthLoading } = useQuery({
        queryKey: ['flag-health', healthLimit],
        queryFn: () => analyticsApi.flagHealth({ limit: healthLimit }),
    })

    const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
        queryKey: ['flag-inventory'],
        queryFn: () => analyticsApi.inventory(),
    })

    const metrics: SystemMetrics | null = metricsData?.data || null
    const healthFlags: FlagHealth[] = healthData?.data || []
    const inventory: Record<string, unknown> = inventoryData?.data || {}

    function formatUptime(seconds: number) {
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        if (days > 0) return `${days}d ${hours}h`
        if (hours > 0) return `${hours}h ${mins}m`
        return `${mins}m`
    }

    function formatNumber(n: number) {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
        return n.toLocaleString()
    }

    const inventoryChartData = Object.entries(inventory)
        .filter(([key]) => typeof inventory[key] === 'number')
        .map(([key, value]) => ({ name: key.replace(/_/g, ' '), value: Number(value) }))
        .slice(0, 10)

    const staleCount = healthFlags.filter(f => f.stale).length
    const noOwnerCount = healthFlags.filter(f => !f.has_owner).length
    const errorFlags = healthFlags.filter(f => f.error_count > 0)

    const healthPieData = [
        { name: 'Healthy', value: healthFlags.length - staleCount - errorFlags.length },
        { name: 'Stale', value: staleCount },
        { name: 'Errors', value: errorFlags.length },
        { name: 'No Owner', value: noOwnerCount },
    ].filter(d => d.value > 0)

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <Gauge className="w-8 h-8 text-primary-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Observability</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">System metrics, flag health, and inventory overview</p>
                    </div>
                </div>
                <button
                    onClick={() => refetchMetrics()}
                    className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50"
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </button>
            </div>

            {/* System Metrics Cards */}
            {metricsLoading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading system metrics...</div>
            ) : metrics ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    <MetricCard
                        icon={<Activity className="w-5 h-5 text-primary-500" />}
                        label="Total Evaluations"
                        value={formatNumber(metrics.total_evaluations)}
                    />
                    <MetricCard
                        icon={<Zap className="w-5 h-5 text-yellow-500" />}
                        label="Avg Latency"
                        value={`${metrics.avg_latency_ms.toFixed(1)}ms`}
                        alert={metrics.avg_latency_ms > 100}
                    />
                    <MetricCard
                        icon={<Server className="w-5 h-5 text-blue-500" />}
                        label="Connected Clients"
                        value={metrics.connected_clients.toString()}
                    />
                    <MetricCard
                        icon={<Clock className="w-5 h-5 text-purple-500" />}
                        label="Uptime"
                        value={formatUptime(metrics.uptime_seconds)}
                    />
                    <MetricCard
                        icon={<BarChart3 className="w-5 h-5 text-primary-700" />}
                        label="Total Flags"
                        value={metrics.total_flags.toString()}
                        subtitle={`${metrics.active_flags} active`}
                    />
                    <MetricCard
                        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                        label="Error Rate"
                        value={`${(metrics.error_rate * 100).toFixed(2)}%`}
                        alert={metrics.error_rate > 0.01}
                    />
                    <MetricCard
                        icon={<CheckCircle className="w-5 h-5 text-green-500" />}
                        label="Cache Hit Rate"
                        value={`${(metrics.cache_hit_rate * 100).toFixed(1)}%`}
                    />
                    <MetricCard
                        icon={<Activity className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
                        label="Active Flags"
                        value={metrics.active_flags.toString()}
                        subtitle={`of ${metrics.total_flags} total`}
                    />
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 mb-8">
                    <p>System metrics unavailable</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The API may not be running or the endpoint is not available</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Flag Health Overview */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Flag Health Overview</h2>
                    {healthLoading ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                    ) : healthPieData.length > 0 ? (
                        <div className="flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={healthPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {healthPieData.map((_, i) => (
                                            <Cell key={i} fill={HEALTH_COLORS[i % HEALTH_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-center py-8 text-gray-500 dark:text-gray-400">No flag health data</p>
                    )}
                </div>

                {/* Inventory Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Flag Inventory</h2>
                    {inventoryLoading ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                    ) : inventoryChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={inventoryChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">No inventory data</p>
                            {Object.keys(inventory).length > 0 && (
                                <div className="mt-4 text-left">
                                    {Object.entries(inventory).map(([key, value]) => (
                                        <div key={key} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{key.replace(/_/g, ' ')}</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Flag Health Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Flag Health Details</h2>
                    <select
                        value={healthLimit}
                        onChange={e => setHealthLimit(Number(e.target.value))}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 dark:bg-gray-800 dark:text-gray-100"
                    >
                        <option value={10}>Top 10</option>
                        <option value={20}>Top 20</option>
                        <option value={50}>Top 50</option>
                        <option value={100}>Top 100</option>
                    </select>
                </div>
                {healthLoading ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                ) : healthFlags.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">No flag health data available</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Flag Key</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Evaluations</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Errors</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Latency</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Evaluated</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {healthFlags.map(f => (
                                    <tr key={f.flag_key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                                        <td className="px-4 py-3">
                                            <code className="text-sm text-primary-500">{f.flag_key}</code>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                                            {formatNumber(f.evaluation_count)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            <span className={f.error_count > 0 ? 'text-red-600 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                                                {f.error_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                                            {f.avg_latency_ms.toFixed(1)}ms
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                            {f.last_evaluated_at ? new Date(f.last_evaluated_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center space-x-1">
                                                {f.stale && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">stale</span>
                                                )}
                                                {!f.has_owner && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">no owner</span>
                                                )}
                                                {f.error_count > 0 && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">errors</span>
                                                )}
                                                {!f.stale && f.has_owner && f.error_count === 0 && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">healthy</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

function MetricCard({ icon, label, value, subtitle, alert }: {
    icon: React.ReactNode
    label: string
    value: string
    subtitle?: string
    alert?: boolean
}) {
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
            alert ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
        }`}>
            <div className="flex items-center space-x-3 mb-2">
                {icon}
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                {value}
            </p>
            {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
    )
}

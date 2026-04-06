import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { Building2, Users, Flag, Activity, Key, Server, Database, Clock } from 'lucide-react'

interface AdminOverviewData {
    total_organizations: number
    total_users: number
    total_flags: number
    total_evaluations: number
    active_api_keys: number
    evaluations_over_time: Array<{ date: string; count: number }>
    flags_created_over_time: Array<{ date: string; count: number }>
    system_health: {
        api_version: string
        uptime_seconds: number
        db_status: string
    }
}

const MOCK_DATA: AdminOverviewData = {
    total_organizations: 24,
    total_users: 187,
    total_flags: 1_432,
    total_evaluations: 8_294_521,
    active_api_keys: 63,
    evaluations_over_time: Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        return {
            date: d.toISOString().slice(5, 10),
            count: Math.floor(200_000 + Math.random() * 150_000),
        }
    }),
    flags_created_over_time: Array.from({ length: 30 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        return {
            date: d.toISOString().slice(5, 10),
            count: Math.floor(2 + Math.random() * 8),
        }
    }),
    system_health: {
        api_version: '1.0.0',
        uptime_seconds: 864_000,
        db_status: 'healthy',
    },
}

function formatUptime(seconds: number) {
    const days = Math.floor(seconds / 86_400)
    const hours = Math.floor((seconds % 86_400) / 3_600)
    return `${days}d ${hours}h`
}

function formatNumber(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toString()
}

function normalizeOverview(raw: Record<string, unknown>): AdminOverviewData {
    // The API returns a flat object; map it to AdminOverviewData
    const evalsByDay = (raw.evaluations_by_day as Array<{ date: string; count: number }> | undefined) ?? []
    return {
        total_organizations: (raw.total_organizations as number | undefined) ?? 0,
        total_users: (raw.total_users as number | undefined) ?? 0,
        total_flags: (raw.total_flags as number | undefined) ?? 0,
        total_evaluations: (raw.total_evaluations as number | undefined) ?? 0,
        active_api_keys: (raw.active_api_keys as number | undefined) ?? 0,
        evaluations_over_time: evalsByDay,
        flags_created_over_time: (raw.flags_created_over_time as Array<{ date: string; count: number }> | undefined) ?? [],
        system_health: {
            api_version: String((raw.api_version as string | undefined) ?? ''),
            uptime_seconds: (raw.uptime_seconds as number | undefined) ?? 0,
            db_status: String((raw.database_status as string | undefined) ?? (raw.db_status as string | undefined) ?? 'unknown'),
        },
    }
}

export default function AdminOverview() {
    const { data: rawData, isError } = useQuery({
        queryKey: ['admin', 'overview'],
        queryFn: () => adminApi.getOverview().then(r => normalizeOverview(r.data as Record<string, unknown>)),
        retry: false,
    })

    const data = isError || !rawData ? MOCK_DATA : rawData
    const showBanner = isError || !rawData

    const stats = [
        { label: 'Organizations', value: data.total_organizations, icon: Building2, gradient: 'from-primary-800 to-primary-500' },
        { label: 'Users', value: data.total_users, icon: Users, gradient: 'from-primary-500 to-primary-400' },
        { label: 'Total Flags', value: data.total_flags, icon: Flag, gradient: 'from-primary-900 to-primary-950' },
        { label: 'Total Evaluations', value: data.total_evaluations, icon: Activity, gradient: 'from-primary-500 to-green-500' },
        { label: 'Active API Keys', value: data.active_api_keys, icon: Key, gradient: 'from-primary-950 to-primary-800' },
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Overview</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Platform-wide statistics and health</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8" title="Platform-wide metrics across all tenants">
                {stats.map(s => (
                    <div key={s.label} className="card relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${s.gradient}`} />
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(s.value)}</p>
                            </div>
                            <div className={`p-2.5 rounded-lg bg-gradient-to-br ${s.gradient}`}>
                                <s.icon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Evaluation trend — simple bar sparkline to avoid Recharts crashes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Evaluations (Last 30 Days)</h2>
                    {data.evaluations_over_time.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No evaluation data available</p>
                    ) : (
                        <div className="flex items-end gap-0.5 h-32">
                            {data.evaluations_over_time.slice(-30).map((d, i) => {
                                const max = Math.max(...data.evaluations_over_time.map(x => x.count), 1)
                                const pct = Math.max((d.count / max) * 100, 2)
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count.toLocaleString()}`}>
                                        <div className="w-full bg-primary-500 dark:bg-primary-400 rounded-t" style={{ height: `${pct}%` }} />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
                        Total: {formatNumber(data.evaluations_over_time.reduce((s, d) => s + d.count, 0))}
                    </p>
                </div>

                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Flags Created (Last 30 Days)</h2>
                    {data.flags_created_over_time.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">No flag creation data available</p>
                    ) : (
                        <div className="flex items-end gap-0.5 h-32">
                            {data.flags_created_over_time.slice(-30).map((d, i) => {
                                const max = Math.max(...data.flags_created_over_time.map(x => x.count), 1)
                                const pct = Math.max((d.count / max) * 100, 2)
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count}`}>
                                        <div className="w-full bg-indigo-700 dark:bg-indigo-500 rounded-t" style={{ height: `${pct}%` }} />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
                        Total: {data.flags_created_over_time.reduce((s, d) => s + d.count, 0)} flags
                    </p>
                </div>
            </div>

            {/* System Health */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Health</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                            <Server className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">API Version</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data.system_health.api_version}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                            <Clock className="w-5 h-5 text-success-600 dark:text-success-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Uptime</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatUptime(data.system_health.uptime_seconds)}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                            <Database className="w-5 h-5 text-success-600 dark:text-success-400" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Database</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{data.system_health.db_status}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

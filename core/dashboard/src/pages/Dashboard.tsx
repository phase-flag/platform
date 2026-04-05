import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { flagsApi, auditApi } from '@/lib/api'
import { Flag, ToggleRight, Archive, Power } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import clsx from 'clsx'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import Skeleton from '@/components/Skeleton'

/* Recharts 2.x class components have type issues with @types/react 18 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RTooltip = Tooltip as any
const RBar = Bar as any
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function Dashboard() {
    const { environment } = useEnvironment()

    const { data: paginatedFlags, isLoading: flagsLoading } = useQuery({
        queryKey: ['flags', environment],
        queryFn: () => flagsApi.list(environment).then(res => res.data),
    })

    const flags = paginatedFlags?.items

    const { data: auditLogs, isLoading: auditLoading } = useQuery({
        queryKey: ['audit-recent'],
        queryFn: () => auditApi.list({ limit: 5 }).then(res => res.data),
    })

    if (flagsLoading || auditLoading) {
        return (
            <div className="p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Welcome to Phase Flag</p>
                </div>
                <Skeleton variant="stat" count={4} className="mb-8" />
            </div>
        )
    }

    const totalFlags = paginatedFlags?.total || 0
    const activeFlags = flags?.filter(f => f.status === 'active')?.length || 0
    const inactiveFlags = flags?.filter(f => f.status === 'inactive')?.length || 0
    const archivedFlags = flags?.filter(f => f.status === 'archived')?.length || 0

    const stats = [
        { name: 'Total Flags', value: totalFlags, icon: Flag, color: 'text-primary-600', bg: 'bg-primary-100 dark:bg-primary-900/40' },
        { name: 'Active', value: activeFlags, icon: ToggleRight, color: 'text-success-600', bg: 'bg-success-100 dark:bg-success-900/40' },
        { name: 'Inactive', value: inactiveFlags, icon: Power, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
        { name: 'Archived', value: archivedFlags, icon: Archive, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
    ]

    const envChartData = useMemo(() => {
        if (!flags) return []
        const counts: Record<string, number> = {}
        flags.forEach(f => {
            counts[f.environment] = (counts[f.environment] || 0) + 1
        })
        return Object.entries(counts).map(([env, count]) => ({
            environment: env.charAt(0).toUpperCase() + env.slice(1),
            count,
        }))
    }, [flags])

    const BAR_COLORS = ['#6366F1', '#22c55e', '#f59e0b', '#ef4444']

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Welcome to Phase Flag</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.name} className="card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Flags by Environment Chart */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Flags by Environment</h2>
                    {envChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={envChartData}>
                                <RXAxis dataKey="environment" tick={{ fontSize: 12, fill: '#8FA3AD' }} />
                                <RYAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#8FA3AD' }} />
                                <RTooltip contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #4338CA', color: '#E0E7FF' }} />
                                <RBar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {envChartData.map((_: unknown, index: number) => (
                                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                    ))}
                                </RBar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-12">No flag data to display</p>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h2>
                    {auditLogs && auditLogs.length > 0 ? (
                        <div className="space-y-3">
                            {auditLogs.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                                    <div className="flex items-center space-x-3">
                                        <span className={clsx(
                                            'badge text-xs',
                                            entry.action === 'created' && 'badge-success',
                                            entry.action === 'updated' && 'badge-info',
                                            entry.action === 'toggled' && 'badge-warning',
                                            entry.action === 'archived' && 'badge-danger',
                                        )}>
                                            {entry.action}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.entity_key}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{entry.actor}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(entry.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-12">No recent activity</p>
                    )}
                </div>
            </div>

            {/* Recent Flags */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Feature Flags</h2>
                    <Link to="/flags" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                        View all →
                    </Link>
                </div>
                <div className="space-y-3">
                    {flags?.slice(0, 5).map((flag) => {
                        const isActive = flag.status === 'active'
                        return (
                            <Link
                                key={flag.id}
                                to={`/flags/${flag.key}`}
                                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success-500' : 'bg-gray-400'}`} />
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{flag.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{flag.key}</p>
                                    </div>
                                </div>
                                <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                                    {flag.status}
                                </span>
                            </Link>
                        )
                    })}
                    {(!flags || flags.length === 0) && (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">No flags yet</p>
                    )}
                </div>
            </div>
        </div>
    )
}

import { useQuery } from '@tanstack/react-query'
import { flagsApi } from '@/lib/api'
import { Flag, ToggleRight, Archive, Power } from 'lucide-react'
import { Link } from 'react-router-dom'
// Environment context available but dashboard shows all flags
import Skeleton from '@/components/Skeleton'

export default function Dashboard() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['flags'],
        queryFn: () => flagsApi.list().then(res => res.data),
        retry: false,
    })

    if (isLoading) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Welcome to Phase Flag</p>
                <Skeleton variant="stat" count={4} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Welcome to Phase Flag</p>
                <div className="card">
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                        Unable to load dashboard data. Please try refreshing the page.
                    </p>
                </div>
            </div>
        )
    }

    // Safely extract flags from any response shape
    let flags: any[] = []
    if (Array.isArray(data)) {
        flags = data
    } else if (data && typeof data === 'object' && 'items' in data) {
        flags = Array.isArray((data as any).items) ? (data as any).items : []
    }

    const totalFlags = (data as any)?.total ?? flags.length
    const activeFlags = flags.filter((f: any) => f.enabled === true || f.status === 'active').length
    const inactiveFlags = flags.filter((f: any) => (f.enabled === false || f.status === 'inactive') && f.status !== 'archived').length
    const archivedFlags = flags.filter((f: any) => f.status === 'archived').length

    const stats = [
        { name: 'Total Flags', value: totalFlags, icon: Flag, color: 'text-primary-600', bg: 'bg-primary-100 dark:bg-primary-900/40', tooltip: 'Total number of feature flags across all environments' },
        { name: 'Active', value: activeFlags, icon: ToggleRight, color: 'text-success-600', bg: 'bg-success-100 dark:bg-success-900/40', tooltip: 'Flags currently enabled and serving traffic' },
        { name: 'Inactive', value: inactiveFlags, icon: Power, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700', tooltip: 'Flags that exist but are currently disabled' },
        { name: 'Archived', value: archivedFlags, icon: Archive, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/40', tooltip: 'Flags that have been archived and removed from evaluation' },
    ]

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Welcome to Phase Flag</p>
            </div>

            <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.name} className="card" title={stat.tooltip}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{String(stat.value)}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Feature Flags</h2>
                    <Link to="/flags" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                        View all &rarr;
                    </Link>
                </div>
                <div className="space-y-3">
                    {flags.slice(0, 5).map((flag: any) => (
                        <Link
                            key={String(flag.id || flag.key)}
                            to={`/flags/${String(flag.key)}`}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                        >
                            <div className="flex items-center space-x-3">
                                <div className={`w-2 h-2 rounded-full ${flag.enabled ? 'bg-success-500' : 'bg-gray-400'}`} />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{String(flag.name || flag.key)}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{String(flag.key)}</p>
                                </div>
                            </div>
                            <span className={`badge ${flag.enabled ? 'badge-success' : 'badge-danger'}`}>
                                {flag.enabled ? 'enabled' : 'disabled'}
                            </span>
                        </Link>
                    ))}
                    {flags.length === 0 && (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">No flags yet. Create your first feature flag to get started.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

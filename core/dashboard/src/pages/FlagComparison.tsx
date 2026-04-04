import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { flagsApi, type FeatureFlag } from '@/lib/api'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'

const ENVIRONMENTS = ['development', 'staging', 'production'] as const

interface ComparisonRow {
    key: string
    name: string
    envFlags: Record<string, FeatureFlag | null>
    hasDiff: boolean
}

export default function FlagComparison() {
    const devQuery = useQuery({
        queryKey: ['flags', 'development'],
        queryFn: () => flagsApi.list('development', { limit: 200 }).then(r => r.data),
    })
    const stagingQuery = useQuery({
        queryKey: ['flags', 'staging'],
        queryFn: () => flagsApi.list('staging', { limit: 200 }).then(r => r.data),
    })
    const prodQuery = useQuery({
        queryKey: ['flags', 'production'],
        queryFn: () => flagsApi.list('production', { limit: 200 }).then(r => r.data),
    })

    const isLoading = devQuery.isLoading || stagingQuery.isLoading || prodQuery.isLoading

    const rows = useMemo<ComparisonRow[]>(() => {
        const envData: Record<string, FeatureFlag[]> = {
            development: devQuery.data?.items || [],
            staging: stagingQuery.data?.items || [],
            production: prodQuery.data?.items || [],
        }

        // Collect all unique flag keys
        const keySet = new Set<string>()
        const nameMap: Record<string, string> = {}
        for (const env of ENVIRONMENTS) {
            for (const flag of envData[env]) {
                keySet.add(flag.key)
                nameMap[flag.key] = flag.name
            }
        }

        // Build index maps
        const envIndex: Record<string, Record<string, FeatureFlag>> = {}
        for (const env of ENVIRONMENTS) {
            envIndex[env] = {}
            for (const flag of envData[env]) {
                envIndex[env][flag.key] = flag
            }
        }

        // Build comparison rows
        const result: ComparisonRow[] = []
        for (const key of Array.from(keySet).sort()) {
            const envFlags: Record<string, FeatureFlag | null> = {}
            const statuses: (string | null)[] = []
            for (const env of ENVIRONMENTS) {
                const flag = envIndex[env][key] || null
                envFlags[env] = flag
                statuses.push(flag?.status ?? null)
            }
            const hasDiff = !statuses.every(s => s === statuses[0])
            result.push({ key, name: nameMap[key], envFlags, hasDiff })
        }

        // Show differing flags first
        result.sort((a, b) => {
            if (a.hasDiff !== b.hasDiff) return a.hasDiff ? -1 : 1
            return a.key.localeCompare(b.key)
        })

        return result
    }, [devQuery.data, stagingQuery.data, prodQuery.data])

    if (isLoading) {
        return <div className="p-8">Loading environments...</div>
    }

    return (
        <div className="p-8">
            <div className="flex items-center space-x-4 mb-8">
                <Link to="/flags" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Compare Environments</h1>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                        Side-by-side flag comparison across all environments
                    </p>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">No flags found in any environment.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">
                                    Flag
                                </th>
                                {ENVIRONMENTS.map(env => (
                                    <th key={env} className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">
                                        {env.charAt(0).toUpperCase() + env.slice(1)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr
                                    key={row.key}
                                    className={clsx(
                                        'border-b border-gray-100 dark:border-gray-800',
                                        row.hasDiff && 'bg-warning-50 dark:bg-warning-900/20'
                                    )}
                                >
                                    <td className="py-3 px-4">
                                        <Link
                                            to={`/flags/${row.key}`}
                                            className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                                        >
                                            {row.name}
                                        </Link>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{row.key}</p>
                                    </td>
                                    {ENVIRONMENTS.map(env => {
                                        const flag = row.envFlags[env]
                                        if (!flag) {
                                            return (
                                                <td key={env} className="text-center py-3 px-4">
                                                    <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                        Not configured
                                                    </span>
                                                </td>
                                            )
                                        }
                                        return (
                                            <td key={env} className="text-center py-3 px-4">
                                                <span className={clsx(
                                                    'badge',
                                                    flag.status === 'active' && 'badge-success',
                                                    flag.status === 'inactive' && 'badge-danger',
                                                    flag.status === 'archived' && 'badge-warning',
                                                )}>
                                                    {flag.status}
                                                </span>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {rows.filter(r => r.hasDiff).length} of {rows.length} flags differ across environments
            </div>
        </div>
    )
}

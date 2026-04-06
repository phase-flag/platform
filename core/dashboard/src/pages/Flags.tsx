import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { flagsApi } from '@/lib/api'
import { Plus, Search, ToggleLeft, ToggleRight, X, Archive, GitCompare, ChevronLeft, ChevronRight, Download, Upload, Flag } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import CreateFlagModal from '@/components/CreateFlagModal'
import EmptyState from '@/components/EmptyState'
import Skeleton from '@/components/Skeleton'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import { useToast } from '@/contexts/ToastContext'

const STATUS_OPTIONS = ['all', 'active', 'inactive', 'archived'] as const
const ENV_OPTIONS = ['all', 'development', 'staging', 'production'] as const
const SORT_OPTIONS = [
    { value: 'updated', label: 'Recently Updated' },
    { value: 'name', label: 'Name' },
    { value: 'evaluations', label: 'Most Evaluated' },
    { value: 'last_evaluated', label: 'Last Evaluated' },
] as const
const PAGE_SIZE = 20

export default function Flags() {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [searchParams, setSearchParams] = useSearchParams()
    const { environment } = useEnvironment()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
    const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number } | null>(null)
    async function handleExport() {
        try {
            const res = await flagsApi.exportFlags()
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `phaseflag-flags-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            toast('success', 'Flags exported')
        } catch {
            toast('error', 'Failed to export flags')
        }
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const text = await file.text()
            const data = JSON.parse(text)
            await flagsApi.importFlags(data)
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            toast('success', 'Flags imported successfully')
        } catch {
            toast('error', 'Failed to import flags. Check file format.')
        }
        // reset file input
        e.target.value = ''
    }

    const search = searchParams.get('search') || ''
    const statusFilter = searchParams.get('status') || 'all'
    const envFilter = searchParams.get('env') || 'all'
    const sortBy = searchParams.get('sort') || 'updated'
    const page = parseInt(searchParams.get('page') || '1', 10)

    function updateParam(key: string, value: string) {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            if (value === '' || value === 'all') {
                next.delete(key)
            } else {
                next.set(key, value)
            }
            return next
        })
    }

    const offset = (page - 1) * PAGE_SIZE

    const { data: paginatedData, isLoading } = useQuery({
        queryKey: ['flags', environment, page],
        queryFn: () => flagsApi.list(environment, { limit: PAGE_SIZE, offset }).then(res => res.data),
    })

    const flags = paginatedData?.items
    const totalFlags = paginatedData?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(totalFlags / PAGE_SIZE))

    const filteredFlags = useMemo(() => {
        if (!flags) return []
        const filtered = flags.filter(flag => {
            if (search) {
                const q = search.toLowerCase()
                const matchesSearch =
                    flag.key.toLowerCase().includes(q) ||
                    flag.name.toLowerCase().includes(q) ||
                    (flag.description && flag.description.toLowerCase().includes(q))
                if (!matchesSearch) return false
            }
            if (statusFilter !== 'all' && flag.status !== statusFilter) return false
            if (envFilter !== 'all' && flag.environment !== envFilter) return false
            return true
        })
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name)
                case 'evaluations':
                    return b.evaluation_count - a.evaluation_count
                case 'last_evaluated':
                    if (!a.last_evaluated_at && !b.last_evaluated_at) return 0
                    if (!a.last_evaluated_at) return 1
                    if (!b.last_evaluated_at) return -1
                    return new Date(b.last_evaluated_at).getTime() - new Date(a.last_evaluated_at).getTime()
                default:
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            }
        })
    }, [flags, search, statusFilter, envFilter, sortBy])

    const hasActiveFilters = search !== '' || statusFilter !== 'all' || envFilter !== 'all' || sortBy !== 'updated'

    function toggleSelect(key: string) {
        setSelectedKeys(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    function toggleSelectAll() {
        if (selectedKeys.size === filteredFlags.length) {
            setSelectedKeys(new Set())
        } else {
            setSelectedKeys(new Set(filteredFlags.map(f => f.key)))
        }
    }

    async function bulkAction(action: 'toggle' | 'archive') {
        const keys = Array.from(selectedKeys)
        setBulkProgress({ total: keys.length, done: 0 })
        const results = await Promise.allSettled(
            keys.map(async (key, i) => {
                const result = action === 'toggle'
                    ? await flagsApi.toggle(key)
                    : await flagsApi.archive(key)
                setBulkProgress(prev => prev ? { ...prev, done: i + 1 } : null)
                return result
            })
        )
        const failed = results.filter(r => r.status === 'rejected').length
        setBulkProgress(null)
        setSelectedKeys(new Set())
        queryClient.invalidateQueries({ queryKey: ['flags'] })
        if (failed === 0) {
            toast('success', `${action === 'toggle' ? 'Toggled' : 'Archived'} ${keys.length} flags`)
        } else {
            toast('error', `${failed} of ${keys.length} operations failed`)
        }
    }

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Feature Flags</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage feature flags and targeting rules</p>
                    </div>
                </div>
                <Skeleton variant="row" count={3} />
            </div>
        )
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Feature Flags</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage feature flags and targeting rules</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={handleExport} className="btn btn-secondary flex items-center space-x-2" title="Export flags as JSON">
                        <Download className="w-5 h-5" />
                        <span>Export</span>
                    </button>
                    <label className="btn btn-secondary flex items-center space-x-2 cursor-pointer" title="Import flags from JSON">
                        <Upload className="w-5 h-5" />
                        <span>Import</span>
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                    <Link to="/flags/compare" title="Compare flag configurations across environments" className="btn btn-secondary flex items-center space-x-2">
                        <GitCompare className="w-5 h-5" />
                        <span>Compare</span>
                    </Link>
                    <button onClick={() => setShowCreateModal(true)} title="Create a new feature flag" className="btn btn-primary flex items-center space-x-2">
                        <Plus className="w-5 h-5" />
                        <span>Create Flag</span>
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => updateParam('search', e.target.value)}
                        placeholder="Search by key, name, or description..."
                        title="Search flags by name or key"
                        className="input pl-10"
                    />
                    {search && (
                        <button
                            onClick={() => updateParam('search', '')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        </button>
                    )}
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => updateParam('status', e.target.value)}
                    title="Filter flags by their current status"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                    {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>
                            {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                    ))}
                </select>
                <select
                    value={envFilter}
                    onChange={(e) => updateParam('env', e.target.value)}
                    title="Show flags for a specific environment"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                    {ENV_OPTIONS.map(e => (
                        <option key={e} value={e}>
                            {e === 'all' ? 'All Environments' : e.charAt(0).toUpperCase() + e.slice(1)}
                        </option>
                    ))}
                </select>
                <select
                    value={sortBy}
                    onChange={(e) => updateParam('sort', e.target.value)}
                    title="Sort flags by this criterion"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                    {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                {hasActiveFilters && (
                    <button
                        onClick={() => setSearchParams({})}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Bulk Action Bar */}
            {selectedKeys.size > 0 && (
                <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                            {selectedKeys.size} flag{selectedKeys.size !== 1 ? 's' : ''} selected
                        </span>
                        {bulkProgress && (
                            <span className="text-sm text-primary-600 dark:text-primary-300">
                                ({bulkProgress.done}/{bulkProgress.total} completed)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => bulkAction('toggle')}
                            disabled={!!bulkProgress}
                            title="Toggle all selected flags on or off"
                            className="px-3 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-200 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center space-x-1"
                        >
                            <ToggleRight className="w-4 h-4" />
                            <span>Toggle All</span>
                        </button>
                        <button
                            onClick={() => bulkAction('archive')}
                            disabled={!!bulkProgress}
                            title="Archive all selected flags — removes them from evaluation"
                            className="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 flex items-center space-x-1"
                        >
                            <Archive className="w-4 h-4" />
                            <span>Archive All</span>
                        </button>
                        <button
                            onClick={() => setSelectedKeys(new Set())}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                            Clear selection
                        </button>
                    </div>
                </div>
            )}

            {/* Select All */}
            {filteredFlags.length > 0 && (
                <div className="flex items-center space-x-2 mb-4">
                    <input
                        type="checkbox"
                        checked={selectedKeys.size === filteredFlags.length && filteredFlags.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Select all</span>
                </div>
            )}

            {/* Flags List */}
            <div className="space-y-4">
                {filteredFlags.map((flag) => {
                    const isActive = flag.status === 'active'
                    return (
                        <div key={flag.id} title="Click to view flag details, targeting rules, and analytics" className="card hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 flex items-start space-x-3">
                            <input
                                type="checkbox"
                                checked={selectedKeys.has(flag.key)}
                                onChange={() => toggleSelect(flag.key)}
                                title="Select this flag for bulk actions"
                                className="mt-1.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                            />
                            <Link to={`/flags/${flag.key}`} className="flex-1 block">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            {isActive ? (
                                                <ToggleRight className="w-6 h-6 text-success-500" />
                                            ) : (
                                                <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                            )}
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{flag.name}</h3>
                                            <span className={clsx(
                                                'badge',
                                                isActive ? 'badge-success' : flag.status === 'archived' ? 'badge-warning' : 'badge-danger'
                                            )}>
                                                {flag.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{flag.description}</p>
                                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                                            <span className="font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">{flag.key}</span>
                                            <span className="badge badge-info">{flag.flag_type}</span>
                                            <span>{flag.variations.length} variations</span>
                                            {flag.tags.map(tag => (
                                                <span key={tag} className="badge bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Updated {new Date(flag.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    )
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalFlags)} of {totalFlags} flags
                    </p>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => updateParam('page', String(page - 1))}
                            disabled={page <= 1}
                            title="Go to previous page"
                            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum: number
                            if (totalPages <= 5) {
                                pageNum = i + 1
                            } else if (page <= 3) {
                                pageNum = i + 1
                            } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i
                            } else {
                                pageNum = page - 2 + i
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => updateParam('page', String(pageNum))}
                                    className={clsx(
                                        'px-3 py-1.5 text-sm rounded-lg border',
                                        pageNum === page
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}
                        <button
                            onClick={() => updateParam('page', String(page + 1))}
                            disabled={page >= totalPages}
                            title="Go to next page"
                            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Empty states */}
            {flags && flags.length > 0 && filteredFlags.length === 0 && (
                <div className="card text-center py-12">
                    <Search className="mx-auto w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No flags match your filters</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search or filter criteria</p>
                    <button onClick={() => setSearchParams({})} className="btn btn-secondary">
                        Clear all filters
                    </button>
                </div>
            )}

            {flags?.length === 0 && (
                <EmptyState
                    icon={Flag}
                    title="No feature flags yet"
                    description="Get started by creating your first feature flag"
                    actionLabel="Create Flag"
                    onAction={() => setShowCreateModal(true)}
                />
            )}

            <CreateFlagModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </div>
    )
}

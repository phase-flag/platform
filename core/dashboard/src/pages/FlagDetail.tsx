import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { flagsApi, auditApi, analyticsApi } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ArrowLeft, ToggleLeft, ToggleRight, Edit, Trash2, Copy, RotateCcw, Clock, GitBranch, AlertTriangle, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import EditFlagModal from '@/components/EditFlagModal'
import TargetingRuleBuilder from '@/components/TargetingRuleBuilder'
import TagInput from '@/components/TagInput'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import { useToast } from '@/contexts/ToastContext'

type Tab = 'configuration' | 'analytics' | 'audit'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RTooltip = Tooltip as any
const RLegend = Legend as any
const RLine = Line as any

const PERIOD_OPTIONS = [
    { value: '1', label: 'Last 24h', period: 'hour' },
    { value: '7', label: 'Last 7 days', period: 'day' },
    { value: '30', label: 'Last 30 days', period: 'day' },
] as const

export default function FlagDetail() {
    const { flagKey } = useParams<{ flagKey: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { environment } = useEnvironment()
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState<Tab>('configuration')
    const [showEditModal, setShowEditModal] = useState(false)
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [scheduleDate, setScheduleDate] = useState('')
    const [scheduleStatus, setScheduleStatus] = useState('active')
    const [analyticsPeriod, setAnalyticsPeriod] = useState<typeof PERIOD_OPTIONS[number]>(PERIOD_OPTIONS[1])

    const { data: flag, isLoading } = useQuery({
        queryKey: ['flag', flagKey, environment],
        queryFn: () => flagsApi.get(flagKey!, environment).then(res => res.data),
        enabled: !!flagKey,
    })

    const { data: auditLogs, isLoading: auditLoading } = useQuery({
        queryKey: ['audit', flagKey],
        queryFn: () => auditApi.listForFlag(flagKey!).then(res => res.data),
        enabled: !!flagKey && activeTab === 'audit',
    })

    const { data: analyticsData } = useQuery({
        queryKey: ['analytics', flagKey, analyticsPeriod.value],
        queryFn: () => analyticsApi.flagEvaluations(flagKey!, {
            period: analyticsPeriod.period,
            days: Number(analyticsPeriod.value),
        }).then(res => res.data),
        enabled: !!flagKey && activeTab === 'analytics',
    })

    const chartData = useMemo(() => {
        if (!analyticsData || analyticsData.length === 0) return { data: [], variations: [] }
        // Pivot: group by period, one key per variation
        const variationSet = new Set<string>()
        const periodMap: Record<string, Record<string, number>> = {}
        for (const bucket of analyticsData) {
            const vk = bucket.variation_key || 'unknown'
            variationSet.add(vk)
            if (!periodMap[bucket.period]) periodMap[bucket.period] = {}
            periodMap[bucket.period][vk] = (periodMap[bucket.period][vk] || 0) + bucket.count
        }
        const variations = Array.from(variationSet)
        const data = Object.entries(periodMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, counts]) => ({ period, ...counts }))
        return { data, variations }
    }, [analyticsData])

    const toggleMutation = useMutation({
        mutationFn: () => flagsApi.toggle(flagKey!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flagKey] })
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            toast('success', 'Flag toggled successfully')
        },
        onError: (err) => toast('error', `Toggle failed: ${(err as Error).message}`),
    })

    const archiveMutation = useMutation({
        mutationFn: () => flagsApi.archive(flagKey!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            toast('success', 'Flag archived')
            navigate('/flags')
        },
        onError: (err) => toast('error', `Archive failed: ${(err as Error).message}`),
    })

    const deleteMutation = useMutation({
        mutationFn: () => flagsApi.delete(flagKey!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            toast('success', 'Flag permanently deleted')
            navigate('/flags')
        },
        onError: (err) => toast('error', `Delete failed: ${(err as Error).message}`),
    })

    const restoreMutation = useMutation({
        mutationFn: () => flagsApi.restore(flagKey!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flagKey] })
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            toast('success', 'Flag restored')
        },
        onError: (err) => toast('error', `Restore failed: ${(err as Error).message}`),
    })

    const cloneMutation = useMutation({
        mutationFn: () => flagsApi.clone(flagKey!),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['flags'] })
            toast('success', 'Flag cloned')
            navigate(`/flags/${res.data.key}`)
        },
        onError: (err) => toast('error', `Clone failed: ${(err as Error).message}`),
    })

    const tagsMutation = useMutation({
        mutationFn: (tags: string[]) => flagsApi.update(flagKey!, { tags }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flagKey] })
            toast('success', 'Tags updated')
        },
        onError: (err) => toast('error', `Tag update failed: ${(err as Error).message}`),
    })

    const scheduleMutation = useMutation({
        mutationFn: (data: { scheduled_on: string; scheduled_status: string }) =>
            flagsApi.schedule(flagKey!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flagKey] })
            toast('success', 'Schedule set successfully')
            setShowScheduleModal(false)
        },
        onError: (err) => toast('error', `Schedule failed: ${(err as Error).message}`),
    })

    const cancelScheduleMutation = useMutation({
        mutationFn: () => flagsApi.cancelSchedule(flagKey!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flag', flagKey] })
            toast('success', 'Schedule cancelled')
        },
        onError: (err) => toast('error', `Cancel failed: ${(err as Error).message}`),
    })

    if (isLoading) {
        return <div className="p-8">Loading...</div>
    }

    if (!flag) {
        return <div className="p-8">Flag not found</div>
    }

    const isActive = flag.status === 'active'
    const isArchived = flag.status === 'archived'

    const tabs: Array<{ key: Tab; label: string }> = [
        { key: 'configuration', label: 'Configuration' },
        { key: 'analytics', label: 'Analytics' },
        { key: 'audit', label: 'Audit Log' },
    ]

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <Link to="/flags" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Flags
                </Link>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => toggleMutation.mutate()}
                            disabled={toggleMutation.isPending || isArchived}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isArchived ? 'Cannot toggle archived flag' : isActive ? 'Disable flag' : 'Enable flag'}
                        >
                            {isActive ? (
                                <ToggleRight className="w-8 h-8 text-success-600 hover:text-success-700" />
                            ) : (
                                <ToggleLeft className="w-8 h-8 text-gray-400 dark:text-gray-500 hover:text-gray-500" />
                            )}
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{flag.name}</h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{flag.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {!isArchived && (
                            <button
                                onClick={() => setShowScheduleModal(true)}
                                className="btn btn-secondary flex items-center space-x-2"
                                title="Schedule a status change"
                            >
                                <Clock className="w-5 h-5" />
                                <span>Schedule</span>
                            </button>
                        )}
                        <button
                            onClick={() => cloneMutation.mutate()}
                            disabled={cloneMutation.isPending}
                            className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
                            title="Clone this flag"
                        >
                            <Copy className="w-5 h-5" />
                            <span>Clone</span>
                        </button>
                        <button onClick={() => setShowEditModal(true)} title="Modify flag name, description, and settings" className="btn btn-secondary flex items-center space-x-2">
                            <Edit className="w-5 h-5" />
                            <span>Edit</span>
                        </button>
                        {isArchived && (
                            <button
                                onClick={() => restoreMutation.mutate()}
                                disabled={restoreMutation.isPending}
                                className="btn btn-primary flex items-center space-x-2 disabled:opacity-50"
                            >
                                <RotateCcw className="w-5 h-5" />
                                <span>Restore</span>
                            </button>
                        )}
                        {!isArchived && (
                            <button
                                onClick={() => setShowArchiveConfirm(true)}
                                disabled={archiveMutation.isPending}
                                title="Archive this flag — removes it from evaluation"
                                className="btn btn-danger flex items-center space-x-2 disabled:opacity-50"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span>Archive</span>
                            </button>
                        )}
                        {isArchived && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={deleteMutation.isPending}
                                className="btn btn-danger flex items-center space-x-2 disabled:opacity-50"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span>Delete Permanently</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error display */}
            {(toggleMutation.isError || archiveMutation.isError) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {toggleMutation.isError && `Toggle failed: ${(toggleMutation.error as Error)?.message || 'Unknown error'}`}
                    {archiveMutation.isError && `Archive failed: ${(archiveMutation.error as Error)?.message || 'Unknown error'}`}
                </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                <div className="card" title="Whether this flag is active, inactive, or archived">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                    <p className={`text-lg font-semibold ${isActive ? 'text-success-600' : isArchived ? 'text-yellow-600' : 'text-gray-600 dark:text-gray-400'}`}>
                        {flag.status}
                    </p>
                </div>
                <div className="card" title="The data type this flag returns: boolean, string, number, or json">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Type</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{flag.flag_type}</p>
                </div>
                <div className="card" title="The deployment environment this flag configuration applies to">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Environment</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{flag.environment}</p>
                </div>
                <div className="card" title="The current lifecycle stage of this flag: development, testing, production, stale, or archived">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Lifecycle</p>
                    <p className={clsx('text-lg font-semibold', {
                        'text-blue-600': flag.lifecycle_stage === 'development',
                        'text-amber-600': flag.lifecycle_stage === 'testing',
                        'text-success-600': flag.lifecycle_stage === 'production',
                        'text-orange-500': flag.lifecycle_stage === 'stale',
                        'text-gray-500': flag.lifecycle_stage === 'archived' || !flag.lifecycle_stage,
                    })}>
                        {flag.lifecycle_stage || 'development'}
                        {flag.lifecycle_stage === 'stale' && <AlertTriangle className="inline w-4 h-4 ml-1" />}
                    </p>
                </div>
                <div className="card" title="Evaluation count and usage metrics for this flag">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Evaluations</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{flag.evaluation_count.toLocaleString()}</p>
                </div>
                <div className="card" title="The most recent time this flag was evaluated by an SDK">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Evaluated</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {flag.last_evaluated_at ? new Date(flag.last_evaluated_at).toLocaleDateString() : 'Never'}
                    </p>
                </div>
            </div>

            {/* Scheduling Banner */}
            {flag.scheduled_on && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-amber-600" />
                        <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Scheduled: will change to <strong>{flag.scheduled_status}</strong> on{' '}
                                {new Date(flag.scheduled_on).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => cancelScheduleMutation.mutate()}
                        disabled={cancelScheduleMutation.isPending}
                        className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 disabled:opacity-50"
                    >
                        Cancel Schedule
                    </button>
                </div>
            )}

            {/* Prerequisites Banner */}
            {flag.prerequisites && flag.prerequisites.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <GitBranch className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Prerequisites</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {flag.prerequisites.map((p, i) => (
                            <Link
                                key={i}
                                to={`/flags/${p.flag_key}`}
                                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/50"
                            >
                                {p.flag_key} = {p.variation_key}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Tags */}
            <div className="card mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Tags</h2>
                <TagInput
                    tags={flag.tags}
                    onChange={(tags) => tagsMutation.mutate(tags)}
                />
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="flex space-x-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={clsx(
                                'py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                                activeTab === tab.key
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'configuration' && (
                <>
                    {/* Variations */}
                    <div className="card mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4" title="The possible values this flag can return">Variations</h2>
                        <div className="space-y-3">
                            {flag.variations.map((variation) => (
                                <div key={variation.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{variation.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{variation.key}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
                                            {JSON.stringify(variation.value)}
                                        </p>
                                        {variation.id === flag.default_variation_id && (
                                            <span className="badge badge-info mt-1">Default</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Targeting Rules */}
                    <TargetingRuleBuilder flag={flag} />
                </>
            )}

            {activeTab === 'analytics' && (
                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100" title="Evaluation count and usage metrics for this flag over time">Evaluation Analytics</h2>
                        <div className="flex items-center space-x-2">
                            {PERIOD_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setAnalyticsPeriod(opt)}
                                    className={clsx(
                                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                                        analyticsPeriod.value === opt.value
                                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {analyticsData && analyticsData.length > 0 && (
                        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                            Total evaluations in period: {analyticsData.reduce((sum, b) => sum + b.count, 0).toLocaleString()}
                        </div>
                    )}

                    {chartData.data.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={chartData.data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <RXAxis dataKey="period" tick={{ fontSize: 12 }} />
                                <RYAxis tick={{ fontSize: 12 }} />
                                <RTooltip />
                                <RLegend />
                                {chartData.variations.map((vk, i) => (
                                    <RLine
                                        key={vk}
                                        type="monotone"
                                        dataKey={vk}
                                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No evaluation data for this period
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'audit' && (
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Change History</h2>
                    {auditLoading && <p className="text-gray-500 dark:text-gray-400">Loading audit logs...</p>}
                    {!auditLoading && (!auditLogs || auditLogs.length === 0) && (
                        <p className="text-gray-500 dark:text-gray-400">No changes recorded yet</p>
                    )}
                    {auditLogs && auditLogs.length > 0 && (
                        <div className="space-y-4">
                            {auditLogs.map((entry) => {
                                const changes = typeof entry.changes === 'string'
                                    ? JSON.parse(entry.changes)
                                    : entry.changes
                                return (
                                    <div key={entry.id} className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex-shrink-0 mt-0.5">
                                            <span className={clsx(
                                                'badge text-xs',
                                                entry.action === 'created' && 'badge-success',
                                                entry.action === 'updated' && 'badge-info',
                                                entry.action === 'toggled' && 'badge-warning',
                                                entry.action === 'archived' && 'badge-danger',
                                                entry.action === 'deleted' && 'badge-danger',
                                            )}>
                                                {entry.action}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.actor}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(entry.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            {changes && Object.keys(changes).length > 0 && (
                                                <div className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                                    {Object.entries(changes).map(([key, val]) => (
                                                        <div key={key}>
                                                            <span className="text-gray-500 dark:text-gray-400">{key}:</span>{' '}
                                                            {JSON.stringify(val)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Edit Modal */}
            <EditFlagModal flag={flag} isOpen={showEditModal} onClose={() => setShowEditModal(false)} />

            {/* Archive Confirmation Dialog */}
            {showArchiveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowArchiveConfirm(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Archive Flag</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to archive <strong>{flag.name}</strong>? This will disable the flag.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowArchiveConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowArchiveConfirm(false)
                                    archiveMutation.mutate()
                                }}
                                disabled={archiveMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                Archive
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Flag Permanently</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            This action cannot be undone. The flag <strong>{flag.name}</strong> and all its variations will be permanently deleted.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    deleteMutation.mutate()
                                }}
                                disabled={deleteMutation.isPending}
                                className="btn btn-danger disabled:opacity-50"
                            >
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowScheduleModal(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Schedule Status Change</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Automatically change this flag's status at a specific time.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Status</label>
                                <select
                                    value={scheduleStatus}
                                    onChange={(e) => setScheduleStatus(e.target.value)}
                                    className="input"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scheduled Date & Time (UTC)</label>
                                <input
                                    type="datetime-local"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <button onClick={() => setShowScheduleModal(false)} className="btn btn-secondary">Cancel</button>
                            <button
                                onClick={() => {
                                    if (!scheduleDate) { toast('error', 'Select a date'); return }
                                    scheduleMutation.mutate({
                                        scheduled_on: new Date(scheduleDate).toISOString(),
                                        scheduled_status: scheduleStatus,
                                    })
                                }}
                                disabled={scheduleMutation.isPending}
                                className="btn btn-primary disabled:opacity-50 flex items-center space-x-2"
                            >
                                <Calendar className="w-4 h-4" />
                                <span>Set Schedule</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

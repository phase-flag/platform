import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { experimentsApi, flagsApi, type Experiment } from '@/lib/api'
import { FlaskConical, Play, Pause, CheckCircle, Plus, TrendingUp, Users, Target } from 'lucide-react'
import clsx from 'clsx'

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    running: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    concluded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export default function Experiments() {
    const queryClient = useQueryClient()
    const [showCreate, setShowCreate] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>('')

    const { data: experiments = [], isLoading } = useQuery({
        queryKey: ['experiments', statusFilter],
        queryFn: () => experimentsApi.list(statusFilter ? { status: statusFilter } : undefined).then(r => r.data),
    })

    const startMutation = useMutation({
        mutationFn: (id: string) => experimentsApi.start(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experiments'] }),
    })

    const stopMutation = useMutation({
        mutationFn: (id: string) => experimentsApi.stop(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experiments'] }),
    })

    const concludeMutation = useMutation({
        mutationFn: (id: string) => experimentsApi.conclude(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['experiments'] }),
    })

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Experiments</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">A/B test feature flag variations with statistical analysis</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Experiment
                </button>
            </div>

            {/* Status filter */}
            <div className="flex gap-2 mb-6">
                {['', 'draft', 'running', 'paused', 'concluded'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={clsx(
                            'px-3 py-1.5 text-sm rounded-lg transition-colors',
                            statusFilter === s
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                        )}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading experiments...</div>
            ) : experiments.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <FlaskConical className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No experiments yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create an experiment to start A/B testing your feature flags.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {experiments.map((exp: Experiment) => (
                        <ExperimentCard
                            key={exp.id}
                            experiment={exp}
                            onStart={() => startMutation.mutate(exp.id)}
                            onStop={() => stopMutation.mutate(exp.id)}
                            onConclude={() => concludeMutation.mutate(exp.id)}
                        />
                    ))}
                </div>
            )}

            {showCreate && <CreateExperimentModal onClose={() => setShowCreate(false)} />}
        </div>
    )
}

function ExperimentCard({
    experiment: exp,
    onStart,
    onStop,
    onConclude,
}: {
    experiment: Experiment
    onStart: () => void
    onStop: () => void
    onConclude: () => void
}) {
    const totalParticipants = exp.variations.reduce((sum, v) => sum + v.participants, 0)
    const totalConversions = exp.variations.reduce((sum, v) => sum + v.conversions, 0)
    const overallRate = totalParticipants > 0 ? (totalConversions / totalParticipants * 100).toFixed(1) : '0.0'

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{exp.flag_key}</h3>
                        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', STATUS_STYLES[exp.status])}>
                            {exp.status}
                        </span>
                    </div>
                    {exp.hypothesis && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{exp.hypothesis}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    {exp.status === 'draft' && (
                        <button onClick={onStart} className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                            <Play className="w-3 h-3 mr-1" /> Start
                        </button>
                    )}
                    {exp.status === 'running' && (
                        <>
                            <button onClick={onStop} className="flex items-center px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                                <Pause className="w-3 h-3 mr-1" /> Pause
                            </button>
                            <button onClick={onConclude} className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <CheckCircle className="w-3 h-3 mr-1" /> Conclude
                            </button>
                        </>
                    )}
                    {exp.status === 'paused' && (
                        <>
                            <button onClick={onStart} className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                                <Play className="w-3 h-3 mr-1" /> Resume
                            </button>
                            <button onClick={onConclude} className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <CheckCircle className="w-3 h-3 mr-1" /> Conclude
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Participants</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalParticipants.toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Conversions</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalConversions.toLocaleString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Conv. Rate</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{overallRate}%</p>
                    </div>
                </div>
            </div>

            {/* Variations */}
            <div className="space-y-2">
                {exp.variations.map(v => {
                    const rate = v.participants > 0 ? (v.conversions / v.participants * 100) : 0
                    const maxParticipants = Math.max(...exp.variations.map(vv => vv.participants), 1)
                    const barWidth = (v.participants / maxParticipants) * 100

                    return (
                        <div key={v.key} className="flex items-center gap-4">
                            <div className="w-24 text-sm text-gray-700 dark:text-gray-300 font-medium truncate">
                                {v.name}
                            </div>
                            <div className="flex-1">
                                <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={clsx(
                                            'h-full rounded-full transition-all',
                                            exp.winner === v.key ? 'bg-green-500' : 'bg-primary-500'
                                        )}
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                            </div>
                            <div className="w-20 text-right text-sm text-gray-600 dark:text-gray-400">
                                {rate.toFixed(1)}%
                            </div>
                            <div className="w-16 text-right text-xs text-gray-400 dark:text-gray-500">
                                {v.traffic_split}%
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Results */}
            {exp.results && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-6 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                            Lift: <span className={exp.results.relative_lift > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {(exp.results.relative_lift * 100).toFixed(1)}%
                            </span>
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                            p-value: <span className="font-mono">{exp.results.p_value.toFixed(4)}</span>
                        </span>
                        <span className={exp.results.statistically_significant ? 'text-green-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}>
                            {exp.results.statistically_significant ? 'Significant' : 'Not significant'}
                        </span>
                        {exp.winner && (
                            <span className="text-green-600 font-semibold">Winner: {exp.winner}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function CreateExperimentModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient()
    const [flagKey, setFlagKey] = useState('')
    const [hypothesis, setHypothesis] = useState('')
    const [trafficPct, setTrafficPct] = useState(100)
    const [error, setError] = useState('')

    const { data: flagsData } = useQuery({
        queryKey: ['flags-for-experiment'],
        queryFn: () => flagsApi.list(undefined, { limit: 200 }).then(r => r.data),
    })

    const flags = flagsData?.items || []

    const selectedFlag = flags.find(f => f.key === flagKey)

    const createMutation = useMutation({
        mutationFn: () => {
            if (!selectedFlag) throw new Error('Select a flag')
            return experimentsApi.create({
                flag_key: flagKey,
                variations: selectedFlag.variations.map(v => ({ key: v.key, weight: 1 })),
                traffic_percentage: trafficPct,
                hypothesis: hypothesis || undefined,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiments'] })
            onClose()
        },
        onError: (err: any) => setError(err?.response?.data?.detail || err.message),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Experiment</h2>

                {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Feature Flag</label>
                        <select
                            value={flagKey}
                            onChange={e => setFlagKey(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                        >
                            <option value="">Select a flag...</option>
                            {flags.map(f => (
                                <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                            ))}
                        </select>
                    </div>

                    {selectedFlag && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Variations ({selectedFlag.variations.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedFlag.variations.map(v => (
                                    <span key={v.key} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded">
                                        {v.name || v.key}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hypothesis</label>
                        <textarea
                            value={hypothesis}
                            onChange={e => setHypothesis(e.target.value)}
                            placeholder="What do you expect to happen?"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                            rows={2}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Traffic: {trafficPct}%
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={100}
                            value={trafficPct}
                            onChange={e => setTrafficPct(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={() => createMutation.mutate()}
                        disabled={!flagKey || createMutation.isPending}
                        className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create Experiment'}
                    </button>
                </div>
            </div>
        </div>
    )
}

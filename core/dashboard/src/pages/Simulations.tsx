import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { simulationsApi, flagsApi, type SimulationResult } from '@/lib/api'
import { Play, BarChart3, Clock, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Database } from 'lucide-react'
import clsx from 'clsx'

export default function Simulations() {
    const queryClient = useQueryClient()
    const [showRunModal, setShowRunModal] = useState(false)
    const [selectedSim, setSelectedSim] = useState<SimulationResult | null>(null)
    const [flagFilter, setFlagFilter] = useState('')

    const { data: simulations = [], isLoading } = useQuery({
        queryKey: ['simulations', flagFilter],
        queryFn: () => simulationsApi.list(flagFilter || undefined).then(r => r.data),
    })

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Simulations</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Predict the impact of flag changes before deploying to production
                    </p>
                </div>
                <button
                    onClick={() => setShowRunModal(true)}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Run Simulation
                </button>
            </div>

            {/* Filter */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Filter by flag key..."
                    value={flagFilter}
                    onChange={e => setFlagFilter(e.target.value)}
                    className="w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading simulations...</div>
            ) : simulations.length === 0 ? (
                <EmptyState onRun={() => setShowRunModal(true)} />
            ) : (
                <div className="space-y-4">
                    {simulations.map((sim: SimulationResult) => (
                        <SimulationCard
                            key={sim.id}
                            simulation={sim}
                            onSelect={() => setSelectedSim(sim)}
                        />
                    ))}
                </div>
            )}

            {showRunModal && (
                <RunSimulationModal
                    onClose={() => setShowRunModal(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['simulations'] })
                        setShowRunModal(false)
                    }}
                />
            )}

            {selectedSim && (
                <SimulationDetailModal
                    simulation={selectedSim}
                    onClose={() => setSelectedSim(null)}
                />
            )}
        </div>
    )
}

function EmptyState({ onRun }: { onRun: () => void }) {
    return (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No simulations yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                Run a simulation to predict how flag changes will impact your metrics before deploying.
            </p>
            <button
                onClick={onRun}
                className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
                <Play className="w-4 h-4 mr-2" />
                Run First Simulation
            </button>
        </div>
    )
}

function SimulationCard({ simulation: sim, onSelect }: { simulation: SimulationResult; onSelect: () => void }) {
    const impactEntries = Object.entries(sim.metric_impact || {})
    const hasPositiveImpact = impactEntries.some(([, v]) => v.change_pct > 0)
    const hasNegativeImpact = impactEntries.some(([, v]) => v.change_pct < 0)

    return (
        <div
            onClick={onSelect}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-md transition-shadow"
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{sim.flag_key}</h3>
                        <span className={clsx(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            sim.status === 'completed'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}>
                            {sim.status}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(sim.created_at).toLocaleDateString()} &middot; {sim.traffic_window_hours}h traffic window
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    {hasPositiveImpact && <ArrowUpRight className="w-4 h-4 text-green-500" />}
                    {hasNegativeImpact && <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    <span className="text-gray-500 dark:text-gray-400">
                        {sim.affected_users_pct.toFixed(1)}% affected
                    </span>
                </div>
            </div>

            {/* Distribution comparison */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Original Distribution</p>
                    <div className="flex gap-1">
                        {Object.entries(sim.original_distribution || {}).map(([key, pct]) => (
                            <div key={key} className="flex-1">
                                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div className="h-full bg-gray-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{key}: {pct.toFixed(0)}%</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Proposed Distribution</p>
                    <div className="flex gap-1">
                        {Object.entries(sim.proposed_distribution || {}).map(([key, pct]) => (
                            <div key={key} className="flex-1">
                                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{key}: {pct.toFixed(0)}%</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Metric impact preview */}
            {impactEntries.length > 0 && (
                <div className="flex gap-4 flex-wrap">
                    {impactEntries.slice(0, 3).map(([metric, impact]) => (
                        <div key={metric} className="flex items-center gap-2 text-sm">
                            {impact.change_pct >= 0
                                ? <TrendingUp className="w-3 h-3 text-green-500" />
                                : <TrendingDown className="w-3 h-3 text-red-500" />
                            }
                            <span className="text-gray-600 dark:text-gray-400">{metric}:</span>
                            <span className={clsx(
                                'font-semibold',
                                impact.change_pct >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                                {impact.change_pct >= 0 ? '+' : ''}{impact.change_pct.toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function SimulationDetailModal({ simulation: sim, onClose }: { simulation: SimulationResult; onClose: () => void }) {
    const impactEntries = Object.entries(sim.metric_impact || {})

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Simulation: {sim.flag_key}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(sim.created_at).toLocaleString()} &middot; ID: {sim.id.slice(0, 8)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-xl">&times;</button>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Traffic Window</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{sim.traffic_window_hours}h</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Users Affected</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{sim.affected_users_pct.toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                        <p className="text-lg font-semibold text-green-600">{sim.status}</p>
                    </div>
                </div>

                {/* Distribution comparison */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Traffic Distribution</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Original</p>
                            {Object.entries(sim.original_distribution || {}).map(([key, pct]) => (
                                <div key={key} className="mb-2">
                                    <div className="flex justify-between text-xs mb-0.5">
                                        <span className="text-gray-600 dark:text-gray-400">{key}</span>
                                        <span className="text-gray-500 dark:text-gray-400">{pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                        <div className="h-full bg-gray-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Proposed</p>
                            {Object.entries(sim.proposed_distribution || {}).map(([key, pct]) => (
                                <div key={key} className="mb-2">
                                    <div className="flex justify-between text-xs mb-0.5">
                                        <span className="text-gray-600 dark:text-gray-400">{key}</span>
                                        <span className="text-gray-500 dark:text-gray-400">{pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Metric impact */}
                {impactEntries.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Metric Impact</h3>
                        <div className="space-y-3">
                            {impactEntries.map(([metric, impact]) => (
                                <div key={metric} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{metric}</span>
                                        <span className={clsx(
                                            'text-sm font-bold',
                                            impact.change_pct >= 0 ? 'text-green-600' : 'text-red-600'
                                        )}>
                                            {impact.change_pct >= 0 ? '+' : ''}{impact.change_pct.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>Before: {impact.before.toFixed(4)}</span>
                                        <span>After: {impact.after.toFixed(4)}</span>
                                    </div>
                                    {impact.confidence_interval && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            95% CI: [{impact.confidence_interval[0].toFixed(4)}, {impact.confidence_interval[1].toFixed(4)}]
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Proposed state */}
                <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proposed State</h3>
                    <pre className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                        {JSON.stringify(sim.proposed_state, null, 2)}
                    </pre>
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function RunSimulationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [flagKey, setFlagKey] = useState('')
    const [windowHours, setWindowHours] = useState(24)
    const [proposedStateJson, setProposedStateJson] = useState('{\n  "status": "active",\n  "default_variation": "variant-b"\n}')
    const [error, setError] = useState('')

    const { data: flagsData } = useQuery({
        queryKey: ['flags-for-simulation'],
        queryFn: () => flagsApi.list(undefined, { limit: 200 }).then(r => r.data),
    })

    const flags = flagsData?.items || []

    // Fetch traffic stats when a flag is selected
    const { data: statsData } = useQuery({
        queryKey: ['traffic-stats', flagKey],
        queryFn: () => simulationsApi.trafficStats(flagKey).then(r => r.data),
        enabled: !!flagKey,
    })

    const runMutation = useMutation({
        mutationFn: () => {
            let proposedState: Record<string, unknown>
            try {
                proposedState = JSON.parse(proposedStateJson)
            } catch {
                throw new Error('Invalid JSON in proposed state')
            }
            return simulationsApi.run({
                flag_key: flagKey,
                proposed_state: proposedState,
                traffic_window_hours: windowHours,
            })
        },
        onSuccess: () => onSuccess(),
        onError: (err: any) => setError(err?.response?.data?.detail || err.message),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Run Simulation</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Flag selector */}
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

                    {/* Traffic stats */}
                    {statsData && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Recorded Traffic</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>Records: {statsData.total_records.toLocaleString()}</span>
                                <span>Unique users: {statsData.unique_users.toLocaleString()}</span>
                            </div>
                            {Object.keys(statsData.variation_distribution || {}).length > 0 && (
                                <div className="mt-2 flex gap-2 flex-wrap">
                                    {Object.entries(statsData.variation_distribution).map(([k, v]) => (
                                        <span key={k} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded">
                                            {k}: {v}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Traffic window */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Traffic Window: {windowHours}h
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={168}
                            value={windowHours}
                            onChange={e => setWindowHours(Number(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                            <span>1h</span>
                            <span>24h</span>
                            <span>72h</span>
                            <span>168h (1 week)</span>
                        </div>
                    </div>

                    {/* Proposed state */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Proposed Flag State (JSON)
                        </label>
                        <textarea
                            value={proposedStateJson}
                            onChange={e => setProposedStateJson(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 font-mono text-sm"
                            rows={6}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => runMutation.mutate()}
                        disabled={!flagKey || runMutation.isPending}
                        className="flex items-center px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        <Play className="w-4 h-4 mr-1" />
                        {runMutation.isPending ? 'Running...' : 'Run Simulation'}
                    </button>
                </div>
            </div>
        </div>
    )
}

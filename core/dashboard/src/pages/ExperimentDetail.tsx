import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { experimentsApi2, type ExperimentV2, type ExperimentResultV2 } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
    ArrowLeft, Play, Pause, Square, Trophy, FlaskConical,
    Users, Target, TrendingUp, Calendar, BarChart3
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import clsx from 'clsx'

const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RTooltip = Tooltip as any
const RCell = Cell as any

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    running: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const BAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function ExperimentDetail() {
    const { experimentKey } = useParams<{ experimentKey: string }>()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const { data: experiment, isLoading } = useQuery({
        queryKey: ['experiment-detail', experimentKey],
        queryFn: () => experimentsApi2.get(experimentKey!).then(r => r.data),
        enabled: !!experimentKey,
        refetchInterval: (query) => {
            const exp = query.state.data as ExperimentV2 | undefined
            return exp?.status === 'running' ? 30000 : false
        },
    })

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['experiment-detail', experimentKey] })
        queryClient.invalidateQueries({ queryKey: ['experiments'] })
    }

    const startMutation = useMutation({
        mutationFn: () => experimentsApi2.start(experimentKey!),
        onSuccess: () => { invalidate(); toast('success', 'Experiment started') },
        onError: (e: Error) => toast('error', e.message),
    })

    const pauseMutation = useMutation({
        mutationFn: () => experimentsApi2.pause(experimentKey!),
        onSuccess: () => { invalidate(); toast('success', 'Experiment paused') },
        onError: (e: Error) => toast('error', e.message),
    })

    const stopMutation = useMutation({
        mutationFn: () => experimentsApi2.stop(experimentKey!),
        onSuccess: () => { invalidate(); toast('success', 'Experiment stopped') },
        onError: (e: Error) => toast('error', e.message),
    })

    const concludeMutation = useMutation({
        mutationFn: (winningKey?: string) => experimentsApi2.conclude(experimentKey!, winningKey),
        onSuccess: () => { invalidate(); toast('success', 'Experiment concluded') },
        onError: (e: Error) => toast('error', e.message),
    })

    if (isLoading) {
        return <div className="p-8 dark:text-gray-300">Loading experiment...</div>
    }

    if (!experiment) {
        return (
            <div className="p-8">
                <p className="text-gray-500 dark:text-gray-400">Experiment not found.</p>
                <Link to="/experiments" className="text-primary-600 hover:underline mt-2 inline-block">
                    Back to Experiments
                </Link>
            </div>
        )
    }

    const exp = experiment

    // Build bar chart data from results
    const chartData = exp.results.map((r: ExperimentResultV2) => ({
        name: r.variation_key,
        rate: r.conversion_rate != null ? parseFloat((r.conversion_rate * 100).toFixed(2)) : 0,
        participants: r.sample_size,
        conversions: r.conversions,
        isWinner: r.is_winner,
        isSignificant: r.is_significant,
        lift: r.lift,
        confidence: r.confidence_level,
    }))

    const totalParticipants = exp.results.reduce((s: number, r: ExperimentResultV2) => s + r.sample_size, 0)
    const winner = exp.results.find((r: ExperimentResultV2) => r.is_winner)

    function durationLabel() {
        if (!exp.start_date) return 'Not started'
        const start = new Date(exp.start_date)
        const end = exp.end_date ? new Date(exp.end_date) : new Date()
        const days = Math.floor((end.getTime() - start.getTime()) / 86400000)
        return `${days} day${days !== 1 ? 's' : ''}`
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/experiments"
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center space-x-3">
                        <FlaskConical className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        <div>
                            <div className="flex items-center space-x-3">
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{exp.name}</h1>
                                <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', STATUS_STYLES[exp.status])}>
                                    {exp.status}
                                </span>
                                {winner && (
                                    <span className="flex items-center space-x-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        <Trophy className="w-3 h-3" />
                                        <span>Winner: {winner.variation_key}</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{exp.key}</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center space-x-2">
                    {exp.status === 'draft' && (
                        <button
                            onClick={() => startMutation.mutate()}
                            disabled={startMutation.isPending}
                            className="flex items-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            <Play className="w-4 h-4" />
                            <span>Start</span>
                        </button>
                    )}
                    {exp.status === 'running' && (
                        <>
                            <button
                                onClick={() => pauseMutation.mutate()}
                                disabled={pauseMutation.isPending}
                                className="flex items-center space-x-2 px-3 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                            >
                                <Pause className="w-4 h-4" />
                                <span>Pause</span>
                            </button>
                            <button
                                onClick={() => stopMutation.mutate()}
                                disabled={stopMutation.isPending}
                                className="flex items-center space-x-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                <Square className="w-4 h-4" />
                                <span>Stop</span>
                            </button>
                            {exp.results.length > 0 && (
                                <button
                                    onClick={() => {
                                        const top = exp.results.sort((a: ExperimentResultV2, b: ExperimentResultV2) =>
                                            (b.conversion_rate ?? 0) - (a.conversion_rate ?? 0)
                                        )[0]
                                        concludeMutation.mutate(top?.variation_key)
                                    }}
                                    disabled={concludeMutation.isPending}
                                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                                >
                                    <Trophy className="w-4 h-4" />
                                    <span>Declare Winner</span>
                                </button>
                            )}
                        </>
                    )}
                    {exp.status === 'paused' && (
                        <>
                            <button
                                onClick={() => startMutation.mutate()}
                                disabled={startMutation.isPending}
                                className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                <Play className="w-4 h-4" />
                                <span>Resume</span>
                            </button>
                            <button
                                onClick={() => stopMutation.mutate()}
                                disabled={stopMutation.isPending}
                                className="flex items-center space-x-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                <Square className="w-4 h-4" />
                                <span>Stop</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="card">
                    <div className="flex items-center space-x-2 mb-1">
                        <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Participants</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalParticipants.toLocaleString()}</p>
                </div>
                <div className="card">
                    <div className="flex items-center space-x-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{durationLabel()}</p>
                </div>
                <div className="card">
                    <div className="flex items-center space-x-2 mb-1">
                        <Target className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Traffic Split</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{exp.traffic_percentage}%</p>
                </div>
                <div className="card">
                    <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Variations</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{exp.results.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Results chart + table */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Hypothesis */}
                    {exp.hypothesis && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Hypothesis</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{exp.hypothesis}"</p>
                        </div>
                    )}

                    {/* Conversion Rate Bar Chart */}
                    {chartData.length > 0 && (
                        <div className="card">
                            <div className="flex items-center space-x-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conversion Rate by Variation</h2>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                                    <RXAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <RYAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12 }} />
                                    <RTooltip
                                        formatter={(value: number, _name: string) => [`${value}%`, 'Conversion Rate']}
                                        contentStyle={{
                                            backgroundColor: 'var(--color-bg, #fff)',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry: any, index: number) => (
                                            <RCell
                                                key={`cell-${index}`}
                                                fill={entry.isWinner ? '#10b981' : BAR_COLORS[index % BAR_COLORS.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Variation Results Table */}
                    {exp.results.length > 0 ? (
                        <div className="card overflow-x-auto">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Variation Results</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Variation</th>
                                        <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Participants</th>
                                        <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Conversions</th>
                                        <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Conv. Rate</th>
                                        <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Lift</th>
                                        <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Confidence</th>
                                        <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Significant</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exp.results.map((r: ExperimentResultV2) => (
                                        <tr key={r.id} className={clsx(
                                            'border-b border-gray-100 dark:border-gray-800',
                                            r.is_winner && 'bg-green-50 dark:bg-green-900/10'
                                        )}>
                                            <td className="py-3">
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{r.variation_key}</span>
                                                    {r.is_winner && (
                                                        <span className="flex items-center space-x-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                                                            <Trophy className="w-3 h-3" />
                                                            <span>Winner</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 text-right text-gray-700 dark:text-gray-300">{r.sample_size.toLocaleString()}</td>
                                            <td className="py-3 text-right text-gray-700 dark:text-gray-300">{r.conversions.toLocaleString()}</td>
                                            <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                                                {r.conversion_rate != null ? `${(r.conversion_rate * 100).toFixed(2)}%` : '—'}
                                            </td>
                                            <td className={clsx(
                                                'py-3 text-right font-medium',
                                                r.lift == null ? 'text-gray-400' :
                                                r.lift > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                            )}>
                                                {r.lift != null ? `${r.lift > 0 ? '+' : ''}${(r.lift * 100).toFixed(1)}%` : '—'}
                                            </td>
                                            <td className="py-3 text-right text-gray-700 dark:text-gray-300">
                                                {r.confidence_level != null ? `${(r.confidence_level * 100).toFixed(0)}%` : '—'}
                                            </td>
                                            <td className="py-3 text-right">
                                                {r.is_significant ? (
                                                    <span className="text-green-600 dark:text-green-400 font-medium text-xs">Yes</span>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-gray-500 text-xs">No</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="card text-center py-8">
                            <BarChart3 className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">No results recorded yet.</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Results will appear once the experiment starts collecting data.</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Traffic Allocation */}
                    <div className="card">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Traffic Allocation</h2>
                        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-3">
                            {exp.results.map((r: ExperimentResultV2, i: number) => {
                                const pct = exp.results.length > 0 ? (100 / exp.results.length) : 0
                                return (
                                    <div
                                        key={r.variation_key}
                                        style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                                        title={`${r.variation_key}: ${pct.toFixed(0)}%`}
                                    />
                                )
                            })}
                        </div>
                        <div className="space-y-1">
                            {exp.results.map((r: ExperimentResultV2, i: number) => (
                                <div key={r.variation_key} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                                        />
                                        <span className="text-gray-700 dark:text-gray-300 font-mono">{r.variation_key}</span>
                                    </div>
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {exp.results.length > 0 ? (100 / exp.results.length).toFixed(0) : 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Goals */}
                    {exp.goals.length > 0 && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Goals</h2>
                            <div className="space-y-2">
                                {exp.goals.map((g: any) => (
                                    <div key={g.id} className="flex items-start space-x-2">
                                        <Target className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                                                {g.name}
                                                {g.is_primary && (
                                                    <span className="ml-1.5 text-xs text-primary-600 dark:text-primary-400">primary</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{g.metric_key}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="card">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Timeline</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Created</span>
                                <span className="text-gray-900 dark:text-gray-100">{new Date(exp.created_at).toLocaleDateString()}</span>
                            </div>
                            {exp.start_date && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Started</span>
                                    <span className="text-gray-900 dark:text-gray-100">{new Date(exp.start_date).toLocaleDateString()}</span>
                                </div>
                            )}
                            {exp.end_date && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Ended</span>
                                    <span className="text-gray-900 dark:text-gray-100">{new Date(exp.end_date).toLocaleDateString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Created by</span>
                                <span className="text-gray-900 dark:text-gray-100">{exp.created_by}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Flag</span>
                                <Link to={`/flags/${exp.flag_key}`} className="text-primary-600 dark:text-primary-400 hover:underline font-mono text-xs">
                                    {exp.flag_key}
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Statistical Power note */}
                    {totalParticipants > 0 && (
                        <div className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                            <h2 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Statistical Note</h2>
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                                {exp.results.some((r: ExperimentResultV2) => r.is_significant)
                                    ? 'At least one variation has reached statistical significance.'
                                    : `With ${totalParticipants.toLocaleString()} participants, significance has not yet been reached. Continue running to gather more data.`
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

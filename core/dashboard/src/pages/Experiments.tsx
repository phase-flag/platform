import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { experimentsApi2, flagsApi, type ExperimentV2, type ExperimentResultV2 } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useProject } from '@/contexts/ProjectContext'
import { Link } from 'react-router-dom'
import {
    FlaskConical, Play, Pause, CheckCircle, Plus, TrendingUp, Users, Target,
    Calendar, ChevronRight, Square, ArrowRight, X
} from 'lucide-react'
import clsx from 'clsx'
import EmptyState from '@/components/EmptyState'
import Skeleton from '@/components/Skeleton'

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    running: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_TABS = ['', 'draft', 'running', 'paused', 'completed', 'cancelled'] as const

export default function Experiments() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const { project } = useProject()
    const [showCreate, setShowCreate] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>('')

    const { data: expData, isLoading } = useQuery({
        queryKey: ['experiments', statusFilter, project?.key],
        queryFn: () => experimentsApi2.list({ ...(statusFilter ? { status: statusFilter } : {}), project_key: project?.key ?? undefined }).then(r => r.data),
    })

    const experiments: ExperimentV2[] = Array.isArray(expData) ? expData : (expData as any)?.items || []

    const startMutation = useMutation({
        mutationFn: (key: string) => experimentsApi2.start(key),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiments'] }); toast('success', 'Experiment started') },
        onError: (e: Error) => toast('error', e.message),
    })

    const pauseMutation = useMutation({
        mutationFn: (key: string) => experimentsApi2.pause(key),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiments'] }); toast('success', 'Experiment paused') },
        onError: (e: Error) => toast('error', e.message),
    })

    const stopMutation = useMutation({
        mutationFn: (key: string) => experimentsApi2.stop(key),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiments'] }); toast('success', 'Experiment stopped') },
        onError: (e: Error) => toast('error', e.message),
    })

    const concludeMutation = useMutation({
        mutationFn: (key: string) => experimentsApi2.conclude(key),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiments'] }); toast('success', 'Experiment concluded') },
        onError: (e: Error) => toast('error', e.message),
    })

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Experiments</h1>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">A/B test feature flag variations with statistical analysis</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    title="Set up an A/B test or multivariate experiment"
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Experiment</span>
                </button>
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                {STATUS_TABS.map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={clsx(
                            'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
                            statusFilter === s
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                        )}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <Skeleton variant="row" count={3} />
            ) : experiments.length === 0 ? (
                <EmptyState
                    icon={FlaskConical}
                    title={statusFilter ? `No ${statusFilter} experiments` : 'No experiments yet'}
                    description={statusFilter
                        ? `There are no experiments with status "${statusFilter}".`
                        : 'Create your first experiment to start A/B testing your feature flags.'}
                    actionLabel={!statusFilter ? 'New Experiment' : undefined}
                    onAction={!statusFilter ? () => setShowCreate(true) : undefined}
                />
            ) : (
                <div className="space-y-4">
                    {experiments.map(exp => (
                        <ExperimentCard
                            key={exp.id}
                            experiment={exp}
                            onStart={() => startMutation.mutate(exp.key)}
                            onPause={() => pauseMutation.mutate(exp.key)}
                            onStop={() => stopMutation.mutate(exp.key)}
                            onConclude={() => concludeMutation.mutate(exp.key)}
                        />
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateExperimentWizard
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        queryClient.invalidateQueries({ queryKey: ['experiments'] })
                        setShowCreate(false)
                    }}
                />
            )}
        </div>
    )
}

function ExperimentCard({
    experiment: exp,
    onStart,
    onPause,
    onStop,
    onConclude,
}: {
    experiment: ExperimentV2
    onStart: () => void
    onPause: () => void
    onStop: () => void
    onConclude: () => void
}) {
    const totalParticipants = exp.results.reduce((s: number, r: ExperimentResultV2) => s + r.sample_size, 0)
    const totalConversions = exp.results.reduce((s: number, r: ExperimentResultV2) => s + r.conversions, 0)
    const overallRate = totalParticipants > 0 ? ((totalConversions / totalParticipants) * 100).toFixed(1) : '0.0'
    const winner = exp.results.find((r: ExperimentResultV2) => r.is_winner)

    function durationLabel() {
        if (!exp.start_date) return null
        const start = new Date(exp.start_date)
        const end = exp.end_date ? new Date(exp.end_date) : new Date()
        const days = Math.floor((end.getTime() - start.getTime()) / 86400000)
        return `${days}d`
    }

    return (
        <div title="Click to view experiment results and statistical analysis" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-black/20 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150">
            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{exp.name}</h3>
                            <span title="draft = not started, running = collecting data, completed = results ready" className={clsx('px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0', STATUS_STYLES[exp.status])}>
                                {exp.status}
                            </span>
                            {winner && (
                                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex-shrink-0">
                                    Winner: {winner.variation_key}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{exp.flag_key}</span>
                            {durationLabel() && (
                                <span className="flex items-center space-x-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{durationLabel()}</span>
                                </span>
                            )}
                            {exp.traffic_percentage < 100 && (
                                <span>{exp.traffic_percentage}% traffic</span>
                            )}
                        </div>
                        {exp.hypothesis && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-1 italic">"{exp.hypothesis}"</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                        {exp.status === 'draft' && (
                            <button onClick={onStart} title="Start this experiment and begin collecting data" className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                                <Play className="w-3 h-3" />
                                <span>Start</span>
                            </button>
                        )}
                        {exp.status === 'running' && (
                            <>
                                <button onClick={onPause} title="Pause data collection for this experiment" className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                                    <Pause className="w-3 h-3" />
                                    <span>Pause</span>
                                </button>
                                <button onClick={onConclude} title="Conclude this experiment and finalize results" className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Conclude</span>
                                </button>
                            </>
                        )}
                        {exp.status === 'paused' && (
                            <>
                                <button onClick={onStart} title="Resume data collection for this experiment" className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                                    <Play className="w-3 h-3" />
                                    <span>Resume</span>
                                </button>
                                <button onClick={onStop} title="Stop this experiment permanently" className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                                    <Square className="w-3 h-3" />
                                    <span>Stop</span>
                                </button>
                            </>
                        )}
                        <Link
                            to={`/experiments/${exp.key}`}
                            title="View experiment results and statistical analysis"
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Participants</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalParticipants.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Target className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Conversions</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalConversions.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Conv. Rate</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{overallRate}%</p>
                        </div>
                    </div>
                </div>

                {/* Variation bars */}
                {exp.results.length > 0 && (
                    <div className="space-y-1.5">
                        {exp.results.map((r: ExperimentResultV2, _i: number) => {
                            const rate = r.sample_size > 0 ? (r.conversions / r.sample_size) * 100 : 0
                            const maxRate = Math.max(...exp.results.map((rv: ExperimentResultV2) =>
                                rv.sample_size > 0 ? (rv.conversions / rv.sample_size) * 100 : 0
                            ), 1)
                            const barWidth = (rate / maxRate) * 100
                            return (
                                <div key={r.variation_key} className="flex items-center space-x-3">
                                    <div className="w-24 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">{r.variation_key}</div>
                                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full transition-all',
                                                r.is_winner ? 'bg-green-500' : 'bg-primary-500'
                                            )}
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                    <div className="w-16 text-right text-xs text-gray-600 dark:text-gray-400">{rate.toFixed(1)}%</div>
                                    {r.is_significant && (
                                        <div className="w-16 text-right text-xs text-green-600 dark:text-green-400 font-medium">sig.</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4

interface WizardData {
    // Step 1
    name: string
    hypothesis: string
    flagKey: string
    // Step 2
    variations: Array<{ key: string; weight: number }>
    trafficPct: number
    // Step 3
    goalName: string
    metricKey: string
    goalType: string
    // Step 4 — review only
}

function CreateExperimentWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { toast } = useToast()
    const [step, setStep] = useState<WizardStep>(1)
    const [data, setData] = useState<WizardData>({
        name: '',
        hypothesis: '',
        flagKey: '',
        variations: [],
        trafficPct: 100,
        goalName: 'Conversion',
        metricKey: 'conversion',
        goalType: 'conversion',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const { data: flagsData } = useQuery({
        queryKey: ['flags-for-wizard'],
        queryFn: () => flagsApi.list(undefined, { limit: 200 }).then(r => r.data),
    })
    const flags = flagsData?.items || []
    const selectedFlag = flags.find(f => f.key === data.flagKey)

    const createMutation = useMutation({
        mutationFn: () => {
            const key = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            return experimentsApi2.create({
                key,
                name: data.name,
                flag_key: data.flagKey,
                hypothesis: data.hypothesis || undefined,
                traffic_percentage: data.trafficPct,
                goals: data.goalName ? [{
                    name: data.goalName,
                    metric_key: data.metricKey,
                    goal_type: data.goalType,
                    is_primary: true,
                }] : undefined,
            })
        },
        onSuccess: () => {
            toast('success', 'Experiment created')
            onCreated()
        },
        onError: (e: Error) => toast('error', e.message),
    })

    function validateStep(): boolean {
        const e: Record<string, string> = {}
        if (step === 1) {
            if (!data.name.trim()) e.name = 'Name is required'
            if (!data.flagKey) e.flagKey = 'Select a feature flag'
        }
        if (step === 2) {
            if (data.variations.length < 2) e.variations = 'At least 2 variations required'
            const total = data.variations.reduce((s, v) => s + v.weight, 0)
            if (Math.abs(total - 100) > 0.5) e.variations = `Traffic weights must sum to 100% (currently ${total}%)`
        }
        if (step === 3) {
            if (!data.goalName.trim()) e.goalName = 'Goal name is required'
            if (!data.metricKey.trim()) e.metricKey = 'Metric key is required'
        }
        setErrors(e)
        return Object.keys(e).length === 0
    }

    function handleNext() {
        if (!validateStep()) return
        if (step === 4) {
            createMutation.mutate()
        } else {
            setStep((step + 1) as WizardStep)
        }
    }

    function handleBack() {
        if (step > 1) setStep((step - 1) as WizardStep)
    }

    // When a flag is selected, initialise variations from its variations
    function handleFlagSelect(key: string) {
        const flag = flags.find(f => f.key === key)
        const vars = flag
            ? flag.variations.map(v => ({
                key: v.key,
                weight: Math.floor(100 / flag.variations.length),
            }))
            : []
        // Fix rounding
        if (vars.length > 0) {
            const diff = 100 - vars.reduce((s, v) => s + v.weight, 0)
            vars[0].weight += diff
        }
        setData(d => ({ ...d, flagKey: key, variations: vars }))
    }

    function updateWeight(idx: number, weight: number) {
        setData(d => {
            const vars = [...d.variations]
            vars[idx] = { ...vars[idx], weight }
            return { ...d, variations: vars }
        })
    }

    const STEPS = [
        { n: 1, label: 'Basics' },
        { n: 2, label: 'Variations' },
        { n: 3, label: 'Goal' },
        { n: 4, label: 'Review' },
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Wizard header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Experiment</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                    {STEPS.map((s, i) => (
                        <div key={s.n} className="flex items-center">
                            <div className={clsx(
                                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold',
                                step === s.n
                                    ? 'bg-primary-600 text-white'
                                    : step > s.n
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            )}>
                                {step > s.n ? '✓' : s.n}
                            </div>
                            <span className={clsx(
                                'ml-1.5 text-sm',
                                step === s.n ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                            )}>
                                {s.label}
                            </span>
                            {i < STEPS.length - 1 && (
                                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-3" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step content */}
                <div className="p-5 space-y-4">
                    {/* Step 1: Name, hypothesis, flag */}
                    {step === 1 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Experiment Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={e => setData(d => ({ ...d, name: e.target.value }))}
                                    placeholder="e.g. New Checkout Flow Test"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                                    autoFocus
                                />
                                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hypothesis</label>
                                <textarea
                                    value={data.hypothesis}
                                    onChange={e => setData(d => ({ ...d, hypothesis: e.target.value }))}
                                    placeholder="We believe that... will result in... because..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Feature Flag <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.flagKey}
                                    onChange={e => handleFlagSelect(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                                >
                                    <option value="">Select a flag...</option>
                                    {flags.map(f => (
                                        <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                                    ))}
                                </select>
                                {errors.flagKey && <p className="text-xs text-red-600 mt-1">{errors.flagKey}</p>}
                            </div>

                            {selectedFlag && (
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Flag variations ({selectedFlag.variations.length})</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedFlag.variations.map(v => (
                                            <span key={v.key} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded font-mono">
                                                {v.name || v.key}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Step 2: Variations and traffic allocation */}
                    {step === 2 && (
                        <>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Traffic Allocation: {data.trafficPct}% of users
                                    </label>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={100}
                                    value={data.trafficPct}
                                    onChange={e => setData(d => ({ ...d, trafficPct: Number(e.target.value) }))}
                                    className="w-full accent-primary-600"
                                />
                                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    <span>1%</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Variation Weights (must sum to 100%)
                                </p>
                                {data.variations.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No variations — go back and select a flag.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {data.variations.map((v, i) => (
                                            <div key={v.key} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{v.key}</span>
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{v.weight}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={1}
                                                    max={100}
                                                    value={v.weight}
                                                    onChange={e => updateWeight(i, Number(e.target.value))}
                                                    className="w-full accent-primary-600"
                                                />
                                            </div>
                                        ))}
                                        <div className={clsx(
                                            'text-xs font-medium',
                                            Math.abs(data.variations.reduce((s, v) => s + v.weight, 0) - 100) < 1
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-red-600 dark:text-red-400'
                                        )}>
                                            Total: {data.variations.reduce((s, v) => s + v.weight, 0)}%
                                        </div>
                                    </div>
                                )}
                                {errors.variations && <p className="text-xs text-red-600 mt-1">{errors.variations}</p>}
                            </div>
                        </>
                    )}

                    {/* Step 3: Goal metric */}
                    {step === 3 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Goal Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.goalName}
                                    onChange={e => setData(d => ({ ...d, goalName: e.target.value }))}
                                    placeholder="e.g. Checkout Completion"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                                />
                                {errors.goalName && <p className="text-xs text-red-600 mt-1">{errors.goalName}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Conversion Event Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={data.metricKey}
                                    onChange={e => setData(d => ({ ...d, metricKey: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                                    placeholder="e.g. checkout_completed"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono dark:bg-gray-900 dark:text-gray-100 text-sm"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The event key tracked by your SDK when a conversion occurs</p>
                                {errors.metricKey && <p className="text-xs text-red-600 mt-1">{errors.metricKey}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Type</label>
                                <div className="flex space-x-2">
                                    {['conversion', 'revenue', 'numeric'].map(gt => (
                                        <button
                                            key={gt}
                                            type="button"
                                            onClick={() => setData(d => ({ ...d, goalType: gt }))}
                                            className={clsx(
                                                'px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize',
                                                data.goalType === gt
                                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                                            )}
                                        >
                                            {gt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Step 4: Review */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Name</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{data.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Flag</span>
                                    <span className="font-mono text-gray-900 dark:text-gray-100">{data.flagKey}</span>
                                </div>
                                {data.hypothesis && (
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Hypothesis</span>
                                        <p className="text-gray-700 dark:text-gray-300 italic mt-0.5">"{data.hypothesis}"</p>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Traffic</span>
                                    <span className="text-gray-900 dark:text-gray-100">{data.trafficPct}% of users</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Variations</span>
                                    <div className="mt-1 space-y-1">
                                        {data.variations.map(v => (
                                            <div key={v.key} className="flex justify-between text-xs">
                                                <span className="font-mono text-gray-700 dark:text-gray-300">{v.key}</span>
                                                <span className="text-gray-500 dark:text-gray-400">{v.weight}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Goal</span>
                                    <span className="text-gray-900 dark:text-gray-100">{data.goalName} (<span className="font-mono">{data.metricKey}</span>)</span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                The experiment will be created in <strong>draft</strong> status. You can start it from the experiments list or detail page.
                            </p>
                        </div>
                    )}
                </div>

                {/* Wizard footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={step === 1 ? onClose : handleBack}
                        className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        {step === 1 ? 'Cancel' : 'Back'}
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={createMutation.isPending}
                        className="flex items-center space-x-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {step === 4 ? (
                            <span>{createMutation.isPending ? 'Creating...' : 'Launch Experiment'}</span>
                        ) : (
                            <>
                                <span>Next</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

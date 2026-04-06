import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pipelinesApi, flagsApi, type RolloutPipeline } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import { GitBranch, Plus, Play, Pause, SkipForward, RotateCcw, X, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import Skeleton from '@/components/Skeleton'

const STAGE_STATUS_COLORS: Record<string, string> = {
    completed: 'bg-green-500',
    active: 'bg-primary-500',
    pending: 'bg-gray-300 dark:bg-gray-600',
}

export default function Pipelines() {
    const queryClient = useQueryClient()
    const { addToast } = useToast()
    const { environment } = useEnvironment()
    const [showCreate, setShowCreate] = useState(false)
    const [confirmAction, setConfirmAction] = useState<{ type: string; flagKey: string } | null>(null)

    // Create form
    const [selectedFlag, setSelectedFlag] = useState('')
    const [stages, setStages] = useState<Array<{ percentage: number; duration_minutes: number }>>([
        { percentage: 1, duration_minutes: 30 },
        { percentage: 10, duration_minutes: 60 },
        { percentage: 50, duration_minutes: 120 },
        { percentage: 100, duration_minutes: 0 },
    ])
    const [useTemplate, setUseTemplate] = useState(true)
    const [selectedTemplate, setSelectedTemplate] = useState(0)

    const { data: pipelinesData, isLoading } = useQuery({
        queryKey: ['pipelines', environment],
        queryFn: () => pipelinesApi.list({ limit: 100 }),
    })

    const { data: flagsData } = useQuery({
        queryKey: ['flags', environment],
        queryFn: () => flagsApi.list(environment, { limit: 200 }),
        enabled: showCreate,
    })

    const { data: templatesData } = useQuery({
        queryKey: ['pipeline-templates'],
        queryFn: () => pipelinesApi.templates(),
        enabled: showCreate,
    })

    const TEMPLATES = [
        { name: 'Canary', stages: [{ percentage: 1, duration_minutes: 30 }, { percentage: 10, duration_minutes: 60 }, { percentage: 50, duration_minutes: 120 }, { percentage: 100, duration_minutes: 0 }] },
        { name: 'Blue-Green', stages: [{ percentage: 50, duration_minutes: 60 }, { percentage: 100, duration_minutes: 0 }] },
        { name: 'Gradual', stages: [{ percentage: 5, duration_minutes: 60 }, { percentage: 25, duration_minutes: 120 }, { percentage: 50, duration_minutes: 180 }, { percentage: 75, duration_minutes: 120 }, { percentage: 100, duration_minutes: 0 }] },
        { name: 'Fast', stages: [{ percentage: 10, duration_minutes: 15 }, { percentage: 50, duration_minutes: 15 }, { percentage: 100, duration_minutes: 0 }] },
    ]

    const allTemplates = templatesData?.data || TEMPLATES

    const createMutation = useMutation({
        mutationFn: () => pipelinesApi.create(selectedFlag, { stages }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            addToast('Pipeline created', 'success')
            setShowCreate(false)
            setSelectedFlag('')
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const advanceMutation = useMutation({
        mutationFn: (flagKey: string) => pipelinesApi.advance(flagKey),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            addToast('Pipeline advanced to next stage', 'success')
            setConfirmAction(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const pauseMutation = useMutation({
        mutationFn: (flagKey: string) => pipelinesApi.pause(flagKey),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            addToast('Pipeline paused', 'success')
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const resumeMutation = useMutation({
        mutationFn: (flagKey: string) => pipelinesApi.resume(flagKey),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            addToast('Pipeline resumed', 'success')
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const rollbackMutation = useMutation({
        mutationFn: (flagKey: string) => pipelinesApi.rollback(flagKey),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            addToast('Pipeline rolled back', 'success')
            setConfirmAction(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const cancelMutation = useMutation({
        mutationFn: (flagKey: string) => pipelinesApi.cancel(flagKey),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            addToast('Pipeline cancelled', 'success')
            setConfirmAction(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const pipelinesRaw = pipelinesData?.data || []
    const pipelines: RolloutPipeline[] = Array.isArray(pipelinesRaw) ? pipelinesRaw : (pipelinesRaw as any)?.items || []
    const flags = flagsData?.data?.items || []

    function addStage() {
        setStages([...stages, { percentage: 0, duration_minutes: 60 }])
    }

    function removeStage(index: number) {
        setStages(stages.filter((_, i) => i !== index))
    }

    function updateStage(index: number, field: 'percentage' | 'duration_minutes', value: number) {
        const updated = [...stages]
        updated[index] = { ...updated[index], [field]: value }
        setStages(updated)
    }

    function applyTemplate(idx: number) {
        setSelectedTemplate(idx)
        setStages([...allTemplates[idx].stages])
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'active': case 'running': return <Play className="w-4 h-4 text-primary-500" />
            case 'paused': return <Pause className="w-4 h-4 text-yellow-500" />
            case 'rolled_back': return <RotateCcw className="w-4 h-4 text-red-500" />
            case 'cancelled': return <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            default: return <AlertCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <GitBranch className="w-8 h-8 text-primary-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rollout Pipelines</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Progressive rollout management with staged deployments</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                    <Plus className="w-4 h-4 mr-2" /> New Pipeline
                </button>
            </div>

            {isLoading ? (
                <Skeleton variant="card" count={3} />
            ) : pipelines.length === 0 ? (
                <div className="text-center py-12">
                    <GitBranch className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No rollout pipelines</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a pipeline to progressively roll out a feature flag</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {pipelines.map(pipeline => (
                        <div key={pipeline.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    {getStatusIcon(pipeline.status)}
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            <code className="text-primary-500">{pipeline.flag_key}</code>
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Status: {pipeline.status} &middot; Stage {pipeline.current_stage_index + 1} of {pipeline.stages.length}
                                            &middot; Started {new Date(pipeline.stage_started_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {(pipeline.status === 'active' || pipeline.status === 'running') && (
                                        <>
                                            {pipeline.current_stage_index < pipeline.stages.length - 1 && (
                                                <button
                                                    onClick={() => setConfirmAction({ type: 'advance', flagKey: pipeline.flag_key })}
                                                    className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                                                >
                                                    <SkipForward className="w-3 h-3 mr-1" /> Advance
                                                </button>
                                            )}
                                            <button
                                                onClick={() => pauseMutation.mutate(pipeline.flag_key)}
                                                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50"
                                            >
                                                <Pause className="w-3 h-3 mr-1" /> Pause
                                            </button>
                                            <button
                                                onClick={() => setConfirmAction({ type: 'rollback', flagKey: pipeline.flag_key })}
                                                className="flex items-center px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                                            </button>
                                        </>
                                    )}
                                    {pipeline.status === 'paused' && (
                                        <>
                                            <button
                                                onClick={() => resumeMutation.mutate(pipeline.flag_key)}
                                                className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                                            >
                                                <Play className="w-3 h-3 mr-1" /> Resume
                                            </button>
                                            <button
                                                onClick={() => setConfirmAction({ type: 'cancel', flagKey: pipeline.flag_key })}
                                                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50"
                                            >
                                                <X className="w-3 h-3 mr-1" /> Cancel
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Stage Progress Bar */}
                            <div className="flex items-center space-x-1">
                                {pipeline.stages.map((stage, i) => {
                                    let status = 'pending'
                                    if (i < pipeline.current_stage_index) status = 'completed'
                                    else if (i === pipeline.current_stage_index) status = 'active'
                                    return (
                                        <div key={i} className="flex-1 flex items-center">
                                            <div className="flex-1 flex flex-col items-center">
                                                <div className={`h-2 w-full rounded-full ${STAGE_STATUS_COLORS[status]}`} />
                                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {stage.percentage}%
                                                    {stage.duration_minutes > 0 && (
                                                        <span className="ml-1 text-gray-400 dark:text-gray-500">({stage.duration_minutes}m)</span>
                                                    )}
                                                </div>
                                            </div>
                                            {i < pipeline.stages.length - 1 && (
                                                <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 mx-0.5 flex-shrink-0" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Pipeline Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create Rollout Pipeline</h3>
                        <form onSubmit={e => { e.preventDefault(); createMutation.mutate() }} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flag</label>
                                <select
                                    value={selectedFlag}
                                    onChange={e => setSelectedFlag(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                >
                                    <option value="">Select a flag...</option>
                                    {flags.map((f: { key: string; name: string }) => (
                                        <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center space-x-4 mb-3">
                                    <label className="flex items-center space-x-2">
                                        <input type="checkbox" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} className="rounded" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Use template</span>
                                    </label>
                                </div>

                                {useTemplate && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                        {allTemplates.map((t, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => applyTemplate(i)}
                                                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                                    selectedTemplate === i
                                                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-500'
                                                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500'
                                                }`}
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stages</label>
                                <div className="space-y-2">
                                    {stages.map((stage, i) => (
                                        <div key={i} className="flex items-center space-x-3">
                                            <span className="text-xs text-gray-400 dark:text-gray-500 w-6">{i + 1}.</span>
                                            <div className="flex-1 flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={stage.percentage}
                                                    onChange={e => updateStage(i, 'percentage', Number(e.target.value))}
                                                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                                />
                                                <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                                                <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-2" />
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={stage.duration_minutes}
                                                    onChange={e => updateStage(i, 'duration_minutes', Number(e.target.value))}
                                                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                                />
                                                <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
                                            </div>
                                            {stages.length > 2 && (
                                                <button type="button" onClick={() => removeStage(i)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addStage} className="mt-2 text-sm text-primary-500 hover:text-primary-600 flex items-center">
                                    <Plus className="w-4 h-4 mr-1" /> Add Stage
                                </button>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createMutation.isPending || !selectedFlag} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                                    {createMutation.isPending ? 'Creating...' : 'Create Pipeline'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Actions */}
            <ConfirmDialog
                isOpen={confirmAction?.type === 'advance'}
                title="Advance Pipeline"
                message={`Are you sure you want to advance the pipeline for "${confirmAction?.flagKey}" to the next stage? This will increase the rollout percentage.`}
                confirmLabel="Advance"
                variant="warning"
                onConfirm={() => confirmAction && advanceMutation.mutate(confirmAction.flagKey)}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={confirmAction?.type === 'rollback'}
                title="Rollback Pipeline"
                message={`Are you sure you want to rollback the pipeline for "${confirmAction?.flagKey}"? This will revert to the previous stage.`}
                confirmLabel="Rollback"
                variant="danger"
                onConfirm={() => confirmAction && rollbackMutation.mutate(confirmAction.flagKey)}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={confirmAction?.type === 'cancel'}
                title="Cancel Pipeline"
                message={`Are you sure you want to cancel the pipeline for "${confirmAction?.flagKey}"? This action cannot be undone.`}
                confirmLabel="Cancel Pipeline"
                variant="danger"
                onConfirm={() => confirmAction && cancelMutation.mutate(confirmAction.flagKey)}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    )
}

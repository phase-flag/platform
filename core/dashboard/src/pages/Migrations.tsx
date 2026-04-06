import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { migrationsApi, type MigrationFlag } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { ArrowRightLeft, Plus, ChevronRight, SkipForward, RotateCcw, Trash2, ArrowRight } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import Skeleton from '@/components/Skeleton'

const STAGE_COLORS: Record<string, string> = {
    shadow: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    dual_read: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    dual_write: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    cutover: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    complete: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

const DEFAULT_STAGES = ['shadow', 'dual_read', 'dual_write', 'cutover', 'complete']

export default function Migrations() {
    const queryClient = useQueryClient()
    const { addToast } = useToast()
    const [showCreate, setShowCreate] = useState(false)
    const [deleteKey, setDeleteKey] = useState<string | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ type: 'advance' | 'rollback'; key: string } | null>(null)

    // Create form
    const [formKey, setFormKey] = useState('')
    const [formName, setFormName] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formSource, setFormSource] = useState('')
    const [formTarget, setFormTarget] = useState('')
    const [formStages, setFormStages] = useState(DEFAULT_STAGES.join(', '))

    const { data: migrationsData, isLoading } = useQuery({
        queryKey: ['migrations'],
        queryFn: () => migrationsApi.list({ limit: 100 }),
    })

    const createMutation = useMutation({
        mutationFn: () => migrationsApi.create({
            key: formKey,
            name: formName,
            description: formDescription || undefined,
            source_system: formSource,
            target_system: formTarget,
            stages: formStages.split(',').map(s => s.trim()).filter(Boolean),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['migrations'] })
            addToast('Migration created', 'success')
            setShowCreate(false)
            setFormKey('')
            setFormName('')
            setFormDescription('')
            setFormSource('')
            setFormTarget('')
            setFormStages(DEFAULT_STAGES.join(', '))
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const advanceMutation = useMutation({
        mutationFn: (key: string) => migrationsApi.advanceStage(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['migrations'] })
            addToast('Migration advanced to next stage', 'success')
            setConfirmAction(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const rollbackMutation = useMutation({
        mutationFn: (key: string) => migrationsApi.rollbackStage(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['migrations'] })
            addToast('Migration rolled back', 'success')
            setConfirmAction(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const deleteMutation = useMutation({
        mutationFn: (key: string) => migrationsApi.delete(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['migrations'] })
            addToast('Migration deleted', 'success')
            setDeleteKey(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const migrationsRaw = migrationsData?.data || []
    const migrations: MigrationFlag[] = Array.isArray(migrationsRaw) ? migrationsRaw : (migrationsRaw as any)?.items || []

    function getStageIndex(migration: MigrationFlag) {
        return migration.stages.indexOf(migration.current_stage)
    }

    function isLastStage(migration: MigrationFlag) {
        return getStageIndex(migration) >= migration.stages.length - 1
    }

    function isFirstStage(migration: MigrationFlag) {
        return getStageIndex(migration) <= 0
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <ArrowRightLeft className="w-8 h-8 text-primary-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Migrations</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage system-to-system migrations with staged rollouts</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                    <Plus className="w-4 h-4 mr-2" /> New Migration
                </button>
            </div>

            {isLoading ? (
                <Skeleton variant="card" count={3} />
            ) : migrations.length === 0 ? (
                <div className="text-center py-12">
                    <ArrowRightLeft className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No migrations found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a migration to manage system transitions</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {migrations.map(m => {
                        const stageIdx = getStageIndex(m)
                        return (
                            <div key={m.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{m.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            <code className="text-primary-500">{m.key}</code>
                                            {m.description && <span className="ml-2">— {m.description}</span>}
                                        </p>
                                        <div className="flex items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="font-medium">{m.source_system}</span>
                                            <ArrowRight className="w-4 h-4 mx-2 text-primary-500" />
                                            <span className="font-medium">{m.target_system}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {!isLastStage(m) && (
                                            <button
                                                onClick={() => setConfirmAction({ type: 'advance', key: m.key })}
                                                className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                                            >
                                                <SkipForward className="w-3 h-3 mr-1" /> Advance
                                            </button>
                                        )}
                                        {!isFirstStage(m) && (
                                            <button
                                                onClick={() => setConfirmAction({ type: 'rollback', key: m.key })}
                                                className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50"
                                            >
                                                <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDeleteKey(m.key)}
                                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Stage Progress */}
                                <div className="flex items-center space-x-1 mb-3">
                                    {m.stages.map((stage, i) => {
                                        let bg = 'bg-gray-200 dark:bg-gray-600'
                                        if (i < stageIdx) bg = 'bg-green-400'
                                        else if (i === stageIdx) bg = 'bg-primary-500'
                                        return (
                                            <div key={stage} className="flex-1 flex items-center">
                                                <div className="flex-1 flex flex-col items-center">
                                                    <div className={`h-2.5 w-full rounded-full ${bg}`} />
                                                    <span className={`mt-1 text-xs ${i === stageIdx ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {stage.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                {i < m.stages.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 mx-0.5 flex-shrink-0" />}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Current Stage Badge */}
                                <div className="flex items-center justify-between">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[m.current_stage] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                        Current: {m.current_stage.replace('_', ' ')}
                                    </span>
                                    {Object.keys(m.metrics).length > 0 && (
                                        <div className="flex items-center space-x-3">
                                            {Object.entries(m.metrics).map(([key, val]) => (
                                                <span key={key} className="text-xs text-gray-500 dark:text-gray-400">
                                                    {key}: <span className="font-medium text-gray-700 dark:text-gray-300">{typeof val === 'number' ? val.toLocaleString() : String(val)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                    Created {new Date(m.created_at).toLocaleDateString()} &middot; Updated {new Date(m.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Migration Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Migration</h3>
                        <form onSubmit={e => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                                    <input
                                        type="text"
                                        value={formKey}
                                        onChange={e => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                        required
                                        placeholder="db-migration-v2"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        required
                                        placeholder="Database Migration V2"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Describe the migration..."
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source System</label>
                                    <input
                                        type="text"
                                        value={formSource}
                                        onChange={e => setFormSource(e.target.value)}
                                        required
                                        placeholder="MySQL"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target System</label>
                                    <input
                                        type="text"
                                        value={formTarget}
                                        onChange={e => setFormTarget(e.target.value)}
                                        required
                                        placeholder="PostgreSQL"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stages (comma-separated)</label>
                                <input
                                    type="text"
                                    value={formStages}
                                    onChange={e => setFormStages(e.target.value)}
                                    placeholder="shadow, dual_read, dual_write, cutover, complete"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Default: shadow, dual_read, dual_write, cutover, complete</p>
                            </div>
                            <div className="flex justify-end space-x-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                                    {createMutation.isPending ? 'Creating...' : 'Create Migration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Dialogs */}
            <ConfirmDialog
                isOpen={confirmAction?.type === 'advance'}
                title="Advance Migration"
                message={`Are you sure you want to advance the migration "${confirmAction?.key}" to the next stage?`}
                confirmLabel="Advance"
                variant="warning"
                onConfirm={() => confirmAction && advanceMutation.mutate(confirmAction.key)}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={confirmAction?.type === 'rollback'}
                title="Rollback Migration"
                message={`Are you sure you want to rollback the migration "${confirmAction?.key}" to the previous stage?`}
                confirmLabel="Rollback"
                variant="danger"
                onConfirm={() => confirmAction && rollbackMutation.mutate(confirmAction.key)}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={!!deleteKey}
                title="Delete Migration"
                message="This will permanently delete this migration and all its data."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => deleteKey && deleteMutation.mutate(deleteKey)}
                onCancel={() => setDeleteKey(null)}
            />
        </div>
    )
}

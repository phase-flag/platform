import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { environmentsApi, projectsApi, type Environment, type Project } from '@/lib/api'
import { Globe, Plus, Trash2, Lock, Unlock, Copy, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import clsx from 'clsx'
import Skeleton from '@/components/Skeleton'

export default function Environments() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [selectedProject, setSelectedProject] = useState<string>('')
    const [showCreate, setShowCreate] = useState(false)
    const [cloneEnv, setCloneEnv] = useState<Environment | null>(null)

    const { data: projectsData } = useQuery({
        queryKey: ['projects'],
        queryFn: () => projectsApi.list().then(r => r.data),
    })

    const projects = projectsData?.items || []

    const { data: envsData, isLoading } = useQuery({
        queryKey: ['environments', selectedProject],
        queryFn: () => environmentsApi.list(selectedProject).then(r => r.data),
        enabled: !!selectedProject,
    })

    const environments = envsData?.items || []

    const freezeMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => environmentsApi.freeze(id, { reason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['environments'] })
            toast('success', 'Environment frozen')
        },
        onError: (err) => toast('error', `Freeze failed: ${(err as Error).message}`),
    })

    const unfreezeMutation = useMutation({
        mutationFn: (id: string) => environmentsApi.unfreeze(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['environments'] })
            toast('success', 'Environment unfrozen')
        },
        onError: (err) => toast('error', `Unfreeze failed: ${(err as Error).message}`),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => environmentsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['environments'] })
            toast('success', 'Environment deleted')
        },
        onError: (err) => toast('error', `Delete failed: ${(err as Error).message}`),
    })

    function handleFreeze(env: Environment) {
        const reason = window.prompt('Reason for freezing this environment:')
        if (reason) {
            freezeMutation.mutate({ id: env.id, reason })
        }
    }

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Environments</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage environments per project, clone, freeze, and promote flags</p>
                </div>
                <button onClick={() => setShowCreate(true)} disabled={!selectedProject} className="btn btn-primary flex items-center space-x-2 disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                    <span>New Environment</span>
                </button>
            </div>

            {/* Project Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Project</label>
                <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-400"
                >
                    <option value="">Choose a project...</option>
                    {projects.map((p: Project) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                    ))}
                </select>
            </div>

            {!selectedProject && (
                <div className="card text-center py-12">
                    <Globe className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Select a project</h3>
                    <p className="text-gray-600 dark:text-gray-400">Choose a project above to view and manage its environments.</p>
                </div>
            )}

            {selectedProject && isLoading && <Skeleton variant="card" count={3} />}

            {selectedProject && !isLoading && environments.length === 0 && (
                <div className="card text-center py-12">
                    <Globe className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No environments yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first environment for this project.</p>
                    <button onClick={() => setShowCreate(true)} className="btn btn-primary">Create Environment</button>
                </div>
            )}

            {environments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {environments.map((env: Environment) => (
                        <div key={env.id} className={clsx('card', env.is_frozen && 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10')}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: env.color || '#6366F1' }} />
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{env.name}</h3>
                                </div>
                                {env.is_frozen && (
                                    <span className="badge badge-warning">Frozen</span>
                                )}
                            </div>
                            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-3">{env.key}</p>
                            {env.frozen_by && (
                                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                                    Frozen by {env.frozen_by} on {new Date(env.frozen_at!).toLocaleString()}
                                </p>
                            )}
                            <div className="flex items-center space-x-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                {env.is_frozen ? (
                                    <button onClick={() => unfreezeMutation.mutate(env.id)} className="text-sm text-amber-600 hover:text-amber-700 flex items-center space-x-1">
                                        <Unlock className="w-4 h-4" />
                                        <span>Unfreeze</span>
                                    </button>
                                ) : (
                                    <button onClick={() => handleFreeze(env)} className="text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 flex items-center space-x-1">
                                        <Lock className="w-4 h-4" />
                                        <span>Freeze</span>
                                    </button>
                                )}
                                <button onClick={() => setCloneEnv(env)} className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 flex items-center space-x-1">
                                    <Copy className="w-4 h-4" />
                                    <span>Clone</span>
                                </button>
                                <button
                                    onClick={() => { if (window.confirm(`Delete environment ${env.name}?`)) deleteMutation.mutate(env.id) }}
                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 flex items-center space-x-1 ml-auto"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && selectedProject && (
                <CreateEnvModal projectId={selectedProject} onClose={() => setShowCreate(false)} />
            )}

            {cloneEnv && (
                <CloneEnvModal environment={cloneEnv} onClose={() => setCloneEnv(null)} />
            )}
        </div>
    )
}

function CreateEnvModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [key, setKey] = useState('')
    const [name, setName] = useState('')
    const [color, setColor] = useState('#6366F1')

    const createMutation = useMutation({
        mutationFn: () => environmentsApi.create(projectId, { key, name, color }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['environments'] })
            toast('success', 'Environment created')
            onClose()
        },
        onError: (err) => toast('error', `Create failed: ${(err as Error).message}`),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Environment</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-400 dark:text-gray-500" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                        <input type="text" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="staging" className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Staging" className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer" />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={() => createMutation.mutate()} disabled={!key || !name || createMutation.isPending} className="btn btn-primary disabled:opacity-50">
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function CloneEnvModal({ environment, onClose }: { environment: Environment; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [targetKey, setTargetKey] = useState('')
    const [targetName, setTargetName] = useState('')

    const cloneMutation = useMutation({
        mutationFn: () => environmentsApi.clone(environment.id, { target_key: targetKey, target_name: targetName }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['environments'] })
            toast('success', 'Environment cloned')
            onClose()
        },
        onError: (err) => toast('error', `Clone failed: ${(err as Error).message}`),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Clone Environment: {environment.name}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-400 dark:text-gray-500" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Environment Key</label>
                        <input type="text" value={targetKey} onChange={(e) => setTargetKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="staging-copy" className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Environment Name</label>
                        <input type="text" value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="Staging Copy" className="input" />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={() => cloneMutation.mutate()} disabled={!targetKey || !targetName || cloneMutation.isPending} className="btn btn-primary disabled:opacity-50">
                        {cloneMutation.isPending ? 'Cloning...' : 'Clone'}
                    </button>
                </div>
            </div>
        </div>
    )
}

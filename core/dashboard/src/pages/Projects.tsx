import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationsApi, projectsApi, type Organization, type Project } from '@/lib/api'
import { FolderKanban, Plus, Trash2, Edit, Building2, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function Projects() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [showCreateOrg, setShowCreateOrg] = useState(false)
    const [showCreateProject, setShowCreateProject] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | null>(null)

    const { data: orgsData, isLoading: orgsLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => organizationsApi.list().then(r => r.data),
    })

    const { data: projectsData, isLoading: projectsLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: () => projectsApi.list().then(r => r.data),
    })

    const deleteProjectMutation = useMutation({
        mutationFn: (key: string) => projectsApi.delete(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            toast('success', 'Project deleted')
        },
        onError: (err) => toast('error', `Delete failed: ${(err as Error).message}`),
    })

    const deleteOrgMutation = useMutation({
        mutationFn: (key: string) => organizationsApi.delete(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] })
            toast('success', 'Organization deleted')
        },
        onError: (err) => toast('error', `Delete failed: ${(err as Error).message}`),
    })

    const orgs = orgsData?.items || []
    const projects = projectsData?.items || []
    const isLoading = orgsLoading || projectsLoading

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Projects & Organizations</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your organizational hierarchy and projects</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={() => setShowCreateOrg(true)} className="btn btn-secondary flex items-center space-x-2">
                        <Building2 className="w-5 h-5" />
                        <span>New Organization</span>
                    </button>
                    <button onClick={() => setShowCreateProject(true)} className="btn btn-primary flex items-center space-x-2">
                        <Plus className="w-5 h-5" />
                        <span>New Project</span>
                    </button>
                </div>
            </div>

            {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading...</p>}

            {/* Organizations */}
            {orgs.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Organizations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orgs.map((org: Organization) => (
                            <div key={org.id} className="card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                        <Building2 className="w-5 h-5 text-primary-500" />
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{org.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => { if (window.confirm(`Delete organization ${org.name}?`)) deleteOrgMutation.mutate(org.key) }}
                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                                <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{org.key}</p>
                                {org.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{org.description}</p>}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Created {new Date(org.created_at).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Projects */}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Projects</h2>
            {projects.length === 0 && !isLoading && (
                <div className="card text-center py-12">
                    <FolderKanban className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No projects yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first project to organize feature flags.</p>
                    <button onClick={() => setShowCreateProject(true)} className="btn btn-primary">Create Project</button>
                </div>
            )}

            {projects.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project: Project) => (
                        <div key={project.id} className="card hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                    <FolderKanban className="w-5 h-5 text-primary-500" />
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button onClick={() => setEditingProject(project)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded">
                                        <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    </button>
                                    <button
                                        onClick={() => { if (window.confirm(`Delete project ${project.name}?`)) deleteProjectMutation.mutate(project.key) }}
                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{project.key}</p>
                            {project.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{project.description}</p>}
                            <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
                                <span>By: {project.created_by || 'system'}</span>
                                <span>{new Date(project.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Organization Modal */}
            {showCreateOrg && <CreateOrgModal onClose={() => setShowCreateOrg(false)} />}

            {/* Create/Edit Project Modal */}
            {(showCreateProject || editingProject) && (
                <ProjectModal
                    project={editingProject}
                    onClose={() => { setShowCreateProject(false); setEditingProject(null) }}
                />
            )}
        </div>
    )
}

function CreateOrgModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [key, setKey] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const createMutation = useMutation({
        mutationFn: () => organizationsApi.create({ key, name, description: description || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['organizations'] })
            toast('success', 'Organization created')
            onClose()
        },
        onError: (err) => toast('error', `Create failed: ${(err as Error).message}`),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Organization</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-400 dark:text-gray-500" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                        <input type="text" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="my-org" className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Organization" className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" placeholder="Optional..." />
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

function ProjectModal({ project, onClose }: { project: Project | null; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const isEditing = !!project

    const [key, setKey] = useState(project?.key || '')
    const [name, setName] = useState(project?.name || '')
    const [description, setDescription] = useState(project?.description || '')

    const createMutation = useMutation({
        mutationFn: () => projectsApi.create({ key, name, description: description || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            toast('success', 'Project created')
            onClose()
        },
        onError: (err) => toast('error', `Create failed: ${(err as Error).message}`),
    })

    const updateMutation = useMutation({
        mutationFn: () => projectsApi.update(project!.key, { name, description: description || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            toast('success', 'Project updated')
            onClose()
        },
        onError: (err) => toast('error', `Update failed: ${(err as Error).message}`),
    })

    const handleSubmit = () => {
        if (isEditing) {
            updateMutation.mutate()
        } else {
            createMutation.mutate()
        }
    }

    const isPending = createMutation.isPending || updateMutation.isPending

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{isEditing ? 'Edit Project' : 'Create Project'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"><X className="w-5 h-5 text-gray-400 dark:text-gray-500" /></button>
                </div>
                <div className="space-y-4">
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                            <input type="text" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="my-project" className="input" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Project" className="input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" placeholder="Optional..." />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button onClick={handleSubmit} disabled={(!isEditing && !key) || !name || isPending} className="btn btn-primary disabled:opacity-50">
                        {isPending ? 'Saving...' : isEditing ? 'Save' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

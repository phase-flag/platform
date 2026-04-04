import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exclusionGroupsApi, flagsApi, type ExclusionGroup } from '@/lib/api'
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function ExclusionGroups() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editGroup, setEditGroup] = useState<ExclusionGroup | null>(null)
    const [deleteGroup, setDeleteGroup] = useState<ExclusionGroup | null>(null)
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

    const { data: groupsData, isLoading } = useQuery({
        queryKey: ['exclusion-groups'],
        queryFn: () => exclusionGroupsApi.list().then(r => r.data),
    })

    const { data: flagsData } = useQuery({
        queryKey: ['flags'],
        queryFn: () => flagsApi.list(undefined, { limit: 200 }).then(r => r.data),
    })

    const deleteMutation = useMutation({
        mutationFn: (key: string) => exclusionGroupsApi.delete(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exclusion-groups'] })
            toast('success', 'Exclusion group deleted')
            setDeleteGroup(null)
        },
        onError: (err) => toast('error', `Delete failed: ${(err as Error).message}`),
    })

    const toggleExpand = (key: string) => {
        setExpandedKeys(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    const groups = groupsData?.items || []
    const flags = flagsData?.items || []

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Mutual Exclusion Groups</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Ensure users see at most one experiment per group</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>New Group</span>
                </button>
            </div>

            {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading...</p>}

            {!isLoading && groups.length === 0 && (
                <div className="card text-center py-12">
                    <Layers className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No exclusion groups yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Create a group to ensure mutual exclusivity between experiments.</p>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">Create First Group</button>
                </div>
            )}

            {groups.length > 0 && (
                <div className="card overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8"></th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Members</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {groups.map((group) => (
                                <>
                                    <tr key={group.key} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50">
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleExpand(group.key)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                                                {expandedKeys.has(group.key) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{group.name}</p>
                                            {group.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">{group.key}</td>
                                        <td className="px-4 py-3">
                                            <span className="badge badge-info">{group.member_flag_keys.length} flags</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(group.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => setEditGroup(group)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded" title="Edit">
                                                    <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                </button>
                                                <button onClick={() => setDeleteGroup(group)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete">
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedKeys.has(group.key) && (
                                        <tr key={`${group.key}-expanded`}>
                                            <td colSpan={6} className="px-12 py-3 bg-gray-50 dark:bg-gray-700/50">
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Member Flags</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {group.member_flag_keys.map(fk => (
                                                        <span key={fk} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                                                            {fk}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / Edit Modal */}
            {(showCreateModal || editGroup) && (
                <GroupModal
                    group={editGroup}
                    flagKeys={flags.map(f => f.key)}
                    onClose={() => { setShowCreateModal(false); setEditGroup(null) }}
                />
            )}

            {/* Delete Confirmation */}
            {deleteGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteGroup(null)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Exclusion Group</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to delete <strong>{deleteGroup.name}</strong>? Member flags will no longer be mutually exclusive.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setDeleteGroup(null)} className="btn btn-secondary">Cancel</button>
                            <button
                                onClick={() => deleteMutation.mutate(deleteGroup.key)}
                                disabled={deleteMutation.isPending}
                                className="btn btn-danger disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function GroupModal({ group, flagKeys, onClose }: { group: ExclusionGroup | null; flagKeys: string[]; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const isEditing = !!group

    const [key, setKey] = useState(group?.key || '')
    const [name, setName] = useState(group?.name || '')
    const [description, setDescription] = useState(group?.description || '')
    const [selectedFlags, setSelectedFlags] = useState<string[]>(group?.member_flag_keys || [])
    const [flagSearch, setFlagSearch] = useState('')

    const createMutation = useMutation({
        mutationFn: (data: { key: string; name: string; description?: string; member_flag_keys: string[] }) =>
            exclusionGroupsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exclusion-groups'] })
            toast('success', 'Exclusion group created')
            onClose()
        },
        onError: (err) => toast('error', `Create failed: ${(err as Error).message}`),
    })

    const updateMutation = useMutation({
        mutationFn: (data: { name?: string; description?: string; member_flag_keys?: string[] }) =>
            exclusionGroupsApi.update(group!.key, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exclusion-groups'] })
            toast('success', 'Exclusion group updated')
            onClose()
        },
        onError: (err) => toast('error', `Update failed: ${(err as Error).message}`),
    })

    const toggleFlag = (fk: string) => {
        setSelectedFlags(prev => prev.includes(fk) ? prev.filter(f => f !== fk) : [...prev, fk])
    }

    const filteredFlags = flagKeys.filter(fk => fk.toLowerCase().includes(flagSearch.toLowerCase()))

    const handleSubmit = () => {
        if (selectedFlags.length < 2) {
            toast('error', 'At least 2 member flags are required')
            return
        }
        if (isEditing) {
            updateMutation.mutate({ name, description: description || undefined, member_flag_keys: selectedFlags })
        } else {
            if (!key.trim()) { toast('error', 'Key is required'); return }
            createMutation.mutate({ key, name, description: description || undefined, member_flag_keys: selectedFlags })
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {isEditing ? 'Edit Exclusion Group' : 'Create Exclusion Group'}
                </h3>

                <div className="space-y-4">
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                placeholder="experiment-group-1"
                                className="input"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Experiment Group 1" className="input" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" placeholder="Optional description..." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Member Flags ({selectedFlags.length} selected)
                        </label>
                        {selectedFlags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {selectedFlags.map(fk => (
                                    <span key={fk} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                        {fk}
                                        <button onClick={() => toggleFlag(fk)} className="ml-1 text-primary-400 hover:text-primary-600">&times;</button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <input
                            type="text"
                            value={flagSearch}
                            onChange={(e) => setFlagSearch(e.target.value)}
                            placeholder="Search flags..."
                            className="input mb-2"
                        />
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            {filteredFlags.map(fk => (
                                <label key={fk} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedFlags.includes(fk)}
                                        onChange={() => toggleFlag(fk)}
                                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 mr-2"
                                    />
                                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{fk}</span>
                                </label>
                            ))}
                            {filteredFlags.length === 0 && (
                                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No flags found</p>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select at least 2 flags for mutual exclusion</p>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="btn btn-primary disabled:opacity-50"
                    >
                        {isEditing ? 'Update' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

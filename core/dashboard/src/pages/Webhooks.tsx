import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { webhooksApi, type Webhook } from '@/lib/api'
import { Webhook as WebhookIcon, Plus, Trash2, X, ToggleLeft, ToggleRight, Globe, Pencil } from 'lucide-react'
import clsx from 'clsx'
import { useToast } from '@/contexts/ToastContext'
import EmptyState from '@/components/EmptyState'
import Skeleton from '@/components/Skeleton'

const AVAILABLE_EVENTS = [
    'flag.created',
    'flag.updated',
    'flag.deleted',
    'flag.toggled',
    'flag.archived',
    'segment.created',
    'segment.updated',
    'segment.deleted',
]

export default function Webhooks() {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const { data: paginatedData, isLoading } = useQuery({
        queryKey: ['webhooks'],
        queryFn: () => webhooksApi.list().then(res => res.data),
    })

    const webhooks = paginatedData?.items

    const toggleMutation = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) =>
            webhooksApi.update(id, { active }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
            toast('success', 'Webhook status updated')
        },
        onError: () => {
            toast('error', 'Failed to update webhook status')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => webhooksApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
            toast('success', 'Webhook deleted')
        },
        onError: () => {
            toast('error', 'Failed to delete webhook')
        },
    })

    function handleToggle(webhook: Webhook) {
        toggleMutation.mutate({ id: webhook.id, active: !webhook.active })
    }

    function handleDelete(webhook: Webhook) {
        if (window.confirm(`Delete webhook for ${webhook.url}?`)) {
            deleteMutation.mutate(webhook.id)
        }
    }

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Webhooks</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage webhook endpoints for event notifications</p>
                    </div>
                </div>
                <Skeleton variant="row" count={3} />
            </div>
        )
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Webhooks</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage webhook endpoints for event notifications</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} title="Set up an HTTP callback for flag change events" className="btn btn-primary flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Create Webhook</span>
                </button>
            </div>

            {/* Webhooks List */}
            <div className="space-y-4">
                {webhooks?.map((webhook) => (
                    <div key={webhook.id} className="card hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-2">
                                    <Globe className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                                    <h3 title="The endpoint that will receive webhook POST requests" className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {webhook.url}
                                    </h3>
                                    <span className={clsx(
                                        'badge flex-shrink-0',
                                        webhook.active ? 'badge-success' : 'badge-danger'
                                    )}>
                                        {webhook.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mb-3" title="Which flag events trigger this webhook">
                                    {webhook.events.map(event => (
                                        <span key={event} className="badge badge-info">
                                            {event}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Created {new Date(webhook.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                                <button
                                    onClick={() => setEditingWebhook(webhook)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors"
                                    title="Edit webhook"
                                >
                                    <Pencil className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" />
                                </button>
                                <button
                                    onClick={() => handleToggle(webhook)}
                                    disabled={toggleMutation.isPending}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors"
                                    title={webhook.active ? 'Deactivate webhook' : 'Activate webhook'}
                                >
                                    {webhook.active ? (
                                        <ToggleRight className="w-6 h-6 text-success-600" />
                                    ) : (
                                        <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleDelete(webhook)}
                                    disabled={deleteMutation.isPending}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors"
                                    title="Delete webhook"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {webhooks?.length === 0 && (
                <EmptyState
                    icon={WebhookIcon}
                    title="No webhooks yet"
                    description="Create your first webhook to receive event notifications"
                    actionLabel="Create Webhook"
                    onAction={() => setShowCreateModal(true)}
                />
            )}

            {/* Create Modal */}
            <CreateWebhookModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

            {/* Edit Modal */}
            {editingWebhook && (
                <EditWebhookModal
                    webhook={editingWebhook}
                    onClose={() => setEditingWebhook(null)}
                />
            )}
        </div>
    )
}

function CreateWebhookModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const [url, setUrl] = useState('')
    const [secret, setSecret] = useState('')
    const [selectedEvents, setSelectedEvents] = useState<string[]>([])
    const [errors, setErrors] = useState<Record<string, string>>({})

    const createMutation = useMutation({
        mutationFn: (data: Parameters<typeof webhooksApi.create>[0]) => webhooksApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
            toast('success', 'Webhook created successfully')
            resetForm()
            onClose()
        },
        onError: () => {
            toast('error', 'Failed to create webhook')
        },
    })

    function resetForm() {
        setUrl('')
        setSecret('')
        setSelectedEvents([])
        setErrors({})
    }

    function handleClose() {
        resetForm()
        onClose()
    }

    function toggleEvent(event: string) {
        setSelectedEvents(prev =>
            prev.includes(event)
                ? prev.filter(e => e !== event)
                : [...prev, event]
        )
    }

    function validate(): boolean {
        const newErrors: Record<string, string> = {}
        if (!url.trim()) {
            newErrors.url = 'URL is required'
        } else {
            try {
                new URL(url)
            } catch {
                newErrors.url = 'Must be a valid URL'
            }
        }
        if (selectedEvents.length === 0) {
            newErrors.events = 'Select at least one event'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validate()) return
        createMutation.mutate({
            url,
            events: selectedEvents,
            ...(secret.trim() ? { secret } : {}),
        })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Webhook</h2>
                    <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Endpoint URL
                        </label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/webhooks"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                        />
                        {errors.url && <p className="mt-1 text-sm text-red-600">{errors.url}</p>}
                    </div>

                    {/* Secret */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Secret <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            placeholder="whsec_..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Used to sign webhook payloads for verification
                        </p>
                    </div>

                    {/* Events */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Events
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_EVENTS.map(event => (
                                <label
                                    key={event}
                                    className={clsx(
                                        'flex items-center space-x-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors',
                                        selectedEvents.includes(event)
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-600'
                                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedEvents.includes(event)}
                                        onChange={() => toggleEvent(event)}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{event}</span>
                                </label>
                            ))}
                        </div>
                        {errors.events && <p className="mt-1 text-sm text-red-600">{errors.events}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
                        </button>
                    </div>

                    {createMutation.isError && (
                        <p className="text-sm text-red-600">
                            Failed: {(createMutation.error as Error)?.message || 'Unknown error'}
                        </p>
                    )}
                </form>
            </div>
        </div>
    )
}

function EditWebhookModal({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const [url, setUrl] = useState(webhook.url)
    const [selectedEvents, setSelectedEvents] = useState<string[]>(webhook.events)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const updateMutation = useMutation({
        mutationFn: (data: Parameters<typeof webhooksApi.update>[1]) => webhooksApi.update(webhook.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
            toast('success', 'Webhook updated')
            onClose()
        },
        onError: () => {
            toast('error', 'Failed to update webhook')
        },
    })

    function toggleEvent(event: string) {
        setSelectedEvents(prev =>
            prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
        )
    }

    function validate(): boolean {
        const newErrors: Record<string, string> = {}
        if (!url.trim()) {
            newErrors.url = 'URL is required'
        } else {
            try { new URL(url) } catch { newErrors.url = 'Must be a valid URL' }
        }
        if (selectedEvents.length === 0) {
            newErrors.events = 'Select at least one event'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validate()) return
        updateMutation.mutate({ url, events: selectedEvents })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Webhook</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint URL</label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                        />
                        {errors.url && <p className="mt-1 text-sm text-red-600">{errors.url}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Events</label>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_EVENTS.map(event => (
                                <label
                                    key={event}
                                    className={clsx(
                                        'flex items-center space-x-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors',
                                        selectedEvents.includes(event)
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-600'
                                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedEvents.includes(event)}
                                        onChange={() => toggleEvent(event)}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{event}</span>
                                </label>
                            ))}
                        </div>
                        {errors.events && <p className="mt-1 text-sm text-red-600">{errors.events}</p>}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

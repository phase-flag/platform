import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { remoteConfigApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import { useProject } from '@/contexts/ProjectContext'
import { Database, Plus, Trash2, Search, X, ChevronRight } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Link } from 'react-router-dom'
import Skeleton from '@/components/Skeleton'

const VALUE_TYPES = ['string', 'number', 'boolean', 'json'] as const
const ENV_OPTIONS = ['all', 'development', 'staging', 'production'] as const

interface RemoteConfigEntry {
    id: string
    key: string
    name: string
    description?: string | null
    config_type: string
    value: unknown
    default_value: unknown
    environment: string
    is_server_only: boolean
    version: number
    owner: string
    created_at: string
    updated_at: string
}

export default function RemoteConfig() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const { environment } = useEnvironment()
    const { project } = useProject()

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [deleteKey, setDeleteKey] = useState<string | null>(null)

    // Search and filter state
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [envFilter, setEnvFilter] = useState<string>('all')

    const { data: configData, isLoading } = useQuery({
        queryKey: ['remote-config', environment, project?.key],
        queryFn: () => remoteConfigApi.list({ environment: environment || undefined, limit: 200, project_key: project?.key ?? undefined }).then(r => r.data),
    })

    const rawEntries = configData as any
    const entries: RemoteConfigEntry[] = Array.isArray(rawEntries) ? rawEntries : rawEntries?.items || []

    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            if (search) {
                const q = search.toLowerCase()
                const matches = entry.key.toLowerCase().includes(q) ||
                    entry.name.toLowerCase().includes(q) ||
                    (entry.description && entry.description.toLowerCase().includes(q))
                if (!matches) return false
            }
            if (typeFilter !== 'all' && entry.config_type !== typeFilter) return false
            if (envFilter !== 'all' && entry.environment !== envFilter) return false
            return true
        })
    }, [entries, search, typeFilter, envFilter])

    const deleteMutation = useMutation({
        mutationFn: (id: string) => remoteConfigApi.deleteById(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remote-config'] })
            toast('success', 'Config deleted')
            setDeleteId(null)
            setDeleteKey(null)
        },
        onError: (err: Error) => toast('error', err.message),
    })

    function formatValuePreview(value: unknown, type: string): string {
        if (value === null || value === undefined) return 'null'
        if (type === 'json' || typeof value === 'object') {
            const str = JSON.stringify(value)
            return str.length > 60 ? str.slice(0, 60) + '…' : str
        }
        const str = String(value)
        return str.length > 60 ? str.slice(0, 60) + '…' : str
    }

    const hasFilters = search !== '' || typeFilter !== 'all' || envFilter !== 'all'

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                    <Database className="w-8 h-8 text-primary-500" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Remote Config</h1>
                        <p className="mt-1 text-gray-600 dark:text-gray-400">Manage typed configuration values across environments</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    title="Create a remote configuration value"
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Config</span>
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by key, name, or description..."
                        title="Search remote config entries by key, name, or description"
                        className="input pl-9"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                >
                    <option value="all">All Types</option>
                    {VALUE_TYPES.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                </select>
                <select
                    value={envFilter}
                    onChange={e => setEnvFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                >
                    {ENV_OPTIONS.map(e => (
                        <option key={e} value={e}>{e === 'all' ? 'All Environments' : e.charAt(0).toUpperCase() + e.slice(1)}</option>
                    ))}
                </select>
                {hasFilters && (
                    <button
                        onClick={() => { setSearch(''); setTypeFilter('all'); setEnvFilter('all') }}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* Results count */}
            {!isLoading && entries.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Showing {filteredEntries.length} of {entries.length} config{entries.length !== 1 ? 's' : ''}
                </p>
            )}

            {/* Content */}
            {isLoading ? (
                <Skeleton variant="card" count={4} />
            ) : entries.length === 0 ? (
                <div className="card text-center py-16">
                    <Database className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No remote config entries</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">Create configuration values that your SDKs can fetch at runtime.</p>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">New Config</button>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="card text-center py-12">
                    <Search className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No configs match your filters</h3>
                    <button
                        onClick={() => { setSearch(''); setTypeFilter('all'); setEnvFilter('all') }}
                        className="text-sm text-primary-500 hover:underline mt-1"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredEntries.map(entry => (
                        <div
                            key={entry.id}
                            title="Click to edit value, view version history, and validate schema"
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-black/20 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150"
                        >
                            <div className="flex items-center p-4">
                                <Link
                                    to={`/remote-config/${entry.id}`}
                                    className="flex-1 min-w-0"
                                >
                                    <div className="flex items-center space-x-3 mb-1.5">
                                        <code className="text-sm font-semibold text-primary-500">{entry.key}</code>
                                        <span title="The data type of this configuration value" className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                            {entry.config_type}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">v{entry.version}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{entry.environment}</span>
                                        {entry.is_server_only && (
                                            <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                server-only
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{entry.name}</p>
                                    <div className="mt-1.5 bg-gray-50 dark:bg-gray-700/50 rounded px-2.5 py-1.5">
                                        <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                                            {formatValuePreview(entry.value, entry.config_type)}
                                        </pre>
                                    </div>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                                        Updated {new Date(entry.updated_at).toLocaleDateString()}
                                    </p>
                                </Link>
                                <div className="flex items-center space-x-1 ml-4">
                                    <Link
                                        to={`/remote-config/${entry.id}`}
                                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-500"
                                        title="Edit config"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </Link>
                                    <button
                                        onClick={() => { setDeleteId(entry.id); setDeleteKey(entry.key) }}
                                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <CreateConfigModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        queryClient.invalidateQueries({ queryKey: ['remote-config'] })
                        setShowCreateModal(false)
                    }}
                    defaultEnvironment={environment || 'development'}
                />
            )}

            {/* Delete Confirm */}
            <ConfirmDialog
                isOpen={!!deleteId}
                title="Delete Config"
                message={`This will permanently delete "${deleteKey}" and all its version history. This cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
                onCancel={() => { setDeleteId(null); setDeleteKey(null) }}
            />
        </div>
    )
}

function CreateConfigModal({
    onClose,
    onCreated,
    defaultEnvironment,
}: {
    onClose: () => void
    onCreated: () => void
    defaultEnvironment: string
}) {
    const { toast } = useToast()
    const [formKey, setFormKey] = useState('')
    const [formName, setFormName] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formType, setFormType] = useState<string>('string')
    const [formValue, setFormValue] = useState('')
    const [formDefaultValue, setFormDefaultValue] = useState('')
    const [formEnvironment, setFormEnvironment] = useState(defaultEnvironment || 'development')
    const [formSchema, setFormSchema] = useState('')
    const [formServerOnly, setFormServerOnly] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const createMutation = useMutation({
        mutationFn: () => {
            const parseVal = (raw: string) => {
                if (formType === 'number') return Number(raw)
                if (formType === 'boolean') return raw === 'true'
                if (formType === 'json') return JSON.parse(raw)
                return raw
            }
            const schema = formSchema.trim() ? JSON.parse(formSchema) : undefined
            return remoteConfigApi.create({
                key: formKey,
                name: formName,
                description: formDescription || undefined,
                config_type: formType,
                value: parseVal(formValue),
                default_value: parseVal(formDefaultValue || formValue),
                environment: formEnvironment,
                schema_definition: schema,
                is_server_only: formServerOnly,
            })
        },
        onSuccess: () => {
            toast('success', 'Config created')
            onCreated()
        },
        onError: (err: Error) => toast('error', err.message),
    })

    function validate(): boolean {
        const e: Record<string, string> = {}
        if (!formKey.trim()) e.key = 'Required'
        else if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(formKey)) e.key = 'Lowercase letters, numbers, dots, dashes, underscores only'
        if (!formName.trim()) e.name = 'Required'
        if (!formValue.trim()) e.value = 'Required'
        if (formType === 'number' && isNaN(Number(formValue))) e.value = 'Must be a number'
        if (formType === 'json') {
            try { JSON.parse(formValue) } catch { e.value = 'Invalid JSON' }
        }
        if (formDefaultValue && formType === 'number' && isNaN(Number(formDefaultValue))) e.defaultValue = 'Must be a number'
        if (formDefaultValue && formType === 'json') {
            try { JSON.parse(formDefaultValue) } catch { e.defaultValue = 'Invalid JSON' }
        }
        if (formSchema.trim()) {
            try { JSON.parse(formSchema) } catch { e.schema = 'Invalid JSON' }
        }
        setErrors(e)
        return Object.keys(e).length === 0
    }

    function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault()
        if (!validate()) return
        createMutation.mutate()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">New Remote Config</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formKey}
                                onChange={e => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                                placeholder="app.feature.timeout"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                            />
                            {errors.key && <p className="text-xs text-red-600 mt-1">{errors.key}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="Feature Timeout"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                            />
                            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <input
                            type="text"
                            value={formDescription}
                            onChange={e => setFormDescription(e.target.value)}
                            placeholder="What is this config used for?"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
                        <div className="flex space-x-2">
                            {VALUE_TYPES.map(vt => (
                                <button
                                    key={vt}
                                    type="button"
                                    onClick={() => {
                                        setFormType(vt)
                                        setFormValue(vt === 'boolean' ? 'true' : vt === 'number' ? '0' : vt === 'json' ? '{}' : '')
                                        setFormDefaultValue('')
                                    }}
                                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                        formType === vt
                                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                                    }`}
                                >
                                    {vt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value <span className="text-red-500">*</span></label>
                        {formType === 'boolean' ? (
                            <select
                                value={formValue}
                                onChange={e => setFormValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                            >
                                <option value="true">true</option>
                                <option value="false">false</option>
                            </select>
                        ) : formType === 'json' ? (
                            <textarea
                                value={formValue}
                                onChange={e => setFormValue(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-900 dark:text-gray-100"
                                placeholder='{"key": "value"}'
                            />
                        ) : (
                            <input
                                type={formType === 'number' ? 'number' : 'text'}
                                value={formValue}
                                onChange={e => setFormValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                                placeholder={formType === 'number' ? '0' : 'Value...'}
                            />
                        )}
                        {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Value (fallback)</label>
                        {formType === 'boolean' ? (
                            <select
                                value={formDefaultValue || 'false'}
                                onChange={e => setFormDefaultValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                            >
                                <option value="true">true</option>
                                <option value="false">false</option>
                            </select>
                        ) : formType === 'json' ? (
                            <textarea
                                value={formDefaultValue}
                                onChange={e => setFormDefaultValue(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-900 dark:text-gray-100"
                                placeholder='{"key": "default"}'
                            />
                        ) : (
                            <input
                                type={formType === 'number' ? 'number' : 'text'}
                                value={formDefaultValue}
                                onChange={e => setFormDefaultValue(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                                placeholder="Fallback value..."
                            />
                        )}
                        {errors.defaultValue && <p className="text-xs text-red-600 mt-1">{errors.defaultValue}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
                            <select
                                value={formEnvironment}
                                onChange={e => setFormEnvironment(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm"
                            >
                                <option value="development">development</option>
                                <option value="staging">staging</option>
                                <option value="production">production</option>
                            </select>
                        </div>
                        <div className="flex items-end pb-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formServerOnly}
                                    onChange={e => setFormServerOnly(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Server-only (hide from client SDKs)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">JSON Schema (optional)</label>
                        <textarea
                            value={formSchema}
                            onChange={e => setFormSchema(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-900 dark:text-gray-100"
                            placeholder='{"type": "object", "properties": {...}}'
                        />
                        {errors.schema && <p className="text-xs text-red-600 mt-1">{errors.schema}</p>}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Config'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

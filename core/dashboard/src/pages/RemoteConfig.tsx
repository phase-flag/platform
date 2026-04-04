import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { remoteConfigApi, type RemoteConfigEntry } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import { Database, Plus, Pencil, Trash2, Clock, ChevronUp } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

const VALUE_TYPES = ['string', 'number', 'boolean', 'json'] as const

export default function RemoteConfig() {
    const queryClient = useQueryClient()
    const { addToast } = useToast()
    const { environment } = useEnvironment()
    const [showEditor, setShowEditor] = useState(false)
    const [editingEntry, setEditingEntry] = useState<RemoteConfigEntry | null>(null)
    const [deleteKey, setDeleteKey] = useState<string | null>(null)
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null)

    // Form state
    const [formKey, setFormKey] = useState('')
    const [formName, setFormName] = useState('')
    const [formValueType, setFormValueType] = useState<string>('string')
    const [formValue, setFormValue] = useState('')
    const [formSchema, setFormSchema] = useState('')
    const [formErrors, setFormErrors] = useState<Record<string, string>>({})

    const { data: configData, isLoading } = useQuery({
        queryKey: ['remote-config', environment],
        queryFn: () => remoteConfigApi.list({ environment, limit: 200 }),
    })

    const { data: historyData } = useQuery({
        queryKey: ['remote-config-history', expandedHistory],
        queryFn: () => remoteConfigApi.history(expandedHistory!),
        enabled: !!expandedHistory,
    })

    const createMutation = useMutation({
        mutationFn: () => {
            let parsedValue: unknown = formValue
            if (formValueType === 'number') parsedValue = Number(formValue)
            else if (formValueType === 'boolean') parsedValue = formValue === 'true'
            else if (formValueType === 'json') {
                try { parsedValue = JSON.parse(formValue) } catch { /* keep string */ }
            }

            let parsedSchema: Record<string, unknown> | undefined
            if (formSchema.trim()) {
                try { parsedSchema = JSON.parse(formSchema) } catch { /* ignore invalid schema */ }
            }

            if (editingEntry) {
                return remoteConfigApi.update(editingEntry.key, { value: parsedValue, schema: parsedSchema })
            }
            return remoteConfigApi.create({
                key: formKey,
                name: formName,
                value_type: formValueType,
                value: parsedValue,
                schema: parsedSchema,
                environment,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remote-config'] })
            addToast(editingEntry ? 'Config updated' : 'Config created', 'success')
            closeEditor()
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const deleteMutation = useMutation({
        mutationFn: (key: string) => remoteConfigApi.delete(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remote-config'] })
            addToast('Config deleted', 'success')
            setDeleteKey(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const configRaw = configData?.data || []
    const entries: RemoteConfigEntry[] = Array.isArray(configRaw) ? configRaw : (configRaw as any)?.items || []
    const history = historyData?.data || []

    function openCreate() {
        setEditingEntry(null)
        setFormKey('')
        setFormName('')
        setFormValueType('string')
        setFormValue('')
        setFormSchema('')
        setFormErrors({})
        setShowEditor(true)
    }

    function openEdit(entry: RemoteConfigEntry) {
        setEditingEntry(entry)
        setFormKey(entry.key)
        setFormName(entry.name)
        setFormValueType(entry.value_type)
        setFormValue(typeof entry.value === 'object' ? JSON.stringify(entry.value, null, 2) : String(entry.value))
        setFormSchema(entry.schema ? JSON.stringify(entry.schema, null, 2) : '')
        setFormErrors({})
        setShowEditor(true)
    }

    function closeEditor() {
        setShowEditor(false)
        setEditingEntry(null)
    }

    function validate(): boolean {
        const errors: Record<string, string> = {}
        if (!editingEntry) {
            if (!formKey.trim()) errors.key = 'Key is required'
            else if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(formKey)) errors.key = 'Key must be lowercase with dots, dashes, or underscores'
            if (!formName.trim()) errors.name = 'Name is required'
        }
        if (formValueType === 'number' && isNaN(Number(formValue))) errors.value = 'Invalid number'
        if (formValueType === 'json') {
            try { JSON.parse(formValue) } catch { errors.value = 'Invalid JSON' }
        }
        if (formSchema.trim()) {
            try { JSON.parse(formSchema) } catch { errors.schema = 'Invalid JSON schema' }
        }
        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validate()) return
        createMutation.mutate()
    }

    function formatValue(value: unknown, type: string): string {
        if (type === 'json' || typeof value === 'object') return JSON.stringify(value, null, 2)
        return String(value)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <Database className="w-8 h-8 text-[#5BBAA7]" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Remote Config</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage typed configuration values across environments</p>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-[#5BBAA7] rounded-lg hover:bg-[#4AA896]"
                >
                    <Plus className="w-4 h-4 mr-2" /> New Config
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading remote config...</div>
            ) : entries.length === 0 ? (
                <div className="text-center py-12">
                    <Database className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No remote config entries</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create configuration values that your SDKs can fetch</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map(entry => (
                        <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="flex items-center justify-between p-4">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                        <code className="text-sm font-semibold text-[#5BBAA7]">{entry.key}</code>
                                        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{entry.value_type}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">v{entry.version}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{entry.name}</p>
                                    <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2 max-h-20 overflow-auto">
                                        <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                            {formatValue(entry.value, entry.value_type)}
                                        </pre>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                    <button
                                        onClick={() => setExpandedHistory(expandedHistory === entry.key ? null : entry.key)}
                                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#5BBAA7]"
                                        title="Version history"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => openEdit(entry)}
                                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#5BBAA7]"
                                        title="Edit"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteKey(entry.key)}
                                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Version History */}
                            {expandedHistory === entry.key && (
                                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Version History</h4>
                                        <button onClick={() => setExpandedHistory(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                                            <ChevronUp className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {history.length === 0 ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No version history available</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {history.map((h, i) => (
                                                <div key={i} className="flex items-start justify-between text-xs border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                                                    <div>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">v{h.version}</span>
                                                        <span className="text-gray-400 dark:text-gray-500 ml-2">by {h.updated_by}</span>
                                                        <pre className="mt-1 font-mono text-gray-500 dark:text-gray-400 max-h-12 overflow-hidden">
                                                            {typeof h.value === 'object' ? JSON.stringify(h.value) : String(h.value)}
                                                        </pre>
                                                    </div>
                                                    <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 ml-3">{new Date(h.updated_at).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={closeEditor} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                            {editingEntry ? 'Edit Config' : 'New Config'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!editingEntry && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key</label>
                                        <input
                                            type="text"
                                            value={formKey}
                                            onChange={e => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                                            required
                                            placeholder="app.feature.timeout"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                        />
                                        {formErrors.key && <p className="text-xs text-red-600 mt-1">{formErrors.key}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            required
                                            placeholder="Feature Timeout"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                        />
                                        {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                                    </div>
                                </div>
                            )}

                            {!editingEntry && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value Type</label>
                                    <div className="flex space-x-2">
                                        {VALUE_TYPES.map(vt => (
                                            <button
                                                key={vt}
                                                type="button"
                                                onClick={() => {
                                                    setFormValueType(vt)
                                                    if (vt === 'boolean') setFormValue('true')
                                                    else if (vt === 'number') setFormValue('0')
                                                    else if (vt === 'json') setFormValue('{}')
                                                    else setFormValue('')
                                                }}
                                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                                    formValueType === vt
                                                        ? 'border-[#5BBAA7] bg-[#E8F7F3] text-[#2B4C5C] dark:bg-primary-900/30 dark:text-primary-300'
                                                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                                                }`}
                                            >
                                                {vt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                                {formValueType === 'boolean' ? (
                                    <select
                                        value={formValue}
                                        onChange={e => setFormValue(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    >
                                        <option value="true">true</option>
                                        <option value="false">false</option>
                                    </select>
                                ) : formValueType === 'json' ? (
                                    <textarea
                                        value={formValue}
                                        onChange={e => setFormValue(e.target.value)}
                                        rows={8}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-900 dark:text-gray-100"
                                        placeholder='{"key": "value"}'
                                    />
                                ) : (
                                    <input
                                        type={formValueType === 'number' ? 'number' : 'text'}
                                        value={formValue}
                                        onChange={e => setFormValue(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                        placeholder={formValueType === 'number' ? '0' : 'Enter value...'}
                                    />
                                )}
                                {formErrors.value && <p className="text-xs text-red-600 mt-1">{formErrors.value}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    JSON Schema (optional)
                                </label>
                                <textarea
                                    value={formSchema}
                                    onChange={e => setFormSchema(e.target.value)}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-900 dark:text-gray-100"
                                    placeholder='{"type": "object", "properties": {...}}'
                                />
                                {formErrors.schema && <p className="text-xs text-red-600 mt-1">{formErrors.schema}</p>}
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={closeEditor} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm text-white bg-[#5BBAA7] rounded-lg hover:bg-[#4AA896] disabled:opacity-50">
                                    {createMutation.isPending ? 'Saving...' : editingEntry ? 'Update Config' : 'Create Config'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!deleteKey}
                title="Delete Config"
                message="This will permanently delete this configuration entry and all its version history."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => deleteKey && deleteMutation.mutate(deleteKey)}
                onCancel={() => setDeleteKey(null)}
            />
        </div>
    )
}

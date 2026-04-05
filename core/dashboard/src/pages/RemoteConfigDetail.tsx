import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { remoteConfigApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, Save, Clock, GitCompare, CheckCircle, XCircle, Database } from 'lucide-react'
import clsx from 'clsx'

type HistoryEntry = {
    version: number
    value: unknown
    updated_at: string
    is_current?: boolean
}

function computeDiff(oldText: string, newText: string): Array<{ type: 'same' | 'added' | 'removed'; text: string }> {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = []

    const maxLen = Math.max(oldLines.length, newLines.length)
    for (let i = 0; i < maxLen; i++) {
        const oldLine = oldLines[i]
        const newLine = newLines[i]
        if (oldLine === undefined) {
            result.push({ type: 'added', text: newLine })
        } else if (newLine === undefined) {
            result.push({ type: 'removed', text: oldLine })
        } else if (oldLine === newLine) {
            result.push({ type: 'same', text: oldLine })
        } else {
            result.push({ type: 'removed', text: oldLine })
            result.push({ type: 'added', text: newLine })
        }
    }
    return result
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
}

export default function RemoteConfigDetail() {
    const { configId } = useParams<{ configId: string }>()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const [editedValue, setEditedValue] = useState('')
    const [jsonError, setJsonError] = useState<string | null>(null)
    const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<number | null>(null)
    const [showDiff, setShowDiff] = useState(false)
    const [showSaveConfirm, setShowSaveConfirm] = useState(false)

    const { data: config, isLoading } = useQuery({
        queryKey: ['remote-config-detail', configId],
        queryFn: () => remoteConfigApi.getById(configId!).then(r => r.data),
        enabled: !!configId,
    })

    const { data: history = [] } = useQuery({
        queryKey: ['remote-config-history', configId],
        queryFn: () => remoteConfigApi.historyById(configId!).then(r => r.data),
        enabled: !!configId,
    })

    useEffect(() => {
        if (config) {
            setEditedValue(formatValue(config.value))
        }
    }, [config])

    const updateMutation = useMutation({
        mutationFn: () => {
            let parsedValue: unknown = editedValue
            if (config?.config_type === 'json' || config?.config_type === 'object') {
                parsedValue = JSON.parse(editedValue)
            } else if (config?.config_type === 'number') {
                parsedValue = Number(editedValue)
            } else if (config?.config_type === 'boolean') {
                parsedValue = editedValue === 'true'
            }
            return remoteConfigApi.updateById(configId!, { value: parsedValue })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['remote-config-detail', configId] })
            queryClient.invalidateQueries({ queryKey: ['remote-config-history', configId] })
            queryClient.invalidateQueries({ queryKey: ['remote-config'] })
            toast('success', 'Configuration saved')
            setShowSaveConfirm(false)
        },
        onError: (err: Error) => {
            toast('error', `Save failed: ${err.message}`)
            setShowSaveConfirm(false)
        },
    })

    function handleValueChange(val: string) {
        setEditedValue(val)
        // Validate JSON inline if applicable
        if (config?.config_type === 'json') {
            try {
                JSON.parse(val)
                setJsonError(null)
            } catch (e) {
                setJsonError((e as Error).message)
            }
        } else {
            setJsonError(null)
        }
    }

    function handleSaveClick() {
        if (jsonError) return
        setShowSaveConfirm(true)
    }

    const selectedHistoryEntry: HistoryEntry | null =
        history.find((h: HistoryEntry) => h.version === selectedHistoryVersion) ?? null

    const diffLines = selectedHistoryEntry
        ? computeDiff(formatValue(selectedHistoryEntry.value), editedValue)
        : []

    if (isLoading) {
        return <div className="p-8 dark:text-gray-300">Loading...</div>
    }

    if (!config) {
        return (
            <div className="p-8">
                <p className="text-gray-500 dark:text-gray-400">Config not found.</p>
                <Link to="/remote-config" className="text-primary-600 hover:underline mt-2 inline-block">
                    Back to Remote Config
                </Link>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/remote-config"
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center space-x-3">
                        <Database className="w-6 h-6 text-primary-500" />
                        <div>
                            <div className="flex items-center space-x-3">
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{config.name}</h1>
                                <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-mono">
                                    {config.config_type}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">v{config.version}</span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">{config.key}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {selectedHistoryEntry && (
                        <button
                            onClick={() => setShowDiff(!showDiff)}
                            className={clsx(
                                'flex items-center space-x-2 px-3 py-2 text-sm rounded-lg border transition-colors',
                                showDiff
                                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            )}
                        >
                            <GitCompare className="w-4 h-4" />
                            <span>{showDiff ? 'Hide Diff' : 'Show Diff'}</span>
                        </button>
                    )}
                    <button
                        onClick={handleSaveClick}
                        disabled={!!jsonError || updateMutation.isPending}
                        className="flex items-center space-x-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>{updateMutation.isPending ? 'Saving...' : 'Save'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Editor Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Metadata */}
                    <div className="card">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Environment</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5 capitalize">{config.environment}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Last Modified</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                                    {new Date(config.updated_at).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500 dark:text-gray-400">Owner</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">{config.owner}</p>
                            </div>
                        </div>
                        {config.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                {config.description}
                            </p>
                        )}
                    </div>

                    {/* Value Editor */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Value</h2>
                            {jsonError ? (
                                <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>{jsonError}</span>
                                </div>
                            ) : editedValue !== formatValue(config.value) ? (
                                <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 text-xs">
                                    <span>Unsaved changes</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-1 text-green-600 dark:text-green-400 text-xs">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Saved</span>
                                </div>
                            )}
                        </div>
                        <textarea
                            value={editedValue}
                            onChange={e => handleValueChange(e.target.value)}
                            rows={config.config_type === 'json' ? 16 : 4}
                            className={clsx(
                                'w-full px-3 py-3 border rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors',
                                jsonError
                                    ? 'border-red-400 dark:border-red-600'
                                    : 'border-gray-300 dark:border-gray-600'
                            )}
                            spellCheck={false}
                        />
                        {config.config_type === 'json' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                JSON validation runs inline. Errors are shown above the editor.
                            </p>
                        )}
                    </div>

                    {/* Diff View */}
                    {showDiff && selectedHistoryEntry && (
                        <div className="card">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                                Diff: v{selectedHistoryEntry.version} vs current
                            </h2>
                            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 font-mono text-xs">
                                {diffLines.map((line, i) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            'px-3 py-0.5',
                                            line.type === 'added' && 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300',
                                            line.type === 'removed' && 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300',
                                            line.type === 'same' && 'text-gray-600 dark:text-gray-400'
                                        )}
                                    >
                                        <span className="mr-2 text-gray-400 select-none">
                                            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                                        </span>
                                        {line.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Version History Panel */}
                <div className="space-y-4">
                    <div className="card">
                        <div className="flex items-center space-x-2 mb-4">
                            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Version History</h2>
                        </div>
                        {history.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No history available yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {history.map((entry: HistoryEntry) => (
                                    <button
                                        key={entry.version}
                                        onClick={() => {
                                            setSelectedHistoryVersion(
                                                selectedHistoryVersion === entry.version ? null : entry.version
                                            )
                                            setShowDiff(true)
                                        }}
                                        className={clsx(
                                            'w-full text-left px-3 py-2.5 rounded-lg border transition-colors text-sm',
                                            selectedHistoryVersion === entry.version
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 dark:border-primary-500'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                v{entry.version}
                                                {entry.is_current && (
                                                    <span className="ml-2 text-xs text-primary-500 font-normal">current</span>
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {new Date(entry.updated_at).toLocaleString()}
                                        </p>
                                        <div className="mt-1.5 bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 max-h-12 overflow-hidden">
                                            <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                                                {formatValue(entry.value)}
                                            </pre>
                                        </div>
                                        {selectedHistoryVersion === entry.version && (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    setEditedValue(formatValue(entry.value))
                                                    if (config?.config_type === 'json') {
                                                        try {
                                                            JSON.parse(formatValue(entry.value))
                                                            setJsonError(null)
                                                        } catch (err) {
                                                            setJsonError((err as Error).message)
                                                        }
                                                    }
                                                }}
                                                className="mt-2 text-xs text-primary-500 hover:text-primary-600 font-medium"
                                            >
                                                Restore this version
                                            </button>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Default Value */}
                    <div className="card">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Default Value</h2>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 max-h-32 overflow-auto">
                            <pre className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                {formatValue(config.default_value)}
                            </pre>
                        </div>
                    </div>

                    {/* Server-only indicator */}
                    {config.is_server_only && (
                        <div className="card border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10">
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                Server-only config — not sent to client SDKs
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Confirmation Modal */}
            {showSaveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowSaveConfirm(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Confirm Save</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            This will update <strong>{config.key}</strong> in <strong>{config.environment}</strong> and increment the version to v{config.version + 1}.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowSaveConfirm(false)}
                                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => updateMutation.mutate()}
                                disabled={updateMutation.isPending}
                                className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { codeRefsApi, type CodeReference } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { Code2, Search, Upload, AlertTriangle, FileCode, Plus, Trash2, ExternalLink } from 'lucide-react'

export default function CodeRefs() {
    const queryClient = useQueryClient()
    const { addToast } = useToast()
    const [tab, setTab] = useState<'search' | 'upload' | 'unused'>('search')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchFlagKey, setSearchFlagKey] = useState('')
    const [searchRepo, setSearchRepo] = useState('')

    // Upload form
    const [uploadRefs, setUploadRefs] = useState<Array<{
        flag_key: string; file_path: string; line_number: number; repository: string; branch: string
    }>>([
        { flag_key: '', file_path: '', line_number: 1, repository: '', branch: 'main' },
    ])

    const { data: refsData, isLoading: refsLoading } = useQuery({
        queryKey: ['code-refs', searchFlagKey, searchRepo],
        queryFn: () => codeRefsApi.list({ flag_key: searchFlagKey || undefined, repository: searchRepo || undefined, limit: 200 }),
        enabled: tab === 'search',
    })

    const { data: searchData, isLoading: searchLoading } = useQuery({
        queryKey: ['code-refs-search', searchQuery],
        queryFn: () => codeRefsApi.search(searchQuery),
        enabled: tab === 'search' && searchQuery.length >= 2,
    })

    const { data: unusedData, isLoading: unusedLoading } = useQuery({
        queryKey: ['code-refs-unused'],
        queryFn: () => codeRefsApi.unusedFlags(),
        enabled: tab === 'unused',
    })

    const { data: summaryData } = useQuery({
        queryKey: ['code-refs-summary'],
        queryFn: () => codeRefsApi.summary(),
    })

    const uploadMutation = useMutation({
        mutationFn: () => codeRefsApi.upload({
            references: uploadRefs.filter(r => r.flag_key && r.file_path),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['code-refs'] })
            queryClient.invalidateQueries({ queryKey: ['code-refs-summary'] })
            addToast('Code references uploaded', 'success')
            setUploadRefs([{ flag_key: '', file_path: '', line_number: 1, repository: '', branch: 'main' }])
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const refsRaw = searchQuery.length >= 2
        ? (searchData?.data || [])
        : (refsData?.data || [])
    const refs: CodeReference[] = Array.isArray(refsRaw) ? refsRaw : (refsRaw as any)?.items || []
    const unusedFlags: string[] = unusedData?.data || []
    const summary: Record<string, number> = summaryData?.data || {}

    function addUploadRow() {
        setUploadRefs([...uploadRefs, { flag_key: '', file_path: '', line_number: 1, repository: '', branch: 'main' }])
    }

    function removeUploadRow(index: number) {
        setUploadRefs(uploadRefs.filter((_, i) => i !== index))
    }

    function updateUploadRow(index: number, field: string, value: string | number) {
        const updated = [...uploadRefs]
        updated[index] = { ...updated[index], [field]: value }
        setUploadRefs(updated)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <Code2 className="w-8 h-8 text-[#5BBAA7]" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Code References</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Track where feature flags are used in your codebase</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {Object.keys(summary).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {Object.entries(summary).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{key.replace(/_/g, ' ')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
                {([
                    { key: 'search' as const, label: 'Search References', icon: Search },
                    { key: 'upload' as const, label: 'Upload References', icon: Upload },
                    { key: 'unused' as const, label: 'Unused Flags', icon: AlertTriangle },
                ]).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            tab === t.key
                                ? 'bg-white dark:bg-gray-700 text-[#2B4C5C] dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <t.icon className="w-4 h-4 mr-2" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Search Tab */}
            {tab === 'search' && (
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by flag key, file path..."
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                            />
                        </div>
                        <input
                            type="text"
                            value={searchFlagKey}
                            onChange={e => setSearchFlagKey(e.target.value)}
                            placeholder="Filter by flag key"
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
                        />
                        <input
                            type="text"
                            value={searchRepo}
                            onChange={e => setSearchRepo(e.target.value)}
                            placeholder="Filter by repository"
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
                        />
                    </div>

                    {(refsLoading || searchLoading) ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading references...</div>
                    ) : refs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileCode className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No code references found</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload references or run the code reference scanner in CI</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Flag Key</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Repository</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Branch</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Seen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {refs.map((ref, i) => (
                                        <tr key={ref.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50">
                                            <td className="px-4 py-3">
                                                <code className="text-sm text-[#5BBAA7]">{ref.flag_key}</code>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center space-x-1">
                                                    <FileCode className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{ref.file_path}</span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">:{ref.line_number}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ref.repository}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ref.branch}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{new Date(ref.last_seen_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Upload Tab */}
            {tab === 'upload' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Manually upload code references. For automated scanning, use the Phase Flag code reference scanner in your CI/CD pipeline.
                    </p>
                    <form onSubmit={e => { e.preventDefault(); uploadMutation.mutate() }}>
                        <div className="space-y-3 mb-4">
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-1">
                                <div className="col-span-2">Flag Key</div>
                                <div className="col-span-3">File Path</div>
                                <div className="col-span-1">Line</div>
                                <div className="col-span-3">Repository</div>
                                <div className="col-span-2">Branch</div>
                                <div className="col-span-1"></div>
                            </div>
                            {uploadRefs.map((ref, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2">
                                    <input
                                        type="text"
                                        value={ref.flag_key}
                                        onChange={e => updateUploadRow(i, 'flag_key', e.target.value)}
                                        placeholder="my-flag"
                                        className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <input
                                        type="text"
                                        value={ref.file_path}
                                        onChange={e => updateUploadRow(i, 'file_path', e.target.value)}
                                        placeholder="src/features/flag.ts"
                                        className="col-span-3 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        value={ref.line_number}
                                        onChange={e => updateUploadRow(i, 'line_number', Number(e.target.value))}
                                        className="col-span-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <input
                                        type="text"
                                        value={ref.repository}
                                        onChange={e => updateUploadRow(i, 'repository', e.target.value)}
                                        placeholder="org/repo"
                                        className="col-span-3 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <input
                                        type="text"
                                        value={ref.branch}
                                        onChange={e => updateUploadRow(i, 'branch', e.target.value)}
                                        placeholder="main"
                                        className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    />
                                    <div className="col-span-1 flex items-center">
                                        {uploadRefs.length > 1 && (
                                            <button type="button" onClick={() => removeUploadRow(i)} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={addUploadRow} className="text-sm text-[#5BBAA7] hover:text-[#4AA896] flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Add Row
                            </button>
                            <button
                                type="submit"
                                disabled={uploadMutation.isPending || uploadRefs.every(r => !r.flag_key || !r.file_path)}
                                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-[#5BBAA7] rounded-lg hover:bg-[#4AA896] disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                {uploadMutation.isPending ? 'Uploading...' : 'Upload References'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Unused Flags Tab */}
            {tab === 'unused' && (
                <div>
                    {unusedLoading ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading unused flags...</div>
                    ) : unusedFlags.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertTriangle className="w-12 h-12 mx-auto text-green-300 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No unused flags detected</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All active flags have code references</p>
                        </div>
                    ) : (
                        <div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
                                <div className="flex items-start space-x-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                            {unusedFlags.length} flag{unusedFlags.length !== 1 ? 's' : ''} with no code references found
                                        </p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                            These flags may be candidates for cleanup. Verify they are not used before archiving or deleting.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                                {unusedFlags.map(flagKey => (
                                    <div key={flagKey} className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center space-x-3">
                                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                            <code className="text-sm text-[#5BBAA7] font-medium">{flagKey}</code>
                                        </div>
                                        <a
                                            href={`/flags/${flagKey}`}
                                            className="text-sm text-[#5BBAA7] hover:text-[#4AA896] flex items-center"
                                        >
                                            View Flag <ExternalLink className="w-3 h-3 ml-1" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

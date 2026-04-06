import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { governanceApi, type ChangeRequest, type FreezeWindow, type ServiceAccount } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { Shield, Plus, Check, X, Snowflake, Key, Trash2, AlertTriangle, Clock, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import Skeleton from '@/components/Skeleton'

type Tab = 'changes' | 'freezes' | 'accounts'

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function Governance() {
    const queryClient = useQueryClient()
    const { addToast } = useToast()
    const [tab, setTab] = useState<Tab>('changes')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [showCreateChange, setShowCreateChange] = useState(false)
    const [showCreateAccount, setShowCreateAccount] = useState(false)
    const [expandedChange, setExpandedChange] = useState<string | null>(null)
    const [actionDialog, setActionDialog] = useState<{ type: 'approve' | 'reject'; id: string } | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [approveComment, setApproveComment] = useState('')
    const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
    const [newApiKey, setNewApiKey] = useState<string | null>(null)

    // Change request form
    const [crFlagKey, setCrFlagKey] = useState('')
    const [crEnvironment, setCrEnvironment] = useState('production')
    const [crChangeType, setCrChangeType] = useState('toggle')
    const [crDescription, setCrDescription] = useState('')
    const [crReviewers, setCrReviewers] = useState('')

    // Service account form
    const [saName, setSaName] = useState('')
    const [saScopes, setSaScopes] = useState<string[]>(['read:flags'])

    const AVAILABLE_SCOPES = [
        'read:flags', 'write:flags', 'read:segments', 'write:segments',
        'read:config', 'write:config', 'admin',
    ]

    const { data: changesData, isLoading: changesLoading } = useQuery({
        queryKey: ['governance', 'changes', statusFilter],
        queryFn: () => governanceApi.changeRequests({ status: statusFilter || undefined, limit: 100 }),
        enabled: tab === 'changes',
    })

    const { data: freezeData, isLoading: freezesLoading } = useQuery({
        queryKey: ['governance', 'freezes'],
        queryFn: () => governanceApi.freezeWindows(),
        enabled: tab === 'freezes',
    })

    const { data: accountsData, isLoading: accountsLoading } = useQuery({
        queryKey: ['governance', 'accounts'],
        queryFn: () => governanceApi.serviceAccounts({ limit: 100 }),
        enabled: tab === 'accounts',
    })

    const createChangeMutation = useMutation({
        mutationFn: () => governanceApi.createChangeRequest({
            flag_key: crFlagKey,
            environment: crEnvironment,
            change_type: crChangeType,
            change_description: crDescription,
            required_reviewers: crReviewers ? crReviewers.split(',').map(r => r.trim()) : undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['governance', 'changes'] })
            addToast('Change request created', 'success')
            setShowCreateChange(false)
            setCrFlagKey('')
            setCrDescription('')
            setCrReviewers('')
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const approveMutation = useMutation({
        mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
            governanceApi.approveChange(id, comment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['governance', 'changes'] })
            addToast('Change request approved', 'success')
            setActionDialog(null)
            setApproveComment('')
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            governanceApi.rejectChange(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['governance', 'changes'] })
            addToast('Change request rejected', 'success')
            setActionDialog(null)
            setRejectReason('')
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const createAccountMutation = useMutation({
        mutationFn: () => governanceApi.createServiceAccount({ name: saName, scopes: saScopes }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['governance', 'accounts'] })
            addToast('Service account created', 'success')
            setNewApiKey((res.data as ServiceAccount & { api_key: string }).api_key)
            setShowCreateAccount(false)
            setSaName('')
            setSaScopes(['read:flags'])
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const deleteAccountMutation = useMutation({
        mutationFn: (id: string) => governanceApi.deleteServiceAccount(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['governance', 'accounts'] })
            addToast('Service account deleted', 'success')
            setDeleteAccountId(null)
        },
        onError: (err: Error) => addToast(err.message, 'error'),
    })

    const changesRaw = changesData?.data || []
    const changes: ChangeRequest[] = Array.isArray(changesRaw) ? changesRaw : (changesRaw as any)?.items || []
    const freezes: FreezeWindow[] = freezeData?.data || []
    const accountsRaw = accountsData?.data || []
    const accounts: ServiceAccount[] = Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw as any)?.items || []

    function toggleScope(scope: string) {
        setSaScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope])
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <Shield className="w-8 h-8 text-primary-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Governance</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Change requests, freeze windows, and service accounts</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
                {([
                    { key: 'changes' as Tab, label: 'Change Requests', icon: Clock, tooltip: 'Pending changes that require approval before taking effect' },
                    { key: 'freezes' as Tab, label: 'Freeze Windows', icon: Snowflake, tooltip: 'Time periods during which flag changes are blocked' },
                    { key: 'accounts' as Tab, label: 'Service Accounts', icon: Key, tooltip: 'API keys for automated systems to manage flags' },
                ]).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        title={t.tooltip}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            tab === t.key
                                ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <t.icon className="w-4 h-4 mr-2" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Change Requests Tab */}
            {tab === 'changes' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-gray-100"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <button
                            onClick={() => setShowCreateChange(true)}
                            title="Create a new change request that requires approval before taking effect"
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4 mr-2" /> New Change Request
                        </button>
                    </div>

                    {changesLoading ? (
                        <Skeleton variant="card" count={3} />
                    ) : changes.length === 0 ? (
                        <div className="text-center py-12">
                            <Shield className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No change requests found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {changes.map(cr => (
                                <div key={cr.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                        onClick={() => setExpandedChange(expandedChange === cr.id ? null : cr.id)}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cr.status] || ''}`}>
                                                {cr.status}
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {cr.change_type} — <code className="text-primary-500">{cr.flag_key}</code>
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {cr.environment} &middot; by {cr.requested_by} &middot; {new Date(cr.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {cr.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setActionDialog({ type: 'approve', id: cr.id }) }}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                        title="Approve"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setActionDialog({ type: 'reject', id: cr.id }) }}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                        title="Reject"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {expandedChange === cr.id ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                                        </div>
                                    </div>
                                    {expandedChange === cr.id && (
                                        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{cr.change_description}</p>
                                            {cr.required_reviewers.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Required Reviewers</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {cr.required_reviewers.map(r => (
                                                            <span key={r} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs rounded">{r}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {cr.approvals.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="text-xs font-medium text-green-600 mb-1">Approvals ({cr.approvals.length})</p>
                                                    {cr.approvals.map((a, i) => (
                                                        <p key={i} className="text-xs text-gray-600 dark:text-gray-400">
                                                            {a.user_id} {a.comment && `— "${a.comment}"`} ({new Date(a.timestamp).toLocaleString()})
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                            {cr.rejections.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-red-600 mb-1">Rejections ({cr.rejections.length})</p>
                                                    {cr.rejections.map((r, i) => (
                                                        <p key={i} className="text-xs text-gray-600 dark:text-gray-400">
                                                            {r.user_id} — "{r.reason}" ({new Date(r.timestamp).toLocaleString()})
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Freeze Windows Tab */}
            {tab === 'freezes' && (
                <div>
                    {freezesLoading ? (
                        <Skeleton variant="row" count={3} />
                    ) : freezes.length === 0 ? (
                        <div className="text-center py-12">
                            <Snowflake className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No freeze windows recorded</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Freeze windows are created from the Environments page</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Environment</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Frozen By</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Frozen At</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {freezes.map(f => (
                                        <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{f.environment}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{f.reason}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{f.frozen_by}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(f.frozen_at).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                {f.unfrozen_at ? (
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                        Unfrozen {new Date(f.unfrozen_at).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Service Accounts Tab */}
            {tab === 'accounts' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowCreateAccount(true)}
                            title="Create a new service account API key for automated systems to manage flags"
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                        >
                            <Plus className="w-4 h-4 mr-2" /> New Service Account
                        </button>
                    </div>

                    {newApiKey && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Save this API key now — it will not be shown again</p>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <code className="px-3 py-1.5 bg-white dark:bg-gray-800 border rounded text-sm font-mono text-gray-900 dark:text-gray-100">{newApiKey}</code>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(newApiKey); addToast('API key copied', 'success') }}
                                            className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                                        >
                                            <Copy className="w-4 h-4 text-yellow-700" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setNewApiKey(null)}
                                        className="text-xs text-yellow-700 hover:text-yellow-900 mt-2 underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {accountsLoading ? (
                        <Skeleton variant="row" count={3} />
                    ) : accounts.length === 0 ? (
                        <div className="text-center py-12">
                            <Key className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No service accounts created</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full">
                                <thead className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key Prefix</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scopes</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Used</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {accounts.map(sa => (
                                        <tr key={sa.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{sa.name}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{sa.key_prefix}...</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {sa.scopes.map(s => (
                                                        <span key={s} className="px-1.5 py-0.5 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded">
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                {sa.last_used_at ? new Date(sa.last_used_at).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(sa.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setDeleteAccountId(sa.id)}
                                                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Create Change Request Modal */}
            {showCreateChange && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateChange(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Change Request</h3>
                        <form onSubmit={e => { e.preventDefault(); createChangeMutation.mutate() }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flag Key</label>
                                <input
                                    type="text"
                                    value={crFlagKey}
                                    onChange={e => setCrFlagKey(e.target.value)}
                                    required
                                    placeholder="my-feature-flag"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
                                    <select
                                        value={crEnvironment}
                                        onChange={e => setCrEnvironment(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    >
                                        <option value="development">Development</option>
                                        <option value="staging">Staging</option>
                                        <option value="production">Production</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Change Type</label>
                                    <select
                                        value={crChangeType}
                                        onChange={e => setCrChangeType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                    >
                                        <option value="toggle">Toggle</option>
                                        <option value="targeting">Targeting Update</option>
                                        <option value="rollout">Rollout Change</option>
                                        <option value="archive">Archive</option>
                                        <option value="delete">Delete</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    value={crDescription}
                                    onChange={e => setCrDescription(e.target.value)}
                                    required
                                    rows={3}
                                    placeholder="Describe the proposed change..."
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Required Reviewers (comma-separated)</label>
                                <input
                                    type="text"
                                    value={crReviewers}
                                    onChange={e => setCrReviewers(e.target.value)}
                                    placeholder="user1, user2"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-2">
                                <button type="button" onClick={() => setShowCreateChange(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createChangeMutation.isPending} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                                    {createChangeMutation.isPending ? 'Creating...' : 'Create Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Service Account Modal */}
            {showCreateAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateAccount(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Service Account</h3>
                        <form onSubmit={e => { e.preventDefault(); createAccountMutation.mutate() }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={saName}
                                    onChange={e => setSaName(e.target.value)}
                                    required
                                    placeholder="CI/CD Pipeline"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scopes</label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_SCOPES.map(scope => (
                                        <button
                                            key={scope}
                                            type="button"
                                            onClick={() => toggleScope(scope)}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                                saScopes.includes(scope)
                                                    ? 'bg-primary-600 text-white border-primary-600'
                                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary-500'
                                            }`}
                                        >
                                            {scope}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-2">
                                <button type="button" onClick={() => setShowCreateAccount(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createAccountMutation.isPending || !saName.trim()} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                                    {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Approve Dialog */}
            {actionDialog?.type === 'approve' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => { setActionDialog(null); setApproveComment('') }} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Approve Change Request</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comment (optional)</label>
                            <textarea
                                value={approveComment}
                                onChange={e => setApproveComment(e.target.value)}
                                rows={2}
                                placeholder="LGTM"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => { setActionDialog(null); setApproveComment('') }} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50">
                                Cancel
                            </button>
                            <button
                                onClick={() => approveMutation.mutate({ id: actionDialog.id, comment: approveComment || undefined })}
                                disabled={approveMutation.isPending}
                                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {approveMutation.isPending ? 'Approving...' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Dialog */}
            {actionDialog?.type === 'reject' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => { setActionDialog(null); setRejectReason('') }} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Reject Change Request</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={2}
                                required
                                placeholder="Reason for rejection..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => { setActionDialog(null); setRejectReason('') }} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700/50">
                                Cancel
                            </button>
                            <button
                                onClick={() => rejectMutation.mutate({ id: actionDialog.id, reason: rejectReason })}
                                disabled={rejectMutation.isPending || !rejectReason.trim()}
                                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Service Account Dialog */}
            <ConfirmDialog
                isOpen={!!deleteAccountId}
                title="Delete Service Account"
                message="This will permanently revoke the API key associated with this service account. Any services using this key will stop working."
                confirmLabel="Delete Account"
                variant="danger"
                onConfirm={() => deleteAccountId && deleteAccountMutation.mutate(deleteAccountId)}
                onCancel={() => setDeleteAccountId(null)}
            />
        </div>
    )
}

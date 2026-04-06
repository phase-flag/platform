import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalsApi, type ApprovalRequest } from '@/lib/api'
import { Shield, Check, X, Clock } from 'lucide-react'
import clsx from 'clsx'
import Skeleton from '@/components/Skeleton'

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function Approvals() {
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [rejectId, setRejectId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')

    const { data: approvalsRaw, isLoading } = useQuery({
        queryKey: ['approvals', statusFilter],
        queryFn: () => approvalsApi.list(statusFilter ? { status: statusFilter } : undefined).then(r => r.data),
    })
    const approvals: ApprovalRequest[] = Array.isArray(approvalsRaw) ? approvalsRaw : (approvalsRaw as any)?.items || []

    const approveMutation = useMutation({
        mutationFn: (id: string) => approvalsApi.approve(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
    })

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => approvalsApi.reject(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['approvals'] })
            setRejectId(null)
            setRejectReason('')
        },
    })

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Approval Workflows</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and approve flag change requests for protected environments</p>
            </div>

            <div className="flex gap-2 mb-6">
                {['', 'pending', 'approved', 'rejected'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={clsx(
                            'px-3 py-1.5 text-sm rounded-lg transition-colors',
                            statusFilter === s
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                        )}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <Skeleton variant="card" count={3} />
            ) : approvals.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <Shield className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No approval requests</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Approval requests appear here when flag changes target protected environments.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {approvals.map((req: ApprovalRequest) => (
                        <div key={req.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {req.change_type} &mdash; {req.flag_key}
                                        </h3>
                                        <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', STATUS_STYLES[req.status])}>
                                            {req.status}
                                        </span>
                                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                                            {req.environment}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{req.change_description}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span>By: {req.requested_by}</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(req.created_at).toLocaleString()}
                                        </span>
                                        <span>Approvals: {req.approvals.length}/{req.required_approvals}</span>
                                    </div>
                                </div>
                                {req.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => approveMutation.mutate(req.id)}
                                            disabled={approveMutation.isPending}
                                            className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            <Check className="w-3 h-3 mr-1" /> Approve
                                        </button>
                                        <button
                                            onClick={() => setRejectId(req.id)}
                                            className="flex items-center px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                        >
                                            <X className="w-3 h-3 mr-1" /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reject modal */}
            {rejectId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setRejectId(null)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Reject Request</h3>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setRejectId(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg">
                                Cancel
                            </button>
                            <button
                                onClick={() => rejectMutation.mutate({ id: rejectId, reason: rejectReason })}
                                disabled={!rejectReason || rejectMutation.isPending}
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

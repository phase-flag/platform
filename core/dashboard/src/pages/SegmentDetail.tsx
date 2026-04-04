import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { segmentsApi } from '@/lib/api'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import SegmentModal from '@/components/SegmentModal'
import { useToast } from '@/contexts/ToastContext'

export default function SegmentDetail() {
    const { segmentKey } = useParams<{ segmentKey: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const { data: segment, isLoading } = useQuery({
        queryKey: ['segment', segmentKey],
        queryFn: () => segmentsApi.get(segmentKey!).then(res => res.data),
        enabled: !!segmentKey,
    })

    const deleteMutation = useMutation({
        mutationFn: () => segmentsApi.delete(segmentKey!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['segments'] })
            toast('success', 'Segment deleted')
            navigate('/segments')
        },
        onError: (err) => toast('error', `Delete failed: ${(err as Error).message}`),
    })

    if (isLoading) {
        return <div className="p-8">Loading...</div>
    }

    if (!segment) {
        return <div className="p-8">Segment not found</div>
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <Link to="/segments" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Segments
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{segment.name}</h1>
                        {segment.description && (
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{segment.description}</p>
                        )}
                    </div>
                    <div className="flex items-center space-x-3">
                        <button onClick={() => setShowEditModal(true)} className="btn btn-secondary flex items-center space-x-2">
                            <Edit className="w-5 h-5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleteMutation.isPending}
                            className="btn btn-danger flex items-center space-x-2 disabled:opacity-50"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="card">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Key</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-mono">{segment.key}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Created By</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{segment.created_by || 'system'}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Created</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(segment.created_at).toLocaleDateString()}
                    </p>
                </div>
            </div>

            {/* Conditions */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Conditions ({segment.conditions.length})
                </h2>
                {segment.conditions.length > 0 ? (
                    <div className="space-y-3">
                        {segment.conditions.map((condition, idx) => (
                            <div key={idx} className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{condition.attribute}</span>
                                    {' '}
                                    <span className="text-primary-600">{condition.operator}</span>
                                    {' '}
                                    <span className="text-gray-900 dark:text-gray-100">
                                        {JSON.stringify(condition.value ?? condition.values)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No conditions configured</p>
                )}
            </div>

            <SegmentModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                segment={segment}
            />

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Segment</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to delete <strong>{segment.name}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    deleteMutation.mutate()
                                }}
                                disabled={deleteMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
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

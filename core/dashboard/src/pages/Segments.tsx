import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { segmentsApi } from '@/lib/api'
import { useProject } from '@/contexts/ProjectContext'
import { Users, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import SegmentModal from '@/components/SegmentModal'
import EmptyState from '@/components/EmptyState'
import Skeleton from '@/components/Skeleton'

export default function Segments() {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const { project } = useProject()

    const { data: paginatedData, isLoading } = useQuery({
        queryKey: ['segments', project?.key],
        queryFn: () => segmentsApi.list({ project_key: project?.key ?? undefined }).then(res => res.data),
    })

    const segments = paginatedData?.items

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Segments</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage audience segments for targeting rules</p>
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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Segments</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage audience segments for targeting rules</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} title="Create a reusable audience segment" className="btn btn-primary flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Create Segment</span>
                </button>
            </div>

            {/* Segments List */}
            <div className="space-y-4">
                {segments?.map((segment) => (
                    <Link
                        key={segment.id}
                        to={`/segments/${segment.key}`}
                        title="Click to view and edit segment conditions"
                        className="card hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-150 block"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                    <Users className="w-5 h-5 text-primary-600" />
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{segment.name}</h3>
                                </div>
                                {segment.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{segment.description}</p>
                                )}
                                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{segment.key}</span>
                                    <span className="badge badge-info" title="Rules that define which users belong to this segment">
                                        {segment.conditions.length} condition{segment.conditions.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Created {new Date(segment.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {segments?.length === 0 && (
                <EmptyState
                    icon={Users}
                    title="No segments yet"
                    description="Create your first audience segment for targeting"
                    actionLabel="Create Segment"
                    onAction={() => setShowCreateModal(true)}
                />
            )}

            <SegmentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </div>
    )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { segmentsApi } from '@/lib/api'
import { Users, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import SegmentModal from '@/components/SegmentModal'

export default function Segments() {
    const [showCreateModal, setShowCreateModal] = useState(false)

    const { data: paginatedData, isLoading } = useQuery({
        queryKey: ['segments'],
        queryFn: () => segmentsApi.list().then(res => res.data),
    })

    const segments = paginatedData?.items

    if (isLoading) {
        return <div className="p-8">Loading...</div>
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Segments</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage audience segments for targeting rules</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex items-center space-x-2">
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
                        className="card hover:shadow-md transition-shadow duration-200 block"
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
                                    <span className="badge badge-info">
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
                <div className="card text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No segments yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first audience segment for targeting</p>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">Create Segment</button>
                </div>
            )}

            <SegmentModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        </div>
    )
}

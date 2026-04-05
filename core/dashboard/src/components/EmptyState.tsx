import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div className="card text-center py-12">
            <div className="flex justify-center mb-4">
                <Icon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
            {actionLabel && onAction && (
                <button onClick={onAction} className="btn btn-primary">
                    {actionLabel}
                </button>
            )}
        </div>
    )
}

import clsx from 'clsx'

interface SkeletonProps {
    variant: 'card' | 'row' | 'text' | 'stat'
    count?: number
    className?: string
}

function StatSkeleton() {
    return (
        <div className="card skeleton-shimmer">
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                    <div className="h-8 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
        </div>
    )
}

function CardSkeleton() {
    return (
        <div className="card skeleton-shimmer">
            <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-3">
                    <div className="h-5 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
            </div>
        </div>
    )
}

function RowSkeleton() {
    return (
        <div className="skeleton-shimmer flex items-center space-x-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
    )
}

function TextSkeleton() {
    return (
        <div className="skeleton-shimmer space-y-2">
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-4/6 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
    )
}

export default function Skeleton({ variant, count = 1, className }: SkeletonProps) {
    const items = Array.from({ length: count }, (_, i) => i)

    if (variant === 'stat') {
        return (
            <div className={clsx('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4', className)}>
                {items.map(i => <StatSkeleton key={i} />)}
            </div>
        )
    }

    if (variant === 'card') {
        return (
            <div className={clsx('space-y-4', className)}>
                {items.map(i => <CardSkeleton key={i} />)}
            </div>
        )
    }

    if (variant === 'row') {
        return (
            <div className={clsx('card divide-y divide-gray-100 dark:divide-gray-700 p-0 overflow-hidden', className)}>
                {items.map(i => <RowSkeleton key={i} />)}
            </div>
        )
    }

    // text
    return (
        <div className={clsx('space-y-4', className)}>
            {items.map(i => <TextSkeleton key={i} />)}
        </div>
    )
}

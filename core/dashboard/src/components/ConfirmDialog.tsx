import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    variant?: 'danger' | 'warning'
    onConfirm: () => void
    onCancel: () => void
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    variant = 'danger',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
            <div className="p-6">
                <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        variant === 'danger' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-yellow-100 dark:bg-yellow-900/50'
                    }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                            variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                        }`} />
                    </div>
                    <div className="flex-1">
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onCancel} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`btn ${
                            variant === 'danger'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

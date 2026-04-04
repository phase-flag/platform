import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { X, CheckCircle, XCircle, Info } from 'lucide-react'
import clsx from 'clsx'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: number
    type: ToastType
    message: string
}

interface ToastContextValue {
    toast: (type: ToastType, message: string) => void
    addToast: (message: string, type: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({
    toast: () => {},
    addToast: () => {},
})

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((type: ToastType, message: string) => {
        const id = nextId++
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }, [])

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const icons = {
        success: CheckCircle,
        error: XCircle,
        info: Info,
    }

    return (
        <ToastContext.Provider value={{ toast: addToast, addToast: (message: string, type: ToastType) => addToast(type, message) }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] space-y-2">
                {toasts.map(t => {
                    const Icon = icons[t.type]
                    return (
                        <div
                            key={t.id}
                            className={clsx(
                                'flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md animate-in slide-in-from-right',
                                t.type === 'success' && 'bg-success-50 border border-success-200 text-success-800 dark:bg-success-900/50 dark:border-success-700 dark:text-success-200',
                                t.type === 'error' && 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-200',
                                t.type === 'info' && 'bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200',
                            )}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <p className="flex-1 text-sm">{t.message}</p>
                            <button onClick={() => removeToast(t.id)} className="flex-shrink-0 p-0.5 hover:opacity-70">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    return useContext(ToastContext)
}

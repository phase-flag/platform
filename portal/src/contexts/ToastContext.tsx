import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  link?: string;
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, link?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, link?: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message, link }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for toasts dispatched by the API client (outside React tree)
  useEffect(() => {
    function handleApiToast(e: Event) {
      const { type, message, link } = (e as CustomEvent).detail as {
        type: ToastType;
        message: string;
        link?: string;
      };
      addToast(type, message, link);
    }
    window.addEventListener('phaseflag:toast', handleApiToast);
    return () => window.removeEventListener('phaseflag:toast', handleApiToast);
  }, [addToast]);

  const colorMap: Record<ToastType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[300px] max-w-sm text-sm ${colorMap[t.type]}`}
          >
            <p className="flex-1">
              {t.message}
              {t.link && (
                <a href={t.link} className="ml-1 underline font-semibold">
                  View billing
                </a>
              )}
            </p>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

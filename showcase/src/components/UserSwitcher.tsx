import { DEMO_USERS } from '@/lib/mock-data'
import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function UserSwitcher() {
    const { currentUser, setCurrentUser } = usePhaseFlagContext()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const planColors: Record<string, string> = {
        free: 'bg-gray-500',
        pro: 'bg-blue-500',
        enterprise: 'bg-purple-500',
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-surface-light hover:bg-surface-lighter transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-pf-primary/20 text-pf-primary flex items-center justify-center text-xs font-bold">
                    {currentUser.avatar}
                </div>
                <div className="text-left">
                    <p className="text-sm font-medium text-gray-200">{currentUser.name}</p>
                    <p className="text-xs text-gray-500">{currentUser.plan} plan</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface-light border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-700">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Switch User Persona</p>
                    </div>
                    {DEMO_USERS.map(user => (
                        <button
                            key={user.id}
                            onClick={() => { setCurrentUser(user); setOpen(false) }}
                            className={`w-full flex items-center space-x-3 px-3 py-3 hover:bg-surface-lighter transition-colors ${
                                currentUser.id === user.id ? 'bg-pf-primary/10 border-l-2 border-pf-primary' : ''
                            }`}
                        >
                            <div className="w-9 h-9 rounded-full bg-pf-navy text-pf-primary flex items-center justify-center text-xs font-bold">
                                {user.avatar}
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-gray-200">{user.name}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs text-white ${planColors[user.plan] || 'bg-gray-600'}`}>
                                {user.plan}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

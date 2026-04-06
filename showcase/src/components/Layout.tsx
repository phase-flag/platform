import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Sparkles, Settings, Zap, Bell, Info } from 'lucide-react'
import UserSwitcher from './UserSwitcher'
import FlagInspector from './FlagInspector'
import Tooltip from './Tooltip'
import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import clsx from 'clsx'

const NAV_ITEMS = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Showcase', href: '/showcase', icon: Sparkles },
    { name: 'Settings', href: '/settings', icon: Settings },
]

function InfoIcon({ tip }: { tip: string }) {
    return (
        <Tooltip text={tip}>
            <Info className="w-3 h-3 text-gray-600 hover:text-indigo-400 cursor-help transition-colors" />
        </Tooltip>
    )
}

export default function Layout() {
    const location = useLocation()
    const { sseConnected, environment, setEnvironment, flagValues } = usePhaseFlagContext()

    const showNotifications = flagValues['nexus-notifications'] === true

    const envColors: Record<string, string> = {
        development: 'bg-green-500',
        staging: 'bg-yellow-500',
        production: 'bg-red-500',
    }

    return (
        <div className="min-h-screen flex bg-[#0B0F1A]">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-gray-800 flex flex-col">
                {/* Logo */}
                <div className="px-5 py-5 border-b border-gray-800">
                    <Link to="/" className="flex items-center space-x-2">
                        <Zap className="w-7 h-7 text-pf-primary" />
                        <span className="text-xl font-bold text-gray-100">Nexus</span>
                    </Link>
                    <p className="text-[10px] text-gray-600 mt-1">Powered by Phase Flag</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {NAV_ITEMS.map(item => {
                        const isActive = item.href === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={clsx(
                                    'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-pf-primary/10 text-pf-primary'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-surface-light'
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Environment Switcher */}
                <div className="px-4 py-4 border-t border-gray-800">
                    <div className="flex items-center space-x-1.5 mb-2">
                        <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Environment</label>
                        <InfoIcon tip="Flags can behave differently per environment (dev/staging/production)" />
                    </div>
                    <div className="flex space-x-1">
                        {['development', 'staging', 'production'].map(env => (
                            <button
                                key={env}
                                onClick={() => setEnvironment(env)}
                                className={clsx(
                                    'flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                                    environment === env
                                        ? 'bg-surface-lighter text-gray-200 ring-1 ring-pf-primary/30'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-surface-light'
                                )}
                            >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${envColors[env]}`} />
                                {env.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col">
                {/* Top bar */}
                <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-surface/50 backdrop-blur-sm">
                    <div className="flex items-center space-x-3">
                        <span className={`inline-block w-2 h-2 rounded-full ${envColors[environment]}`} />
                        <span className="text-sm text-gray-400 capitalize">{environment}</span>
                        <span className="text-gray-700">|</span>
                        <div className="flex items-center space-x-1.5">
                            <span className="text-xs text-gray-600">
                                SSE: <span className={sseConnected ? 'text-green-400' : 'text-red-400'}>{sseConnected ? 'connected' : 'disconnected'}</span>
                            </span>
                            <InfoIcon tip="Real-time sync — flag changes in the Dashboard appear here within seconds" />
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {showNotifications && (
                            <button className="relative p-2 rounded-lg hover:bg-surface-light transition-colors text-gray-400 hover:text-gray-200">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                            </button>
                        )}
                        <div className="flex items-center space-x-1.5">
                            <InfoIcon tip="Switch personas to see how flags evaluate differently for each user type" />
                            <UserSwitcher />
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>

            <FlagInspector />
        </div>
    )
}

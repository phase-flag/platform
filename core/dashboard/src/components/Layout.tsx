import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Flag, Activity, Users, Settings, Menu, X, Sun, Moon, Webhook, LogOut, FlaskConical, Shield, BarChart3, Layers, ShieldCheck, Plug, FolderKanban, Globe, GitBranch, Gauge, Database, Code2, ArrowRightLeft, LayoutDashboard, Building2, CreditCard, HeartPulse } from 'lucide-react'
import clsx from 'clsx'
import { useEnvironment } from '@/contexts/EnvironmentContext'
import { useAuth } from '@/contexts/AuthContext'

const ENVIRONMENTS = ['development', 'staging', 'production'] as const

function useDarkMode() {
    const [dark, setDark] = useState(() => {
        const stored = localStorage.getItem('darkMode')
        if (stored !== null) return stored === 'true'
        return true // Default to dark mode
    })

    useEffect(() => {
        if (dark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
        localStorage.setItem('darkMode', String(dark))
    }, [dark])

    return [dark, () => setDark(d => !d)] as const
}

export default function Layout() {
    const location = useLocation()
    const { environment, setEnvironment } = useEnvironment()
    const { logout, user } = useAuth()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [dark, toggleDark] = useDarkMode()

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: Activity },
        { name: 'Feature Flags', href: '/flags', icon: Flag },
        { name: 'Segments', href: '/segments', icon: Users },
        { name: 'Projects', href: '/projects', icon: FolderKanban },
        { name: 'Environments', href: '/environments', icon: Globe },
        { name: 'Pipelines', href: '/pipelines', icon: GitBranch },
        { name: 'Webhooks', href: '/webhooks', icon: Webhook },
        { name: 'Exclusion Groups', href: '/exclusion-groups', icon: Layers },
        { name: 'Holdout Groups', href: '/holdout-groups', icon: ShieldCheck },
        { name: 'Experiments', href: '/experiments', icon: FlaskConical },
        { name: 'Simulations', href: '/simulations', icon: BarChart3 },
        { name: 'Approvals', href: '/approvals', icon: Shield },
        { name: 'Governance', href: '/governance', icon: Shield },
        { name: 'Migrations', href: '/migrations', icon: ArrowRightLeft },
        { name: 'Remote Config', href: '/remote-config', icon: Database },
        { name: 'Code Refs', href: '/code-refs', icon: Code2 },
        { name: 'Observability', href: '/observability', icon: Gauge },
        { name: 'Integrations', href: '/integrations', icon: Plug },
        { name: 'Settings', href: '/settings', icon: Settings },
    ]

    function closeMobile() {
        setMobileMenuOpen(false)
    }

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-1">
                    <span className="brand-text text-xl text-[#2B4C5C] dark:text-[#7ED4C1]">
                        PHASE
                    </span>
                    <svg className="w-[13px] h-[22px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="10" height="22" rx="5" stroke="#5BBAA7" strokeWidth="1.4" />
                        <circle cx="6" cy="7.5" r="3" stroke="#5BBAA7" strokeWidth="1.4" />
                    </svg>
                    <span className="brand-text text-xl text-[#2B4C5C] dark:text-[#7ED4C1]">
                        FLAG
                    </span>
                </div>
                <button onClick={closeMobile} className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
            </div>

            {/* Environment Selector */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Environment</label>
                <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as typeof environment)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-800 dark:text-gray-100"
                >
                    {ENVIRONMENTS.map(env => (
                        <option key={env} value={env}>
                            {env.charAt(0).toUpperCase() + env.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = location.pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={closeMobile}
                            className={clsx(
                                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                                isActive
                                    ? 'bg-[#E8F7F3] text-[#2B4C5C] dark:bg-primary-900/30 dark:text-primary-300'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                            )}
                        >
                            <item.icon className={clsx('w-4 h-4 mr-3', isActive ? 'text-[#5BBAA7]' : 'text-gray-500 dark:text-gray-400')} />
                            {item.name}
                        </Link>
                    )
                })}

                {/* Admin Section — only visible to admins */}
                {user?.role === 'admin' && (
                    <>
                        <div className="pt-4 pb-1 px-3">
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Admin</span>
                            </div>
                        </div>
                        {([
                            { name: 'Admin Overview', href: '/admin', icon: LayoutDashboard },
                            { name: 'Tenants', href: '/admin/tenants', icon: Building2 },
                            { name: 'Users', href: '/admin/users', icon: Users },
                            { name: 'Usage & Billing', href: '/admin/billing', icon: CreditCard },
                            { name: 'Platform Health', href: '/admin/health', icon: HeartPulse },
                        ] as const).map((item) => {
                            const isActive = item.href === '/admin'
                                ? location.pathname === '/admin'
                                : location.pathname.startsWith(item.href)
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={closeMobile}
                                    className={clsx(
                                        'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                                        isActive
                                            ? 'bg-[#E8F7F3] text-[#2B4C5C] dark:bg-primary-900/30 dark:text-primary-300'
                                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                    )}
                                >
                                    <item.icon className={clsx('w-4 h-4 mr-3', isActive ? 'text-[#5BBAA7]' : 'text-gray-500 dark:text-gray-400')} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </>
                )}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between px-3 py-2 mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {dark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                    <button
                        onClick={toggleDark}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {dark ? (
                            <Sun className="w-5 h-5 text-yellow-500" />
                        ) : (
                            <Moon className="w-5 h-5 text-gray-500" />
                        )}
                    </button>
                </div>
                {user && (
                    <div className="px-3 py-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                )}
                <button
                    onClick={logout}
                    className="flex items-center space-x-3 px-3 py-2.5 w-full text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
                <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </button>
                <div className="flex items-center space-x-1 ml-3">
                    <span className="brand-text text-lg text-[#2B4C5C] dark:text-[#7ED4C1]">PHASE</span>
                    <svg className="w-[12px] h-[20px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="10" height="22" rx="5" stroke="#5BBAA7" strokeWidth="1.4" />
                        <circle cx="6" cy="7.5" r="3" stroke="#5BBAA7" strokeWidth="1.4" />
                    </svg>
                    <span className="brand-text text-lg text-[#2B4C5C] dark:text-[#7ED4C1]">FLAG</span>
                </div>
            </div>

            {/* Mobile overlay */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    <div className="fixed inset-0 bg-black/50" onClick={closeMobile} />
                    <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-xl">
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Desktop sidebar */}
            <div className="hidden md:block fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                {sidebarContent}
            </div>

            {/* Main content */}
            <div className="md:pl-64 pt-16 md:pt-0">
                <main className="min-h-screen">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

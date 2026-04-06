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
        { name: 'Dashboard', href: '/dashboard', icon: Activity, tooltip: 'Overview of your feature flags and recent activity' },
        { name: 'Feature Flags', href: '/flags', icon: Flag, tooltip: 'Create, manage, and toggle feature flags' },
        { name: 'Segments', href: '/segments', icon: Users, tooltip: 'Define user segments for targeted flag delivery' },
        { name: 'Projects', href: '/projects', icon: FolderKanban, tooltip: 'Organize flags by project and organization' },
        { name: 'Environments', href: '/environments', icon: Globe, tooltip: 'Manage deployment environments (dev, staging, prod)' },
        { name: 'Pipelines', href: '/pipelines', icon: GitBranch, tooltip: 'Progressive rollout pipelines with staged deployments' },
        { name: 'Webhooks', href: '/webhooks', icon: Webhook, tooltip: 'Receive event notifications via HTTP webhooks' },
        { name: 'Exclusion Groups', href: '/exclusion-groups', icon: Layers, tooltip: 'Ensure users see at most one experiment per group' },
        { name: 'Holdout Groups', href: '/holdout-groups', icon: ShieldCheck, tooltip: 'Reserve a control population across experiments' },
        { name: 'Experiments', href: '/experiments', icon: FlaskConical, tooltip: 'A/B test flag variations with statistical analysis' },
        { name: 'Simulations', href: '/simulations', icon: BarChart3, tooltip: 'Predict flag change impact before deploying' },
        { name: 'Approvals', href: '/approvals', icon: Shield, tooltip: 'Review and approve flag changes for protected environments' },
        { name: 'Governance', href: '/governance', icon: Shield, tooltip: 'Change requests, freeze windows, and service accounts' },
        { name: 'Migrations', href: '/migrations', icon: ArrowRightLeft, tooltip: 'Manage phased system migrations using flag stages' },
        { name: 'Remote Config', href: '/remote-config', icon: Database, tooltip: 'Typed configuration values fetched by SDKs at runtime' },
        { name: 'Code Refs', href: '/code-refs', icon: Code2, tooltip: 'Track where flags are referenced in your codebase' },
        { name: 'Observability', href: '/observability', icon: Gauge, tooltip: 'System metrics, flag health, and evaluation analytics' },
        { name: 'Integrations', href: '/integrations', icon: Plug, tooltip: 'Connect Phase Flag with Slack, Datadog, and more' },
        { name: 'Settings', href: '/settings', icon: Settings, tooltip: 'Configure API connection and authentication' },
    ]

    function closeMobile() {
        setMobileMenuOpen(false)
    }

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-1">
                    <span className="brand-text text-xl text-primary-700 dark:text-primary-300">
                        PHASE
                    </span>
                    <svg className="w-[13px] h-[22px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="10" height="22" rx="5" stroke="#6366F1" strokeWidth="1.4" />
                        <circle cx="6" cy="7.5" r="3" stroke="#6366F1" strokeWidth="1.4" />
                    </svg>
                    <span className="brand-text text-xl text-primary-700 dark:text-primary-300">
                        FLAG
                    </span>
                </div>
                <button onClick={closeMobile} className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
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
                            title={item.tooltip}
                            className={clsx(
                                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                                isActive
                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                            )}
                        >
                            <item.icon className={clsx('w-4 h-4 mr-3', isActive ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400')} />
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
                                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                    )}
                                >
                                    <item.icon className={clsx('w-4 h-4 mr-3', isActive ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400')} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </>
                )}
            </nav>
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
                    <span className="brand-text text-lg text-primary-700 dark:text-primary-300">PHASE</span>
                    <svg className="w-[12px] h-[20px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="10" height="22" rx="5" stroke="#6366F1" strokeWidth="1.4" />
                        <circle cx="6" cy="7.5" r="3" stroke="#6366F1" strokeWidth="1.4" />
                    </svg>
                    <span className="brand-text text-lg text-primary-700 dark:text-primary-300">FLAG</span>
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
            <div className="hidden md:block fixed inset-y-0 left-0 md:w-56 lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                {sidebarContent}
            </div>

            {/* Main content */}
            <div className="md:pl-56 lg:pl-64 pt-16 md:pt-0">
                {/* Top header bar */}
                <header className="sticky top-0 z-20 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end px-6 gap-4">
                    {/* Environment selector */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">Environment</label>
                        <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value as typeof environment)}
                            title="Filter flags by deployment environment"
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 dark:bg-gray-800 dark:text-gray-100"
                        >
                            {ENVIRONMENTS.map(env => (
                                <option key={env} value={env}>
                                    {env.charAt(0).toUpperCase() + env.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Dark mode toggle */}
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

                    {/* User info & logout */}
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:block text-right">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight truncate max-w-[140px]">{user.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">{user.email}</p>
                            </div>
                            <button
                                onClick={logout}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Sign out"
                            >
                                <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="hidden sm:inline font-medium">Sign Out</span>
                            </button>
                        </div>
                    )}
                </header>

                <main className="min-h-screen">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

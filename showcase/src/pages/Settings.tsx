import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import { Shield, Sparkles, Globe, Bell, Palette, Zap } from 'lucide-react'

export default function Settings() {
    const { flagValues, currentUser } = usePhaseFlagContext()

    const showBeta = flagValues['nexus-beta-features'] === true
    const showNotifications = flagValues['nexus-notifications'] === true
    const darkMode = flagValues['nexus-dark-mode'] === true
    const onboarding = String(flagValues['nexus-onboarding'] ?? 'classic')

    return (
        <div className="p-8 max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Settings</h1>
            <p className="text-gray-500 mb-8">Manage your Nexus preferences</p>

            {/* Profile */}
            <section className="bg-surface rounded-xl border border-gray-800 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-pf-primary" />
                    <span>Profile</span>
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Name</label>
                        <p className="text-sm text-gray-200 bg-surface-light px-3 py-2 rounded-lg">{currentUser.name}</p>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Email</label>
                        <p className="text-sm text-gray-200 bg-surface-light px-3 py-2 rounded-lg">{currentUser.email}</p>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Plan</label>
                        <p className="text-sm text-gray-200 bg-surface-light px-3 py-2 rounded-lg capitalize">{currentUser.plan}</p>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Role</label>
                        <p className="text-sm text-gray-200 bg-surface-light px-3 py-2 rounded-lg capitalize">{currentUser.role}</p>
                    </div>
                </div>
            </section>

            {/* Appearance — controlled by dark-mode flag */}
            <section className="bg-surface rounded-xl border border-gray-800 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
                    <Palette className="w-5 h-5 text-pf-primary" />
                    <span>Appearance</span>
                </h2>
                <div className="flex items-center justify-between py-3">
                    <div>
                        <p className="text-sm text-gray-200">Dark Mode</p>
                        <p className="text-xs text-gray-500">Controlled by <code className="bg-gray-800 px-1 rounded">nexus-dark-mode</code></p>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-pf-primary' : 'bg-gray-700'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
                    </div>
                </div>
            </section>

            {/* Notifications — environment flag */}
            <section className="bg-surface rounded-xl border border-gray-800 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-pf-primary" />
                    <span>Notifications</span>
                </h2>
                <div className="flex items-center justify-between py-3">
                    <div>
                        <p className="text-sm text-gray-200">Notification Center</p>
                        <p className="text-xs text-gray-500">
                            {showNotifications ? (
                                <span className="text-green-400">Active in this environment</span>
                            ) : (
                                <span className="text-red-400">Inactive in this environment</span>
                            )}
                            <span className="text-gray-600 ml-1">— <code className="bg-gray-800 px-1 rounded">nexus-notifications</code></span>
                        </p>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${showNotifications ? 'bg-pf-primary' : 'bg-gray-700'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${showNotifications ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
                    </div>
                </div>
            </section>

            {/* Onboarding — A/B experiment */}
            <section className="bg-surface rounded-xl border border-gray-800 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-pf-primary" />
                    <span>Onboarding Experience</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">A/B TEST</span>
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                    You're seeing the <span className="text-pf-primary font-medium">{onboarding}</span> variant
                    <span className="text-gray-600 ml-1">— <code className="bg-gray-800 px-1 rounded">nexus-onboarding</code></span>
                </p>
                {onboarding === 'classic' ? (
                    <div className="bg-surface-light rounded-lg p-4 border border-gray-700">
                        <h3 className="text-sm font-medium text-gray-200 mb-3">Getting Started Checklist</h3>
                        <div className="space-y-2">
                            {['Create your first project', 'Add a team member', 'Create a task', 'Set up notifications'].map((step, i) => (
                                <div key={step} className="flex items-center space-x-2">
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${i < 2 ? 'bg-pf-primary border-pf-primary text-pf-dark' : 'border-gray-600 text-gray-600'}`}>
                                        {i < 2 ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-sm ${i < 2 ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-surface-light rounded-lg p-4 border border-pf-primary/30">
                        <div className="flex items-center space-x-2 mb-3">
                            <Sparkles className="w-4 h-4 text-pf-primary" />
                            <h3 className="text-sm font-medium text-pf-primary">Interactive Guided Tour</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">Follow along as we walk you through Nexus features step by step.</p>
                        <div className="flex items-center space-x-2">
                            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full w-1/3 bg-pf-primary rounded-full" />
                            </div>
                            <span className="text-xs text-gray-500">Step 2 of 6</span>
                        </div>
                        <button className="mt-3 px-4 py-2 bg-pf-primary text-pf-dark text-sm font-medium rounded-lg hover:bg-pf-primary-light transition-colors">
                            Continue Tour
                        </button>
                    </div>
                )}
            </section>

            {/* Beta */}
            {showBeta && (
                <section className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-purple-300 mb-2 flex items-center space-x-2">
                        <Zap className="w-5 h-5 text-purple-400" />
                        <span>Labs</span>
                    </h2>
                    <p className="text-xs text-gray-500">You have access to experimental features because of your plan or team membership.</p>
                </section>
            )}
        </div>
    )
}

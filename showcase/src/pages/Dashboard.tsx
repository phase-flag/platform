import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import { MOCK_TASKS, MOCK_PROJECTS } from '@/lib/mock-data'
import { CheckSquare, FolderKanban, TrendingUp, Flame, Lock } from 'lucide-react'

export default function Dashboard() {
    const { flagValues, currentUser } = usePhaseFlagContext()

    const maxProjects = Number(flagValues['nexus-max-projects'] ?? 3)
    const dashConfig = (flagValues['nexus-dashboard-widgets'] ?? { widgets: ['tasks', 'projects'], layout: '2-col' }) as { widgets: string[]; layout: string }
    const showBeta = flagValues['nexus-beta-features'] === true
    const showAI = flagValues['nexus-ai-summaries'] === true

    const tasksByStatus = {
        backlog: MOCK_TASKS.filter(t => t.status === 'backlog').length,
        in_progress: MOCK_TASKS.filter(t => t.status === 'in_progress').length,
        review: MOCK_TASKS.filter(t => t.status === 'review').length,
        done: MOCK_TASKS.filter(t => t.status === 'done').length,
    }

    const isAdvanced = dashConfig.layout === '4-col'

    const stats = [
        { name: 'Total Tasks', value: MOCK_TASKS.length, icon: CheckSquare, color: 'text-pf-mint' },
        { name: 'In Progress', value: tasksByStatus.in_progress, icon: TrendingUp, color: 'text-blue-400' },
        ...(isAdvanced ? [
            { name: 'Velocity', value: '12.4', icon: Flame, color: 'text-orange-400' },
            { name: 'Sprint Burn', value: '67%', icon: TrendingUp, color: 'text-purple-400' },
        ] : []),
    ]

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
                <p className="text-gray-500 mt-1">Welcome back, {currentUser.name}</p>
            </div>

            {/* Stats */}
            <div className={`grid gap-6 mb-8 ${isAdvanced ? 'grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
                {stats.map(stat => (
                    <div key={stat.name} className="bg-surface rounded-xl border border-gray-800 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">{stat.name}</p>
                                <p className="text-2xl font-bold text-gray-100 mt-1">{stat.value}</p>
                            </div>
                            <stat.icon className={`w-8 h-8 ${stat.color} opacity-60`} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Projects */}
                {dashConfig.widgets.includes('projects') && (
                    <div className="bg-surface rounded-xl border border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-100">Projects</h2>
                            <span className="text-xs text-gray-500">
                                {MOCK_PROJECTS.length} / {maxProjects === 999 ? 'unlimited' : maxProjects}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {MOCK_PROJECTS.map((proj, i) => {
                                const locked = i >= maxProjects
                                return (
                                    <div
                                        key={proj.id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                            locked ? 'bg-gray-800/30 opacity-50' : 'bg-surface-light hover:bg-surface-lighter'
                                        } transition-colors`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: proj.color }} />
                                            <div>
                                                <p className="text-sm font-medium text-gray-200">{proj.name}</p>
                                                <p className="text-xs text-gray-500">{proj.taskCount} tasks</p>
                                            </div>
                                        </div>
                                        {locked ? (
                                            <Lock className="w-4 h-4 text-gray-600" />
                                        ) : (
                                            <FolderKanban className="w-4 h-4 text-gray-600" />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {maxProjects < MOCK_PROJECTS.length && (
                            <p className="mt-3 text-xs text-pf-mint cursor-pointer hover:underline">
                                Upgrade to {currentUser.plan === 'free' ? 'Pro' : 'Enterprise'} for more projects
                            </p>
                        )}
                    </div>
                )}

                {/* Task Status */}
                {dashConfig.widgets.includes('tasks') && (
                    <div className="bg-surface rounded-xl border border-gray-800 p-6">
                        <h2 className="text-lg font-semibold text-gray-100 mb-4">Task Overview</h2>
                        <div className="space-y-4">
                            {Object.entries(tasksByStatus).map(([status, count]) => {
                                const colors: Record<string, string> = {
                                    backlog: 'bg-gray-500', in_progress: 'bg-blue-500', review: 'bg-yellow-500', done: 'bg-green-500',
                                }
                                const pct = (count / MOCK_TASKS.length) * 100
                                return (
                                    <div key={status}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                                            <span className="text-sm font-medium text-gray-300">{count}</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Beta Features Section */}
            {showBeta && (
                <div className="mt-8 bg-purple-900/20 border border-purple-700/30 rounded-xl p-6">
                    <div className="flex items-center space-x-2 mb-3">
                        <Flame className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-purple-300">Labs</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">BETA</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Early access features available for your plan.</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/20">
                            <p className="text-sm font-medium text-gray-200">AI Task Prioritization</p>
                            <p className="text-xs text-gray-500 mt-1">Auto-rank tasks by impact and urgency</p>
                        </div>
                        <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/20">
                            <p className="text-sm font-medium text-gray-200">Custom Workflows</p>
                            <p className="text-xs text-gray-500 mt-1">Design your own task pipelines</p>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Summaries */}
            {showAI && (
                <div className="mt-8 bg-pf-mint/5 border border-pf-mint/20 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-pf-mint mb-2">AI Summary</h2>
                    <p className="text-sm text-gray-400">Your team completed 6 tasks this week, 2 more than last week. The SSO integration is at risk of missing its deadline.</p>
                </div>
            )}
        </div>
    )
}

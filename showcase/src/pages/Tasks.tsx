import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import { MOCK_TASKS, DEMO_USERS } from '@/lib/mock-data'
import { Calendar, Tag, User, MessageSquare, Keyboard } from 'lucide-react'
import clsx from 'clsx'

function TaskCardCompact({ task }: { task: typeof MOCK_TASKS[0] }) {
    const assignee = DEMO_USERS.find(u => u.id === task.assignee)
    const priorityColors: Record<string, string> = {
        low: 'text-gray-500', medium: 'text-blue-400', high: 'text-orange-400', urgent: 'text-red-400',
    }
    return (
        <div className="bg-surface-light rounded-lg px-4 py-2.5 flex items-center justify-between hover:bg-surface-lighter transition-colors cursor-pointer">
            <div className="flex items-center space-x-3">
                <span className={`text-xs font-bold ${priorityColors[task.priority]}`}>{task.priority[0].toUpperCase()}</span>
                <span className="text-sm text-gray-200 truncate max-w-xs">{task.title}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
                {task.tags.slice(0, 1).map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-800 rounded">{t}</span>)}
                <span>{assignee?.avatar}</span>
            </div>
        </div>
    )
}

function TaskCardStandard({ task }: { task: typeof MOCK_TASKS[0] }) {
    const assignee = DEMO_USERS.find(u => u.id === task.assignee)
    const priorityColors: Record<string, string> = {
        low: 'border-gray-600', medium: 'border-blue-500', high: 'border-orange-500', urgent: 'border-red-500',
    }
    return (
        <div className={`bg-surface-light rounded-xl p-4 border-l-2 ${priorityColors[task.priority]} hover:bg-surface-lighter transition-colors cursor-pointer`}>
            <h3 className="text-sm font-medium text-gray-200 mb-1">{task.title}</h3>
            <p className="text-xs text-gray-500 mb-3 line-clamp-1">{task.description}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {task.tags.map(t => (
                        <span key={t} className="flex items-center text-[10px] text-gray-500 bg-gray-800 rounded px-1.5 py-0.5">
                            <Tag className="w-2.5 h-2.5 mr-0.5" />{t}
                        </span>
                    ))}
                </div>
                <div className="flex items-center space-x-2">
                    {task.dueDate && <span className="text-[10px] text-gray-500 flex items-center"><Calendar className="w-2.5 h-2.5 mr-0.5" />{task.dueDate.slice(5)}</span>}
                    <div className="w-6 h-6 rounded-full bg-pf-navy text-pf-mint flex items-center justify-center text-[9px] font-bold">
                        {assignee?.avatar}
                    </div>
                </div>
            </div>
        </div>
    )
}

function TaskCardDetailed({ task }: { task: typeof MOCK_TASKS[0] }) {
    const assignee = DEMO_USERS.find(u => u.id === task.assignee)
    const priorityBadge: Record<string, string> = {
        low: 'bg-gray-700 text-gray-300',
        medium: 'bg-blue-900/50 text-blue-300',
        high: 'bg-orange-900/50 text-orange-300',
        urgent: 'bg-red-900/50 text-red-300',
    }
    return (
        <div className="bg-surface-light rounded-xl p-5 border border-gray-700 hover:border-pf-mint/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-100">{task.title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priorityBadge[task.priority]}`}>
                    {task.priority}
                </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">{task.description}</p>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-400">{assignee?.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                        <MessageSquare className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-400">{Math.floor(Math.random() * 5)} comments</span>
                    </div>
                </div>
                <div className="flex items-center space-x-1.5">
                    {task.tags.map(t => (
                        <span key={t} className="text-[10px] text-pf-mint bg-pf-mint/10 rounded px-1.5 py-0.5">{t}</span>
                    ))}
                </div>
            </div>
            {task.dueDate && (
                <div className="mt-3 pt-3 border-t border-gray-800 flex items-center space-x-1.5 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>Due {task.dueDate}</span>
                </div>
            )}
        </div>
    )
}

export default function Tasks() {
    const { flagValues } = usePhaseFlagContext()

    const taskLayout = String(flagValues['nexus-task-layout'] ?? 'standard')
    const showPowerTools = flagValues['nexus-power-tools'] === true
    const showChat = flagValues['nexus-chat-widget'] === true

    const statuses = ['backlog', 'in_progress', 'review', 'done'] as const
    const statusLabels: Record<string, string> = {
        backlog: 'Backlog', in_progress: 'In Progress', review: 'Review', done: 'Done',
    }
    const statusColors: Record<string, string> = {
        backlog: 'bg-gray-500', in_progress: 'bg-blue-500', review: 'bg-yellow-500', done: 'bg-green-500',
    }

    const CardComponent = taskLayout === 'compact' ? TaskCardCompact
        : taskLayout === 'detailed' ? TaskCardDetailed
        : TaskCardStandard

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-100">Tasks</h1>
                    <p className="text-gray-500 mt-1">
                        Layout: <span className="text-pf-mint font-medium">{taskLayout}</span>
                        <span className="text-gray-700 mx-2">|</span>
                        <span className="text-xs text-gray-600">Controlled by <code className="bg-gray-800 px-1 rounded">nexus-task-layout</code></span>
                    </p>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-4 gap-6">
                {statuses.map(status => (
                    <div key={status}>
                        <div className="flex items-center space-x-2 mb-4">
                            <span className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
                            <h2 className="text-sm font-semibold text-gray-300">{statusLabels[status]}</h2>
                            <span className="text-xs text-gray-600">{MOCK_TASKS.filter(t => t.status === status).length}</span>
                        </div>
                        <div className="space-y-3">
                            {MOCK_TASKS.filter(t => t.status === status).map(task => (
                                <CardComponent key={task.id} task={task} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Power User Shortcuts */}
            {showPowerTools && (
                <div className="mt-8 bg-surface border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <Keyboard className="w-5 h-5 text-pf-mint" />
                        <h2 className="text-lg font-semibold text-gray-100">Keyboard Shortcuts</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-pf-mint/10 text-pf-mint border border-pf-mint/20">POWER USER</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            ['Ctrl+N', 'New task'], ['Ctrl+K', 'Quick search'], ['Ctrl+Shift+A', 'Assign to me'],
                            ['G then D', 'Go to dashboard'], ['G then T', 'Go to tasks'], ['Ctrl+/', 'Toggle shortcuts'],
                        ].map(([key, desc]) => (
                            <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light">
                                <span className="text-xs text-gray-400">{desc}</span>
                                <kbd className="text-[10px] font-mono bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700">{key}</kbd>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Chat Widget */}
            {showChat && (
                <div className="fixed bottom-20 right-20 z-40 w-80 bg-surface border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="bg-pf-mint px-4 py-3 flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-pf-dark" />
                        <span className="text-sm font-semibold text-pf-dark">Support Chat</span>
                        <span className="ml-auto text-[10px] bg-pf-dark/20 text-pf-dark px-1.5 py-0.5 rounded-full">30% rollout</span>
                    </div>
                    <div className="p-4">
                        <div className="bg-surface-light rounded-lg p-3 mb-3">
                            <p className="text-xs text-gray-300">Hi! How can we help you today?</p>
                            <p className="text-[10px] text-gray-600 mt-1">Support team - just now</p>
                        </div>
                        <input
                            placeholder="Type a message..."
                            className="w-full text-xs bg-surface-light border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-pf-mint"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

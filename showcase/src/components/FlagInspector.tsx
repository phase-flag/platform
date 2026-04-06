import { usePhaseFlagContext } from '@/hooks/usePhaseFlagContext'
import { useState } from 'react'
import { Flag, X, Eye } from 'lucide-react'
import Tooltip from './Tooltip'

export default function FlagInspector() {
    const { flagResults, currentUser } = usePhaseFlagContext()
    const [open, setOpen] = useState(false)

    const reasonColors: Record<string, string> = {
        default: 'text-gray-400',
        targeting_match: 'text-pf-primary',
        percentage_rollout: 'text-blue-400',
        disabled: 'text-red-400',
    }

    return (
        <>
            {/* Toggle Button */}
            <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2">
                {!open && (
                    <Tooltip text="Debug panel showing all flag evaluations for the current user and environment">
                        <span className="flex items-center" />
                    </Tooltip>
                )}
                <Tooltip text="Debug panel showing all flag evaluations for the current user and environment">
                    <button
                        onClick={() => setOpen(!open)}
                        className="w-12 h-12 bg-pf-primary text-pf-dark rounded-full shadow-lg flex items-center justify-center hover:bg-pf-primary-light transition-colors"
                        aria-label="Flag Inspector"
                    >
                        {open ? <X className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </Tooltip>
            </div>

            {/* Panel */}
            {open && (
                <div className="fixed bottom-20 right-6 z-50 w-[420px] max-h-[70vh] bg-surface border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-700 flex items-center space-x-2 bg-surface-light">
                        <Flag className="w-4 h-4 text-pf-primary" />
                        <h3 className="text-sm font-semibold text-gray-200">Flag Inspector</h3>
                        <span className="ml-auto text-xs text-gray-500">{flagResults.length} flags</span>
                    </div>

                    <div className="px-4 py-2 border-b border-gray-700 bg-surface-light/50">
                        <p className="text-xs text-gray-500">
                            User: <span className="text-pf-primary">{currentUser.name}</span> ({currentUser.plan})
                        </p>
                    </div>

                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-surface">
                                <tr className="border-b border-gray-700">
                                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Flag</th>
                                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Value</th>
                                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flagResults.map(r => (
                                    <tr key={r.key} className="border-b border-gray-800 hover:bg-surface-light/50">
                                        <td className="py-2 px-3 font-mono text-gray-300">{r.key.replace('nexus-', '')}</td>
                                        <td className="py-2 px-3">
                                            <span className="font-mono text-pf-primary-light">
                                                {typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)}
                                            </span>
                                        </td>
                                        <td className={`py-2 px-3 ${reasonColors[r.reason] || 'text-gray-400'}`}>
                                            {r.reason.replace('_', ' ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    )
}

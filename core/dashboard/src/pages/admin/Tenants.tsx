import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Building2, Search, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface Tenant {
    id: string
    name: string
    slug: string
    status: 'active' | 'suspended'
    projects_count: number
    flags_count: number
    users_count: number
    evaluation_count: number
    created_at: string
}

const MOCK_TENANTS: Tenant[] = [
    { id: '1', name: 'Acme Corp', slug: 'acme-corp', status: 'active', projects_count: 5, flags_count: 124, users_count: 32, evaluation_count: 2_450_000, created_at: '2025-06-15T10:00:00Z' },
    { id: '2', name: 'Globex Inc', slug: 'globex-inc', status: 'active', projects_count: 3, flags_count: 78, users_count: 15, evaluation_count: 890_000, created_at: '2025-08-22T14:30:00Z' },
    { id: '3', name: 'Initech', slug: 'initech', status: 'suspended', projects_count: 1, flags_count: 12, users_count: 4, evaluation_count: 34_000, created_at: '2025-11-01T09:15:00Z' },
    { id: '4', name: 'Umbrella Labs', slug: 'umbrella-labs', status: 'active', projects_count: 8, flags_count: 342, users_count: 67, evaluation_count: 4_100_000, created_at: '2025-04-10T16:00:00Z' },
    { id: '5', name: 'Stark Industries', slug: 'stark-industries', status: 'active', projects_count: 12, flags_count: 567, users_count: 89, evaluation_count: 12_300_000, created_at: '2025-02-20T08:45:00Z' },
    { id: '6', name: 'Wayne Enterprises', slug: 'wayne-enterprises', status: 'active', projects_count: 6, flags_count: 201, users_count: 43, evaluation_count: 3_200_000, created_at: '2025-05-18T11:20:00Z' },
]

function formatNumber(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toString()
}

export default function Tenants() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [confirmAction, setConfirmAction] = useState<{ type: 'suspend' | 'activate'; tenant: Tenant } | null>(null)

    const { data: rawTenants, isError } = useQuery({
        queryKey: ['admin', 'tenants'],
        queryFn: () => adminApi.listTenants().then(r => r.data as Tenant[]),
        retry: false,
    })

    const tenants = isError || !rawTenants ? MOCK_TENANTS : rawTenants
    const showBanner = isError || !rawTenants

    const suspendMutation = useMutation({
        mutationFn: (id: string) => adminApi.suspendTenant(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] })
            toast('success', 'Tenant suspended')
        },
        onError: () => toast('error', 'Failed to suspend tenant'),
    })

    const activateMutation = useMutation({
        mutationFn: (id: string) => adminApi.activateTenant(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] })
            toast('success', 'Tenant activated')
        },
        onError: () => toast('error', 'Failed to activate tenant'),
    })

    const filtered = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    )

    function handleConfirm() {
        if (!confirmAction) return
        if (confirmAction.type === 'suspend') {
            suspendMutation.mutate(confirmAction.tenant.id)
        } else {
            activateMutation.mutate(confirmAction.tenant.id)
        }
        setConfirmAction(null)
    }

    return (
        <div className="p-8">
            {showBanner && (
                <div className="mb-6 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Admin endpoints coming soon &mdash; showing sample data
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tenants</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Manage organizations across the platform</p>
                </div>
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search tenants..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-transparent text-sm outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 w-48"
                    />
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Projects</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Flags</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Users</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Evaluations</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((tenant, idx) => (
                                <tr
                                    key={tenant.id}
                                    className={clsx(
                                        'border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                                        idx % 2 === 1 && 'bg-gray-50/50 dark:bg-gray-800/20'
                                    )}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded">
                                                <Building2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{tenant.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{tenant.slug}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={clsx(
                                            'badge text-xs',
                                            tenant.status === 'active' ? 'badge-success' : 'badge-danger'
                                        )}>
                                            {tenant.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{tenant.projects_count}</td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{tenant.flags_count}</td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{tenant.users_count}</td>
                                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">{formatNumber(tenant.evaluation_count)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                        {new Date(tenant.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            {tenant.status === 'active' ? (
                                                <button
                                                    onClick={() => setConfirmAction({ type: 'suspend', tenant })}
                                                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                >
                                                    Suspend
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmAction({ type: 'activate', tenant })}
                                                    className="text-xs px-2 py-1 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20 rounded transition-colors"
                                                >
                                                    Activate
                                                </button>
                                            )}
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No tenants found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!confirmAction}
                title={confirmAction?.type === 'suspend' ? 'Suspend Tenant' : 'Activate Tenant'}
                message={confirmAction?.type === 'suspend'
                    ? `Are you sure you want to suspend "${confirmAction?.tenant.name}"? All users will lose access.`
                    : `Activate "${confirmAction?.tenant.name}" and restore access for all users?`
                }
                confirmLabel={confirmAction?.type === 'suspend' ? 'Suspend' : 'Activate'}
                variant={confirmAction?.type === 'suspend' ? 'danger' : 'warning'}
                onConfirm={handleConfirm}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    )
}

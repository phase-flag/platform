import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Search, UserCircle } from 'lucide-react'
import clsx from 'clsx'

interface AdminUser {
    id: string
    name: string
    email: string
    role: string
    organization: string
    last_login: string | null
    created_at: string
}

const MOCK_USERS: AdminUser[] = [
    { id: '1', name: 'Alice Johnson', email: 'alice@acme.com', role: 'admin', organization: 'Acme Corp', last_login: '2026-03-19T18:30:00Z', created_at: '2025-06-15T10:00:00Z' },
    { id: '2', name: 'Bob Chen', email: 'bob@acme.com', role: 'editor', organization: 'Acme Corp', last_login: '2026-03-20T09:15:00Z', created_at: '2025-07-01T14:00:00Z' },
    { id: '3', name: 'Carol Smith', email: 'carol@globex.com', role: 'viewer', organization: 'Globex Inc', last_login: '2026-03-18T11:45:00Z', created_at: '2025-09-10T08:30:00Z' },
    { id: '4', name: 'Dan Wilson', email: 'dan@umbrella.com', role: 'admin', organization: 'Umbrella Labs', last_login: '2026-03-20T07:00:00Z', created_at: '2025-04-20T16:00:00Z' },
    { id: '5', name: 'Eve Martinez', email: 'eve@stark.com', role: 'editor', organization: 'Stark Industries', last_login: null, created_at: '2026-01-15T12:00:00Z' },
    { id: '6', name: 'Frank Lee', email: 'frank@wayne.com', role: 'viewer', organization: 'Wayne Enterprises', last_login: '2026-03-17T15:20:00Z', created_at: '2025-10-05T09:00:00Z' },
    { id: '7', name: 'Grace Kim', email: 'grace@initech.com', role: 'editor', organization: 'Initech', last_login: '2026-03-15T10:00:00Z', created_at: '2025-12-01T11:30:00Z' },
    { id: '8', name: 'Henry Patel', email: 'henry@acme.com', role: 'viewer', organization: 'Acme Corp', last_login: '2026-03-14T16:45:00Z', created_at: '2025-08-20T13:00:00Z' },
]

const ROLES = ['admin', 'editor', 'viewer']

export default function AdminUsers() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [filterRole, setFilterRole] = useState<string>('')
    const [filterOrg, setFilterOrg] = useState<string>('')
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
    const [roleEdit, setRoleEdit] = useState<{ userId: string; role: string } | null>(null)

    const { data: rawUsers, isError } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: () => adminApi.listAllUsers().then(r => r.data as AdminUser[]),
        retry: false,
    })

    const users = isError || !rawUsers ? MOCK_USERS : rawUsers
    const showBanner = isError || !rawUsers

    const orgs = [...new Set(users.map(u => u.organization))].sort()

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.updateUserRole(id, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
            toast('success', 'User role updated')
            setRoleEdit(null)
        },
        onError: () => toast('error', 'Failed to update role'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => adminApi.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
            toast('success', 'User deleted')
        },
        onError: () => toast('error', 'Failed to delete user'),
    })

    const filtered = users.filter(u => {
        const matchSearch = !search ||
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        const matchRole = !filterRole || u.role === filterRole
        const matchOrg = !filterOrg || u.organization === filterOrg
        return matchSearch && matchRole && matchOrg
    })

    const roleBadgeClass = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            case 'editor': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        }
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

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Manage users across all tenants</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-transparent text-sm outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 w-48"
                    />
                </div>
                <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                    <option value="">All Roles</option>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
                <select
                    value={filterOrg}
                    onChange={e => setFilterOrg(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                    <option value="">All Organizations</option>
                    {orgs.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((user, idx) => (
                                <tr
                                    key={user.id}
                                    className={clsx(
                                        'border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                                        idx % 2 === 1 && 'bg-gray-50/50 dark:bg-gray-800/20'
                                    )}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center space-x-3">
                                            <UserCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {roleEdit?.userId === user.id ? (
                                            <select
                                                value={roleEdit.role}
                                                onChange={e => setRoleEdit({ userId: user.id, role: e.target.value })}
                                                onBlur={() => {
                                                    if (roleEdit.role !== user.role) {
                                                        updateRoleMutation.mutate({ id: user.id, role: roleEdit.role })
                                                    } else {
                                                        setRoleEdit(null)
                                                    }
                                                }}
                                                autoFocus
                                                className="text-xs px-2 py-1 border border-primary-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                            >
                                                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                            </select>
                                        ) : (
                                            <button
                                                onClick={() => setRoleEdit({ userId: user.id, role: user.role })}
                                                className={clsx('text-xs px-2 py-1 rounded font-medium', roleBadgeClass(user.role))}
                                            >
                                                {user.role}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{user.organization}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setDeleteTarget(user)}
                                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete User"
                message={`Are you sure you want to delete "${deleteTarget?.name}" (${deleteTarget?.email})? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                    setDeleteTarget(null)
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
}

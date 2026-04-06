import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi, type IntegrationStatus } from '@/lib/api'
import { Plug, Trash2, CheckCircle, XCircle, Send } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/Skeleton'

export default function Integrations() {
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const { data: statusData, isLoading } = useQuery({
        queryKey: ['integrations-status'],
        queryFn: () => integrationsApi.status().then(r => r.data),
    })

    const integrations: IntegrationStatus[] = Array.isArray(statusData) ? statusData : []

    const deleteMutation = useMutation({
        mutationFn: (type: string) => integrationsApi.delete(type),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations-status'] })
            toast('success', 'Integration removed')
        },
        onError: (err) => toast('error', `Remove failed: ${(err as Error).message}`),
    })

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Integrations</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Connect Phase Flag with your existing tools</p>
            </div>

            {/* Active Integrations */}
            {isLoading && <Skeleton variant="card" count={2} className="mb-8" />}

            {!isLoading && integrations.length > 0 && (
                <div className="card mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Active Integrations</h2>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {integrations.map((integration) => (
                            <div key={integration.id} className="flex items-center justify-between py-3">
                                <div className="flex items-center space-x-3">
                                    {integration.active ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">{integration.integration_type}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {integration.active ? 'Connected' : 'Inactive'} &middot; Updated {new Date(integration.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteMutation.mutate(integration.integration_type)}
                                    disabled={deleteMutation.isPending}
                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    title="Remove integration"
                                >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isLoading && integrations.length === 0 && (
                <div className="card text-center py-12 mb-8">
                    <Plug className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No integrations configured</h3>
                    <p className="text-gray-600 dark:text-gray-400">Configure Slack or Jira below to get started.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SlackConfigSection />
                <JiraConfigSection />
            </div>
        </div>
    )
}

function SlackConfigSection() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [webhookUrl, setWebhookUrl] = useState('')

    const configureMutation = useMutation({
        mutationFn: () => integrationsApi.configureSlack({ webhook_url: webhookUrl }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations-status'] })
            toast('success', 'Slack integration configured')
            setWebhookUrl('')
        },
        onError: (err) => toast('error', `Configuration failed: ${(err as Error).message}`),
    })

    const testMutation = useMutation({
        mutationFn: () => integrationsApi.testSlack(),
        onSuccess: () => toast('success', 'Test message sent to Slack'),
        onError: (err) => toast('error', `Test failed: ${(err as Error).message}`),
    })

    return (
        <div className="card">
            <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Send className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Slack</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive flag change notifications in Slack</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                        className="input"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Create an incoming webhook in your Slack workspace settings</p>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={() => configureMutation.mutate()}
                        disabled={!webhookUrl.trim() || configureMutation.isPending}
                        className="btn btn-primary disabled:opacity-50"
                    >
                        {configureMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={() => testMutation.mutate()}
                        disabled={testMutation.isPending}
                        className="btn btn-secondary disabled:opacity-50"
                    >
                        {testMutation.isPending ? 'Sending...' : 'Test'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function JiraConfigSection() {
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const [url, setUrl] = useState('')
    const [email, setEmail] = useState('')
    const [apiToken, setApiToken] = useState('')
    const [projectKey, setProjectKey] = useState('')

    const configureMutation = useMutation({
        mutationFn: () => integrationsApi.configureJira({ url, email, api_token: apiToken, project_key: projectKey }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations-status'] })
            toast('success', 'Jira integration configured')
            setUrl('')
            setEmail('')
            setApiToken('')
            setProjectKey('')
        },
        onError: (err) => toast('error', `Configuration failed: ${(err as Error).message}`),
    })

    const isValid = url.trim() && email.trim() && apiToken.trim() && projectKey.trim()

    return (
        <div className="card">
            <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Plug className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Jira</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Create Jira issues for flag changes and approvals</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jira URL</label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://your-org.atlassian.net"
                        className="input"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="input"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Token</label>
                    <input
                        type="password"
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        placeholder="Your Jira API token"
                        className="input"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Key</label>
                    <input
                        type="text"
                        value={projectKey}
                        onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                        placeholder="PROJ"
                        className="input"
                    />
                </div>

                <button
                    onClick={() => configureMutation.mutate()}
                    disabled={!isValid || configureMutation.isPending}
                    className="btn btn-primary disabled:opacity-50"
                >
                    {configureMutation.isPending ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}

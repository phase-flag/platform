import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import axios from 'axios'

export default function Settings() {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('auth_token') || '')
    const [showKey, setShowKey] = useState(false)
    const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [testMessage, setTestMessage] = useState('')

    function handleSaveKey() {
        if (apiKey.trim()) {
            localStorage.setItem('auth_token', apiKey.trim())
        } else {
            localStorage.removeItem('auth_token')
        }
    }

    async function handleTestConnection() {
        setTestStatus('loading')
        try {
            const healthUrl = apiUrl.replace(/\/api\/v1\/?$/, '') + '/health'
            const res = await axios.get(healthUrl)
            if (res.status === 200) {
                setTestStatus('success')
                setTestMessage('Connection successful')
            } else {
                setTestStatus('error')
                setTestMessage(`Unexpected status: ${res.status}`)
            }
        } catch (err) {
            setTestStatus('error')
            setTestMessage((err as Error)?.message || 'Connection failed')
        }
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Configure API connection and authentication</p>
            </div>

            <div className="max-w-2xl space-y-8">
                {/* API URL */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">API Configuration</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL</label>
                            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300">
                                {apiUrl}
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Set via VITE_API_URL environment variable
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                API Key / Auth Token
                            </label>
                            <div className="flex items-center space-x-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter your API key"
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                                    >
                                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <button
                                    onClick={handleSaveKey}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                                >
                                    Save
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Stored in localStorage. Used as Bearer token for API requests.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Test Connection */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Connection Test</h2>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={handleTestConnection}
                            disabled={testStatus === 'loading'}
                            className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
                        >
                            {testStatus === 'loading' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            <span>Test Connection</span>
                        </button>
                        {testStatus === 'success' && (
                            <div className="flex items-center text-success-600 text-sm">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {testMessage}
                            </div>
                        )}
                        {testStatus === 'error' && (
                            <div className="flex items-center text-red-600 text-sm">
                                <XCircle className="w-4 h-4 mr-1" />
                                {testMessage}
                            </div>
                        )}
                    </div>
                </div>

                {/* Environment Info */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Environment</h2>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                            <span className="text-sm text-gray-600 dark:text-gray-400">VITE_API_URL</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                {import.meta.env.VITE_API_URL || '(not set)'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Mode</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                {import.meta.env.MODE}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Base URL</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                                {import.meta.env.BASE_URL}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'register'

export default function Login() {
    const { login } = useAuth()
    const [mode, setMode] = useState<Mode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!email.trim() || !password.trim()) {
            setError('Email and password are required')
            return
        }
        if (mode === 'register' && !name.trim()) {
            setError('Name is required')
            return
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setLoading(true)
        setError('')

        try {
            const baseUrl = import.meta.env.VITE_API_URL || '/api/v1'
            const endpoint = mode === 'register' ? '/auth/register' : '/auth/login'
            const body = mode === 'register'
                ? { email: email.trim(), password, name: name.trim() }
                : { email: email.trim(), password }

            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                const data = await res.json()
                login(data.token, data.user)
            } else if (res.status === 409) {
                setError('Email already registered')
            } else if (res.status === 401) {
                setError('Invalid email or password')
            } else if (res.status === 422) {
                const data = await res.json()
                const detail = data?.detail
                if (Array.isArray(detail)) {
                    setError(detail[0]?.msg || 'Validation error')
                } else {
                    setError(typeof detail === 'string' ? detail : 'Validation error')
                }
            } else {
                setError('Something went wrong. Please try again.')
            }
        } catch {
            setError('Cannot reach the API server')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-800 rounded-2xl flex items-center justify-center mb-4">
                        <svg className="w-7 h-10" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1" y="1" width="10" height="22" rx="5" stroke="white" strokeWidth="1.4" />
                            <circle cx="6" cy="7.5" r="3" stroke="white" strokeWidth="1.4" />
                        </svg>
                    </div>
                    <h1 className="flex items-center justify-center gap-2 text-3xl brand-text text-primary-700 dark:text-primary-300">
                        PHASE
                        <svg className="w-[18px] h-[32px]" viewBox="0 0 12 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1" y="1" width="10" height="22" rx="5" stroke="#6366F1" strokeWidth="1.4" />
                            <circle cx="6" cy="7.5" r="3" stroke="#6366F1" strokeWidth="1.4" />
                        </svg>
                        FLAG
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); setError('') }}
                                    placeholder="Your name"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError('') }}
                                placeholder="you@example.com"
                                autoFocus
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                                    placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter password'}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:text-gray-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                            {loading
                                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                                : (mode === 'login' ? 'Sign In' : 'Create Account')
                            }
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                            {mode === 'login'
                                ? "Don't have an account? Register"
                                : 'Already have an account? Sign in'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createElement } from 'react'
import { pfClient, type EvalResult } from '@/lib/phaseflag'
import { DEMO_USERS, type User } from '@/lib/mock-data'

interface PhaseFlagContextValue {
    currentUser: User
    setCurrentUser: (user: User) => void
    environment: string
    setEnvironment: (env: string) => void
    flagValues: Record<string, unknown>
    flagResults: EvalResult[]
    sseConnected: boolean
    loading: boolean
}

const PhaseFlagContext = createContext<PhaseFlagContextValue>(null!)

export function usePhaseFlagContext() {
    return useContext(PhaseFlagContext)
}

export function PhaseFlagProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUserState] = useState<User>(DEMO_USERS[0])
    const [environment, setEnvironmentState] = useState('development')
    const [flagValues, setFlagValues] = useState<Record<string, unknown>>({})
    const [flagResults, setFlagResults] = useState<EvalResult[]>([])
    const [sseConnected, setSseConnected] = useState(false)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(() => {
        const results = pfClient.getAllEvaluations()
        const values: Record<string, unknown> = {}
        for (const r of results) {
            values[r.key] = r.value
        }
        setFlagValues(values)
        setFlagResults(results)
        setSseConnected(pfClient.sseConnected)
        setLoading(pfClient.loading)
    }, [])

    // Initialize client
    useEffect(() => {
        pfClient.setContext({
            userId: currentUser.id,
            attributes: {
                email: currentUser.email,
                plan: currentUser.plan,
                role: currentUser.role,
                tasks_completed: currentUser.tasksCompleted,
                account_age_days: currentUser.accountAgeDays,
            },
        })

        pfClient.init('admin@phaseflag.dev', 'PhaseFlag2026!').then(() => {
            refresh()
        })

        const unsub = pfClient.subscribe(refresh)
        return () => {
            unsub()
            pfClient.destroy()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const setCurrentUser = useCallback((user: User) => {
        setCurrentUserState(user)
        pfClient.setContext({
            userId: user.id,
            attributes: {
                email: user.email,
                plan: user.plan,
                role: user.role,
                tasks_completed: user.tasksCompleted,
                account_age_days: user.accountAgeDays,
            },
        })
        refresh()
    }, [refresh])

    const setEnvironment = useCallback((env: string) => {
        setEnvironmentState(env)
        pfClient.setEnvironment(env)
    }, [])

    return createElement(PhaseFlagContext.Provider, {
        value: { currentUser, setCurrentUser, environment, setEnvironment, flagValues, flagResults, sseConnected, loading },
    }, children)
}

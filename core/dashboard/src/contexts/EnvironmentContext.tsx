import { createContext, useContext, useState, type ReactNode } from 'react'

type Environment = 'development' | 'staging' | 'production'

interface EnvironmentContextValue {
    environment: Environment
    setEnvironment: (env: Environment) => void
}

const EnvironmentContext = createContext<EnvironmentContextValue>({
    environment: 'production',
    setEnvironment: () => {},
})

export function EnvironmentProvider({ children }: { children: ReactNode }) {
    const [environment, setEnvironment] = useState<Environment>(() => {
        const stored = localStorage.getItem('phaseflag_environment')
        return (stored as Environment) || 'production'
    })

    const handleSetEnvironment = (env: Environment) => {
        localStorage.setItem('phaseflag_environment', env)
        setEnvironment(env)
    }

    return (
        <EnvironmentContext.Provider value={{ environment, setEnvironment: handleSetEnvironment }}>
            {children}
        </EnvironmentContext.Provider>
    )
}

export function useEnvironment() {
    return useContext(EnvironmentContext)
}

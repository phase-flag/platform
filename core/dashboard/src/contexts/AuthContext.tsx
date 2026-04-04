import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface AuthUser {
    id: string
    email: string
    name: string
    role: string
}

interface AuthContextValue {
    isAuthenticated: boolean
    token: string | null
    user: AuthUser | null
    login: (token: string, user: AuthUser) => void
    logout: () => void
}

const AuthContext = createContext<AuthContextValue>({
    isAuthenticated: false,
    token: null,
    user: null,
    login: () => {},
    logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem('auth_token')
    })
    const [user, setUser] = useState<AuthUser | null>(() => {
        const stored = localStorage.getItem('auth_user')
        return stored ? JSON.parse(stored) : null
    })

    const login = useCallback((newToken: string, newUser: AuthUser) => {
        localStorage.setItem('auth_token', newToken)
        localStorage.setItem('auth_user', JSON.stringify(newUser))
        setToken(newToken)
        setUser(newUser)
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        setToken(null)
        setUser(null)
    }, [])

    const isAuthenticated = !!token

    return (
        <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}

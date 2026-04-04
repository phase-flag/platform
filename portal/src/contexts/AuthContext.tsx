import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pf_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pf_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check token expiry on mount
  useEffect(() => {
    if (token) {
      const exp = parseJwtExpiry(token);
      if (exp && exp * 1000 < Date.now()) {
        logout();
      }
    }
  }, []);

  function persist(newToken: string, newUser: User) {
    localStorage.setItem('pf_token', newToken);
    localStorage.setItem('pf_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Login failed');
      }
      const data = await res.json();
      const jwt = data.access_token ?? data.token;
      persist(jwt, data.user);
    } finally {
      setIsLoading(false);
    }
  }

  async function signup(name: string, email: string, password: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Registration failed');
      }
      const data = await res.json();
      const jwt = data.access_token ?? data.token;
      persist(jwt, data.user);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, login, signup, logout, isAuthenticated: !!token, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

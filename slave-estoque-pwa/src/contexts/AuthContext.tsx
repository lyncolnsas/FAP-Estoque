import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
  departamento?: string;
  whatsapp?: string;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('@SlaveEstoque:token');
    if (storedToken) {
      setToken(storedToken);
      fetch(api('/auth/me'), {
        headers: { Authorization: `Bearer ${storedToken}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(userData => setUser(userData))
      .catch(() => {
        localStorage.removeItem('@SlaveEstoque:token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('@SlaveEstoque:token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('@SlaveEstoque:token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import React, { createContext, useCallback, useContext, useState } from 'react';
import { api, isAuthenticated, setTokens } from '../api/client';

interface AuthContextValue {
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken } = await api.login(email, password);
    setTokens(accessToken, refreshToken);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setTokens(null, null);
    setAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

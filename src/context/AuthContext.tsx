import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'ossmnf2024';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';
const AUTH_KEY = 'ossmnf_auth';
const ADMIN_KEY = 'ossmnf_admin';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
    const adminStored = sessionStorage.getItem(ADMIN_KEY);
    if (adminStored === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const login = (password: string): boolean => {
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setIsAdmin(true);
      sessionStorage.setItem(AUTH_KEY, 'true');
      sessionStorage.setItem(ADMIN_KEY, 'true');
      return true;
    }
    if (password === APP_PASSWORD) {
      setIsAuthenticated(true);
      setIsAdmin(false);
      sessionStorage.setItem(AUTH_KEY, 'true');
      sessionStorage.removeItem(ADMIN_KEY);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

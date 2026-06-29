import { createContext, useContext, useState, ReactNode } from 'react';
import api from '../utils/api';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
  isGuest?: boolean;
}

interface AuthContextValue {
  user: User | null;
  login: (userData: User, token: string) => void;
  guestLogin: (userData: User, token: string) => void;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUser(): User | null {
  try {
    // 通常ログイン（localStorage）
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      const payload = JSON.parse(atob(token.split('.')[1])) as { exp: number };
      if (payload.exp * 1000 >= Date.now()) {
        return JSON.parse(stored) as User;
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    // ゲストログイン（sessionStorage）
    const guestToken = sessionStorage.getItem('token');
    const guestStored = sessionStorage.getItem('user');
    if (guestToken && guestStored) {
      const payload = JSON.parse(atob(guestToken.split('.')[1])) as { exp: number };
      if (payload.exp * 1000 >= Date.now()) {
        return JSON.parse(guestStored) as User;
      }
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }

    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const login = (userData: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const guestLogin = (userData: User, token: string) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const updateUser = (partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      if (prev.isGuest) {
        sessionStorage.setItem('user', JSON.stringify(updated));
      } else {
        localStorage.setItem('user', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const logout = async () => {
    if (user?.isGuest) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      setUser(null);
      return;
    }
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, guestLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

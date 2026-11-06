'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: 'ADMIN' | 'STAFF';
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (isInitial = false) => {
    try {
      // Check cache in sessionStorage for instant 0ms restore
      if (isInitial && typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('jj_mall_user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setUser(parsed);
            setLoading(false);
          } catch (e) {}
        }
      }

      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('jj_mall_user', JSON.stringify(data.user));
          }
        } else {
          setUser(null);
          if (typeof window !== 'undefined') sessionStorage.removeItem('jj_mall_user');
          router.push('/login');
        }
      } else {
        setUser(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem('jj_mall_user');
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser(true);
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setUser(null);
    if (typeof window !== 'undefined') sessionStorage.removeItem('jj_mall_user');
    router.push('/login');
    router.refresh();
  };

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        logout,
        refreshUser: () => fetchUser(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

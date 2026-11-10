'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

/**
 * แยก Key จัดเก็บธีมตาม Role อย่างเด็ดขาด:
 * - Admin (ผู้ดูแลระบบ): 'jj_mall_theme_ADMIN'
 * - Staff (จุดขาย/ร้านค้า): 'jj_mall_theme_STAFF'
 * - หน้าทั่วไป (Login / อื่นๆ): 'jj_mall_theme_DEFAULT'
 */
export function getThemeStorageKey(pathname?: string | null, userRole?: string): string {
  if (pathname?.startsWith('/admin') || userRole === 'ADMIN') {
    return 'jj_mall_theme_ADMIN';
  }
  if (pathname?.startsWith('/staff') || userRole === 'STAFF') {
    return 'jj_mall_theme_STAFF';
  }
  return 'jj_mall_theme_DEFAULT';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Apply theme to HTML document
  const applyTheme = useCallback((targetTheme: Theme) => {
    let effectiveTheme: ResolvedTheme = 'light';

    if (targetTheme === 'system') {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    } else {
      effectiveTheme = targetTheme;
    }

    setResolvedTheme(effectiveTheme);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }
    }
  }, []);

  // When pathname or user role changes, automatically switch to that Role's stored preference
  useEffect(() => {
    setMounted(true);

    // หน้าร้านค้า / POS (/staff/*) ล็อกให้เป็นโหมดสว่างเสมอ 100% แม้ admin จะปรับมืดก็ตาม
    if (pathname?.startsWith('/staff') || user?.role === 'STAFF') {
      setThemeState('light');
      applyTheme('light');
      return;
    }

    const key = getThemeStorageKey(pathname, user?.role);
    const saved = localStorage.getItem(key);
    // If no specific role theme saved yet, fallback to legacy key or default light
    const fallback = localStorage.getItem('jj_mall_theme');
    const roleTheme: Theme = (saved as Theme) || (fallback as Theme) || 'light';

    setThemeState(roleTheme);
    applyTheme(roleTheme);
  }, [pathname, user?.role, applyTheme]);

  // Listen to system preference changes if active role's theme is 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const key = getThemeStorageKey(pathname, user?.role);
      const current = (localStorage.getItem(key) as Theme) || 'light';
      if (current === 'system') {
        const newEffective = e.matches ? 'dark' : 'light';
        setResolvedTheme(newEffective);
        const root = document.documentElement;
        if (newEffective === 'dark') {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.setAttribute('data-theme', 'light');
          root.style.colorScheme = 'light';
        }
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [pathname, user?.role]);

  // Set theme ONLY for the active role (หน้าร้าน staff จะถูกล็อกไว้ที่ light เสมอ)
  const setTheme = (newTheme: Theme) => {
    if (pathname?.startsWith('/staff') || user?.role === 'STAFF') {
      setThemeState('light');
      applyTheme('light');
      return;
    }

    const key = getThemeStorageKey(pathname, user?.role);
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, newTheme);
    }
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    if (pathname?.startsWith('/staff') || user?.role === 'STAFF') {
      return; // หน้าร้านค้าล็อกโหมดสว่างถาวร
    }
    const nextTheme: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

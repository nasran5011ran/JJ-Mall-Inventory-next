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
 * จัดการ Key จัดเก็บธีมตาม Role:
 * - Admin (ผู้ดูแลระบบ): 'jj_mall_theme_ADMIN' (สามารถสลับโหมดมืด/สว่างได้)
 * - หน้าอื่นๆ ทั้งหมด (Login, Staff / จุดขาย, ฯลฯ): บังคับโหมดสว่าง (Light Mode) 100% เสมอ
 */
export function getThemeStorageKey(pathname?: string | null, userRole?: string): string {
  if (pathname?.startsWith('/admin')) {
    return 'jj_mall_theme_ADMIN';
  }
  return 'jj_mall_theme_LIGHT';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Apply theme to HTML document
  const applyTheme = useCallback((targetTheme: Theme, isAdminPath: boolean) => {
    let effectiveTheme: ResolvedTheme = 'light';

    // ถ้าไม่ใช่เส้นทาง /admin บังคับให้เป็น 'light' 100% เสมอ
    if (isAdminPath) {
      if (targetTheme === 'system') {
        const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
      } else {
        effectiveTheme = targetTheme;
      }
    } else {
      effectiveTheme = 'light';
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

    const isAdminPath = Boolean(pathname?.startsWith('/admin'));

    // หน้าเข้าสู่ระบบ (/login), หน้าร้านค้า / POS (/staff/*) และหน้าสาธารณะทั้งหมด ล็อกให้เป็นโหมดสว่างเสมอ 100%
    if (!isAdminPath) {
      setThemeState('light');
      applyTheme('light', false);
      return;
    }

    // เฉพาะเส้นทาง /admin เท่านั้นที่ดึงธีมของผู้ดูแลระบบ
    const saved = localStorage.getItem('jj_mall_theme_ADMIN');
    const adminTheme: Theme = (saved as Theme) || 'light';

    setThemeState(adminTheme);
    applyTheme(adminTheme, true);
  }, [pathname, applyTheme]);

  // Listen to system preference changes ONLY when in /admin and theme is 'system'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isAdminPath = Boolean(pathname?.startsWith('/admin'));
    if (!isAdminPath) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const current = (localStorage.getItem('jj_mall_theme_ADMIN') as Theme) || 'light';
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
  }, [pathname]);

  // Set theme ONLY for the Admin
  const setTheme = (newTheme: Theme) => {
    const isAdminPath = Boolean(pathname?.startsWith('/admin'));
    if (!isAdminPath) {
      setThemeState('light');
      applyTheme('light', false);
      return;
    }

    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('jj_mall_theme_ADMIN', newTheme);
    }
    applyTheme(newTheme, true);
  };

  const toggleTheme = () => {
    const isAdminPath = Boolean(pathname?.startsWith('/admin'));
    if (!isAdminPath) {
      return; // หน้าที่ไม่ใช่แอดมินล็อกโหมดสว่างถาวร
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

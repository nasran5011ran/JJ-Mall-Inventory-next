'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/theme-context';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 animate-pulse ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
        isDark
          ? 'bg-slate-800 text-amber-400 hover:bg-slate-700 border border-slate-700 shadow-sm hover:shadow-amber-500/10'
          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs hover:text-amber-600'
      } ${className}`}
      title={isDark ? 'เปลี่ยนเป็นโหมดสว่าง (Switch to Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Switch to Dark Mode)'}
      aria-label="สลับธีม สว่าง / มืด"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Moon className="w-4 h-4 text-amber-300 transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 rotate-0 scale-100" />
        )}
      </div>

      {showLabel && (
        <span className="ml-2 text-xs font-bold">
          {isDark ? 'โหมดมืด (Dark)' : 'โหมดสว่าง (Light)'}
        </span>
      )}
    </button>
  );
}

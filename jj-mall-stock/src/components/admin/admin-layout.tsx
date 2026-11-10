'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import AdminSidebar from './admin-sidebar';
import AdminNavbar from './admin-navbar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Check if current page is one of the wide tables requested by user
  const isWidePage = pathname?.includes('/admin/stock-count') || pathname?.includes('/admin/stock-transactions');

  // Route Guard: Strictly kick non-admins out, redirect to login if unauthenticated
  useEffect(() => {
    if (!loading) {
      if (!user) {
        window.location.href = '/login';
      } else if (user.role !== 'ADMIN') {
        window.location.href = '/staff/sales';
      }
    }
  }, [user, loading]);

  // Load admin notification count in background
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data.data?.kpis) {
            const count = data.data.kpis.totalActionable || 0;
            setNotificationCount(count);
          }
        }
      } catch (e) {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 8000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">กำลังเตรียมระบบ Admin JJ Mall...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex">
      {/* Admin Dedicated Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72 transition-all">
        <AdminNavbar
          onOpenSidebar={() => setSidebarOpen(true)}
          notificationCount={notificationCount}
        />

        <main
          className={`flex-1 p-3 sm:p-5 lg:p-6 w-full mx-auto transition-all ${
            isWidePage
              ? 'max-w-none px-3 sm:px-5 lg:px-6'
              : 'max-w-7xl'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import StaffNavbar from './staff-navbar';

interface StaffLayoutProps {
  children: React.ReactNode;
}

export default function StaffLayout({ children }: StaffLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isWidePage = pathname?.includes('/staff/stock-adjustments');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role === 'ADMIN') {
        // ผู้ดูแลระบบ (Admin) ไม่มีหน้าที่ขายสินค้าหน้าร้าน ส่งไปยังหน้ารายงานยอดขายประจำวัน
        router.replace('/admin/reports/sales');
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    // หน้าร้านค้า / POS บังคับให้อยู่ในโหมดสว่างเสมอ 100% แม้แอดมินจะเปิดโหมดมืด
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  if (loading || !user || user.role === 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">กำลังเตรียมระบบขายหน้าร้าน JJ Mall POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col">
      {/* Dedicated Staff Header (Full width, no distracting admin sidebar!) */}
      <StaffNavbar />

      {/* Main POS Workspace */}
      <main
        className={`flex-1 p-3 sm:p-5 w-full mx-auto transition-all ${
          isWidePage ? 'max-w-none px-3 sm:px-6 lg:px-8' : 'max-w-7xl'
        }`}
      >
        {children}
      </main>
    </div>
  );
}

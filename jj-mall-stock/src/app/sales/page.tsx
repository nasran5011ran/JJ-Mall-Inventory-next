'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function SalesRedirectPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    // Role-based destination: Admin manages/inspects sales reports; Staff sells at POS
    if (user.role === 'ADMIN') {
      router.replace('/admin/reports/sales');
    } else {
      router.replace('/staff/sales');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">กำลังเปลี่ยนเส้นทางไปยังระบบการขายที่ถูกต้อง...</p>
      </div>
    </div>
  );
}

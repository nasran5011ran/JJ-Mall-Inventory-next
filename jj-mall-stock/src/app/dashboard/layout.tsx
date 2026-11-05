import React from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';

export const metadata = {
  title: 'Dashboard - JJ Mall Inventory & Stock Management',
  description: 'แผงควบคุมระบบจัดการสต็อกและยอดขาย บริษัท JJ Mall',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

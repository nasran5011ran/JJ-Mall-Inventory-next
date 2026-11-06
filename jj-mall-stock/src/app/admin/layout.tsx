import React from 'react';
import AdminLayout from '@/components/admin/admin-layout';

export const metadata = {
  title: '👑 Admin Portal - JJ Mall Inventory & Stock Management',
  description: 'แผงควบคุมผู้ดูแลระบบระดับสูงสุด บริษัท JJ Mall',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

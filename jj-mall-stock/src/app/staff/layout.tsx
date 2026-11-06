import React from 'react';
import StaffLayout from '@/components/staff/staff-layout';

export const metadata = {
  title: '👤 POS Terminal - JJ Mall Sales Staff',
  description: 'ระบบจุดขายหน้าร้านสำหรับเจ้าหน้าที่ขาย บริษัท JJ Mall',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StaffLayout>{children}</StaffLayout>;
}

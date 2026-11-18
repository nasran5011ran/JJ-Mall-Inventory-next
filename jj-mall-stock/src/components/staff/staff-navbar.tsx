'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart,
  ShoppingBag,
  Package,
  ClipboardCheck,
  FileEdit,
  ArrowUpFromLine,
  Clock,
  LogOut,
  Coffee,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

export default function StaffNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { href: '/staff/sales', label: 'ขาย (POS)', shortLabel: 'ขาย POS', icon: ShoppingCart },
    { href: '/staff/history', label: 'ประวัติขาย', shortLabel: 'ประวัติ', icon: ShoppingBag },
    { href: '/staff/products', label: 'สินค้า/เมนู', shortLabel: 'สินค้า', icon: Package },
    { href: '/staff/stock-requests', label: 'ขอเบิก', shortLabel: 'ขอเบิก', icon: ArrowUpFromLine },
    { href: '/staff/stock-count', label: 'นับสต็อก', shortLabel: 'นับสต็อก', icon: ClipboardCheck },
    { href: '/staff/stock-adjustments', label: 'ปรับสต็อก', shortLabel: 'ปรับสต็อก', icon: FileEdit },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs w-full overflow-hidden">
      {/* Top Banner (ธีมสีฟ้าเดิม ป้องกันล้นจอ) */}
      <div className="px-3 sm:px-6 py-1.5 bg-gradient-to-r from-sky-600 via-teal-600 to-sky-700 text-white flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-bold truncate">ระบบขายหน้าร้าน JJ Mall POS</span>
          <span className="hidden sm:inline text-sky-200 truncate">• โหมดเจ้าหน้าที่ขาย (Staff Terminal)</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono font-bold text-sky-100 text-[11px] shrink-0 pl-2">
          <Clock className="w-3.5 h-3.5" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Main Bar: จัดเต็มความกว้าง ไม่หลุดขอบ ไม่ดันปุ่มออกจากจอ */}
      <div className="px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 max-w-full">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/staff/sales" className="flex items-center gap-2">
            <div className="relative w-24 h-8 sm:w-28 sm:h-9 lg:w-32 lg:h-10">
              <Image
                src="/images/logo.png"
                alt="JJ Mall"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
          </Link>
        </div>

        {/* Staff Quick Nav Tabs (เฉพาะจอใหญ่ >= 1024px พอดีในแถวเดียว) */}
        <nav className="hidden lg:flex items-center gap-1 shrink">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/staff' && pathname.startsWith(link.href + '/'));

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Staff Cashier Info & Logout (มี max-width กำกับ ไม่หลุดขอบขวาแน่นอน) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-2 pl-2 sm:pl-2.5 pr-1 py-1 rounded-2xl bg-sky-50 border border-sky-200 shadow-2xs">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
              <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="text-left leading-tight pr-1">
              <div
                className="text-xs font-bold text-slate-800 max-w-[100px] sm:max-w-[130px] lg:max-w-[160px] truncate"
                title={user?.name || 'คอฟฟี่-เจเจ มอลล์(จตุจักร)'}
              >
                {user?.name || 'ร้านค้าหน้าร้าน'}
              </div>
              <div className="text-[9.5px] font-semibold text-sky-700 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>พนักงาน (Staff)</span>
              </div>
            </div>

            <div className="w-px h-5 sm:h-6 bg-sky-200 mx-0.5" />

            <button
              onClick={logout}
              className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub Nav Tabs (สำหรับจอ < 1024px เช่น จอแท็บเล็ต หรือเปิดหน้าต่างคู่กับ DevTools) */}
      <div className="grid grid-cols-6 lg:hidden border-t border-slate-100 px-1 py-1.5 gap-1 bg-white">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== '/staff' && pathname.startsWith(link.href + '/'));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`py-1.5 px-0.5 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 text-center transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate w-full text-[9px] leading-tight">
                {link.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

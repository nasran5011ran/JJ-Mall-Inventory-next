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
    { href: '/staff/sales', label: 'ขายหน้าร้าน (POS)', shortLabel: 'ขาย POS', icon: ShoppingCart },
    { href: '/staff/history', label: 'ประวัติการขาย', shortLabel: 'ประวัติ', icon: ShoppingBag },
    { href: '/staff/products', label: 'สินค้าและเมนู', shortLabel: 'สินค้า', icon: Package },
    { href: '/staff/stock-requests', label: 'ขอเบิกสต็อก', shortLabel: 'ขอเบิก', icon: ArrowUpFromLine },
    { href: '/staff/stock-count', label: 'ตรวจนับสต็อก', shortLabel: 'นับสต็อก', icon: ClipboardCheck },
    { href: '/staff/stock-adjustments', label: 'ขอปรับสต็อก', shortLabel: 'ปรับสต็อก', icon: FileEdit },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner (ธีมสีเดิม ฟ้า-ฟ้าอมเขียว) */}
      <div className="px-4 sm:px-6 py-1.5 bg-gradient-to-r from-sky-600 via-teal-600 to-sky-700 text-white flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">ระบบขายหน้าร้าน JJ Mall POS</span>
          <span className="hidden sm:inline text-sky-200">• โหมดเจ้าหน้าที่ขาย (Staff Terminal)</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono font-bold text-sky-100 text-[11px]">
          <Clock className="w-3.5 h-3.5" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Main Bar (ไม่เลื่อน พอดีจอทุกขนาด) */}
      <div className="px-3 sm:px-6 h-15 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/staff/sales" className="flex items-center gap-2">
            <div className="relative w-28 h-9 sm:w-32 sm:h-10">
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

        {/* Staff Quick Nav Tabs (ไม่มี overflow-x-auto ไม่ต้องเลื่อน) */}
        <nav className="hidden md:flex items-center gap-1 shrink-0">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/staff' && pathname.startsWith(link.href + '/'));

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={`px-2.5 lg:px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
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

        {/* Staff Cashier Info & Logout (สีฟ้าเดิม สวยงาม กะทัดรัด ไม่ดันเมนู) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-2xl bg-sky-50 border border-sky-200 shadow-2xs">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
              <Coffee className="w-4 h-4" />
            </div>
            <div className="text-left leading-tight pr-1">
              <div className="text-xs font-bold text-slate-800 max-w-[100px] sm:max-w-[140px] lg:max-w-[180px] truncate" title={user?.name}>
                {user?.name || 'คอฟฟี่-เจเจ มอลล์(จตุจักร)'}
              </div>
              <div className="text-[10px] font-semibold text-sky-700 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>พนักงานขาย (Staff)</span>
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

      {/* Mobile Nav Tabs (จัด 6 คอลัมน์พอดีหน้าจอ 100% ไม่ต้องเลื่อนสไลด์) */}
      <div className="grid grid-cols-6 md:hidden border-t border-slate-100 px-1 py-1.5 gap-1 bg-white">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

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

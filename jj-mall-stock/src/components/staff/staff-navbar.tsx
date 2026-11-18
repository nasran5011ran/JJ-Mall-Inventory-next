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
    { href: '/staff/sales', label: 'ขายหน้าร้าน (POS)', icon: ShoppingCart },
    { href: '/staff/history', label: 'ประวัติการขาย', icon: ShoppingBag },
    { href: '/staff/products', label: 'สินค้าและเมนู', icon: Package },
    { href: '/staff/stock-requests', label: 'ขอเบิกสต็อก', icon: ArrowUpFromLine },
    { href: '/staff/stock-count', label: 'ตรวจนับสต็อก', icon: ClipboardCheck },
    { href: '/staff/stock-adjustments', label: 'ขอปรับสต็อก', icon: FileEdit },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      {/* Top Banner */}
      <div className="px-4 sm:px-6 py-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-200">JJ Mall POS Terminal</span>
          <span className="hidden sm:inline text-slate-400">• โหมดเจ้าหน้าที่ขายหน้าร้าน</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono font-bold text-slate-300">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
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

        {/* Staff Quick Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/staff' && pathname.startsWith(link.href + '/'));

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Staff Cashier Info & Logout */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2.5 pl-2.5 pr-1.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Coffee className="w-4 h-4" />
            </div>
            <div className="text-left leading-tight pr-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span
                  className="text-xs font-bold text-slate-800 max-w-[110px] sm:max-w-[150px] lg:max-w-[190px] truncate"
                  title={user?.name || 'คอฟฟี่-เจเจ มอลล์(จตุจักร)'}
                >
                  {user?.name || 'ร้านค้าหน้าร้าน'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  หน้าร้าน
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  Staff
                </span>
              </div>
            </div>

            <div className="w-px h-6 bg-slate-200 mx-0.5" />

            <button
              onClick={logout}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="flex md:hidden border-t border-slate-100 px-2 py-1.5 overflow-x-auto gap-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

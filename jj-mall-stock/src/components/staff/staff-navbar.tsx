'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingCart,
  ShoppingBag,
  Package,
  ClipboardCheck,
  FileEdit,
  ArrowDownToLine,
  Clock,
  LogOut,
  User,
  Coffee,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

export default function StaffNavbar() {
  const pathname = usePathname();
  const router = useRouter();
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
    { href: '/staff/sales', label: 'จุดขายหน้าร้าน (POS)', icon: ShoppingCart },
    { href: '/staff/history', label: 'ประวัติการขายของฉัน', icon: ShoppingBag },
    { href: '/staff/products', label: 'เช็คราคาสินค้า', icon: Package },
    { href: '/staff/stock-requests', label: 'ใบขอเบิกสต็อก', icon: ArrowDownToLine },
    { href: '/staff/stock-count', label: 'บันทึกตรวจนับสต็อก', icon: ClipboardCheck },
    { href: '/staff/stock-adjustments', label: 'สร้างใบขอปรับสต็อก', icon: FileEdit },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner */}
      <div className="px-4 sm:px-6 py-2 bg-gradient-to-r from-sky-600 via-teal-600 to-sky-700 text-white flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">ระบบขายหน้าร้าน JJ Mall POS</span>
          <span className="hidden sm:inline text-sky-200">• โหมดเจ้าหน้าที่ขาย (Staff Terminal)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono font-bold text-sky-100 text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      {/* Main Bar */}
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/staff/sales" className="flex items-center gap-2">
            <div className="relative w-32 h-10">
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
        <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/staff' && pathname.startsWith(link.href + '/'));

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Staff Cashier Info & Logout */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200">
            <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800">{user?.name}</div>
              <div className="text-[10px] font-semibold text-sky-700">พนักงานขาย (Staff)</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
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
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

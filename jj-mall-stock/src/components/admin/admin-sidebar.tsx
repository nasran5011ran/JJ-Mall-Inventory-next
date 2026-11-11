'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  LayoutDashboard,
  Bell,
  Package,
  Layers,
  ChefHat,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  FileEdit,
  History,
  TrendingUp,
  FileSpreadsheet,
  Wheat,
  Users,
  Settings,
  X,
  ChevronRight,
  ShieldAlert,
  Crown,
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // Fetch real-time pending adjustments and alerts count
  const { data: notifData } = useSWR(
    '/api/notifications',
    (url: string) => fetch(url).then((res) => res.json()),
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  const pendingAdjustmentsCount = Number(notifData?.data?.kpis?.pendingAdjustmentsCount || 0);
  const lowIngredientsCount =
    Number(notifData?.data?.kpis?.outOfStockCount || 0) +
    Number(notifData?.data?.kpis?.lowStockCount || 0);

  const menuSections = [
    {
      title: 'ผู้บริหาร & สรุปผล',
      items: [
        { href: '/admin/dashboard', label: 'Dashboard ผู้บริหาร', icon: LayoutDashboard },
      ],
    },
    {
      title: 'จัดการสินค้า & สูตรการผลิต',
      items: [
        { href: '/admin/products', label: 'จัดการสินค้า & ราคา', icon: Package },
        { href: '/admin/ingredients', label: 'จัดการคลังวัตถุดิบ', icon: Layers },
        { href: '/admin/recipes', label: 'สูตรการผลิต (BOM)', icon: ChefHat },
      ],
    },
    {
      title: 'งานคลัง & การอนุมัติ',
      items: [
        { href: '/admin/stock-in', label: 'รับสินค้าเข้าคลัง (ซื้อเข้า)', icon: ArrowDownToLine },
        { href: '/admin/stock-out', label: 'เบิกจ่ายสินค้าไปหน้าร้าน', icon: ArrowUpFromLine },
        { href: '/admin/stock-count', label: 'ตรวจนับสินค้าจริง', icon: ClipboardCheck },
        { href: '/admin/stock-adjustments', label: 'อนุมัติใบปรับปรุงสต็อก', icon: FileEdit },
        { href: '/admin/stock-transactions', label: 'ประวัติเคลื่อนไหวสต็อก', icon: History },
      ],
    },
    {
      title: 'รายงาน & การเงิน',
      items: [
        { href: '/admin/reports/sales', label: 'รายงานยอดขายประจำวัน', icon: TrendingUp },
        { href: '/admin/reports/stock', label: 'รายงานสต็อกและมูลค่าสินค้า', icon: FileSpreadsheet },
        { href: '/admin/reports/ingredients', label: 'รายงานวัตถุดิบที่ใช้', icon: Wheat },
      ],
    },
    {
      title: 'ผู้ใช้งาน & ตั้งค่าระบบ',
      items: [
        { href: '/admin/users', label: 'จัดการผู้ใช้งานระบบ', icon: Users },
        { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 px-6 border-b border-slate-100 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2 group">
            <div className="relative w-36 h-12 transition-transform group-hover:scale-102">
              <Image
                src="/images/logo.png"
                alt="JJ Mall"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 👑 Crown Admin Identity Banner */}
        <div className="px-5 py-3 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center font-bold shadow-xs">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wide">ผู้ดูแลระบบสูงสุด</div>
              <div className="text-[10px] text-emerald-200 font-medium">ADMIN CONSOLE</div>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">
          {menuSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
                const isAdjustment = item.href === '/admin/stock-adjustments';
                const isIngredients = item.href === '/admin/ingredients';
                const badgeCount = isAdjustment ? pendingAdjustmentsCount : isIngredients ? lowIngredientsCount : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      isActive
                        ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/30 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-emerald-700'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {badgeCount > 0 && (
                        <span
                          className="px-2 py-0.5 min-w-[20px] h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs"
                          title={
                            isAdjustment
                              ? `มีใบขอปรับปรุงสต็อกรออนุมัติ ${badgeCount} รายการ`
                              : `มีวัตถุดิบคงเหลือน้อยกว่าเกณฑ์ขั้นต่ำ (Min) ${badgeCount} รายการ`
                          }
                        >
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Admin Footer Badge */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-amber-300 flex items-center justify-center shadow-xs">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">JJ Mall Admin Portal</div>
              <div className="text-[11px] font-semibold text-emerald-700">สิทธิ์: ควบคุมเต็มระบบ 100%</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

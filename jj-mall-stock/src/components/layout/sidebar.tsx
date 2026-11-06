'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Layers,
  ChefHat,
  ShoppingCart,
  ArrowDownToLine,
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
  Shield,
  User,
  ShoppingBag,
  Store,
} from 'lucide-react';

interface SidebarProps {
  userRole?: 'ADMIN' | 'STAFF';
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ userRole = 'ADMIN', isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  // เมนูแยกขาดจากกันชัดเจนระหว่าง Admin และ พนักงานขาย (Staff)
  const menuSections = userRole === 'ADMIN' ? [
    {
      title: 'ผู้บริหาร & สรุปภาพรวม',
      items: [
        { href: '/dashboard', label: 'Dashboard ผู้บริหาร', icon: LayoutDashboard },
      ],
    },
    {
      title: 'จัดการสินค้า & สูตรการผลิต (Admin)',
      items: [
        { href: '/products', label: 'จัดการสินค้า & ราคา', icon: Package },
        { href: '/ingredients', label: 'จัดการคลังวัตถุดิบ', icon: Layers },
        { href: '/recipes', label: 'จัดการสูตรการผลิต (BOM)', icon: ChefHat },
      ],
    },
    {
      title: 'งานคลัง & อนุมัติสต็อก',
      items: [
        { href: '/admin/sales', label: 'ตรวจสอบยอดขายแต่ละร้าน', icon: Store },
        { href: '/stock-in', label: 'รับสินค้าเข้าคลัง (ซื้อเข้า)', icon: ArrowDownToLine },
        { href: '/stock-count', label: 'ตรวจนับสินค้าจริง', icon: ClipboardCheck },
        { href: '/stock-adjustments', label: 'อนุมัติใบขอปรับปรุงสต็อก', icon: FileEdit },
        { href: '/stock-transactions', label: 'ประวัติเคลื่อนไหวสต็อก', icon: History },
      ],
    },
    {
      title: 'รายงาน & การเงิน',
      items: [
        { href: '/reports/sales', label: 'รายงานยอดขายประจำวัน', icon: TrendingUp },
        { href: '/reports/stock', label: 'ตารางรายงานสต็อก (DoH)', icon: FileSpreadsheet },
        { href: '/reports/ingredients', label: 'รายงานวัตถุดิบที่ใช้', icon: Wheat },
      ],
    },
    {
      title: 'ผู้ใช้งาน & ตั้งค่าระบบ',
      items: [
        { href: '/users', label: 'จัดการผู้ใช้งานระบบ', icon: Users },
        { href: '/settings', label: 'ตั้งค่าระบบ', icon: Settings },
      ],
    },
  ] : [
    // === เมนูสำหรับเจ้าหน้าที่ขาย (Staff) เท่านั้น ===
    {
      title: 'งานขายหน้าร้าน (งานหลัก)',
      items: [
        { href: '/sales', label: 'ระบบขายสินค้าหน้าร้าน (POS)', icon: ShoppingCart },
        { href: '/sales/history', label: 'ประวัติการขายของฉัน', icon: ShoppingBag },
      ],
    },
    {
      title: 'สต็อกหน้าร้าน (ดูข้อมูล & ตรวจนับ)',
      items: [
        { href: '/products', label: 'เช็คราคาสินค้า (ดูเท่านั้น)', icon: Package },
        { href: '/stock-count', label: 'บันทึกตรวจนับสต็อกจริง', icon: ClipboardCheck },
        { href: '/stock-adjustments', label: 'สร้างใบขอปรับปรุงสต็อก', icon: FileEdit },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
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
          <Link href={userRole === 'ADMIN' ? '/dashboard' : '/sales'} className="flex items-center gap-2 group">
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
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Identity Tag */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase">บทบาทของคุณ</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              userRole === 'ADMIN'
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-sky-100 text-sky-800 border border-sky-200'
            }`}
          >
            {userRole === 'ADMIN' ? '👑 ผู้ดูแลระบบ (Admin)' : '👤 เจ้าหน้าที่ขาย (Staff)'}
          </span>
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
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));

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
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Role Footer Badge */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                userRole === 'ADMIN' ? 'bg-amber-600' : 'bg-sky-600'
              }`}
            >
              {userRole === 'ADMIN' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">JJ Mall Stock System</div>
              <div className="text-[11px] font-semibold text-slate-500">
                {userRole === 'ADMIN' ? 'สิทธิ์: ควบคุมเต็มรูปแบบ' : 'สิทธิ์: ขายสินค้าและตรวจนับ'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

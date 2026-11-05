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
} from 'lucide-react';

interface SidebarProps {
  userRole?: 'ADMIN' | 'STAFF';
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ userRole = 'ADMIN', isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const menuSections = [
    {
      title: 'ภาพรวมระบบ',
      items: [
        { href: '/dashboard', label: 'Dashboard สรุปภาพรวม', icon: LayoutDashboard },
      ],
    },
    {
      title: 'สินค้า & สูตรการผลิต',
      items: [
        { href: '/products', label: 'จัดการสินค้า', icon: Package },
        { href: '/ingredients', label: 'วัตถุดิบในคลัง', icon: Layers },
        { href: '/recipes', label: 'สูตรการผลิต (BOM)', icon: ChefHat },
      ],
    },
    {
      title: 'งานขาย & คลังสินค้า',
      items: [
        { href: '/sales', label: 'ขายสินค้า (POS)', icon: ShoppingCart },
        { href: '/stock-in', label: 'รับสินค้าเข้าคลัง', icon: ArrowDownToLine },
        { href: '/stock-count', label: 'ตรวจนับสินค้าจริง', icon: ClipboardCheck },
        { href: '/stock-adjustments', label: 'ใบขอปรับปรุงสต็อก', icon: FileEdit },
        { href: '/stock-transactions', label: 'ประวัติเคลื่อนไหวสต็อก', icon: History },
      ],
    },
    {
      title: 'รายงาน & สถิติ',
      items: [
        { href: '/reports/sales', label: 'รายงานยอดขายประจำวัน', icon: TrendingUp },
        { href: '/reports/stock', label: 'ตารางรายงานสต็อก (DoH)', icon: FileSpreadsheet },
        { href: '/reports/ingredients', label: 'รายงานวัตถุดิบที่ใช้', icon: Wheat },
      ],
    },
    ...(userRole === 'ADMIN'
      ? [
          {
            title: 'ผู้ใช้งาน & ตั้งค่า',
            items: [
              { href: '/users', label: 'จัดการผู้ใช้งาน', icon: Users },
              { href: '/settings', label: 'ตั้งค่าระบบ', icon: Settings },
            ],
          },
        ]
      : []),
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
          <Link href="/dashboard" className="flex items-center gap-2 group">
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

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">
          {menuSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
                userRole === 'ADMIN' ? 'bg-emerald-600' : 'bg-sky-600'
              }`}
            >
              {userRole === 'ADMIN' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">JJ Mall Management</div>
              <div className="text-[11px] font-semibold text-emerald-600">
                {userRole === 'ADMIN' ? 'สิทธิ์: ผู้ดูแลระบบ (Admin)' : 'สิทธิ์: พนักงานขาย (Staff)'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

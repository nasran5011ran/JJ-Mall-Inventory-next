'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Bell,
  Clock,
  LogOut,
  Crown,
  ChevronDown,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Layers,
  ChefHat,
  Users,
  ShoppingBag,
  ArrowDownToLine,
  ClipboardCheck,
  FileEdit,
  FileSpreadsheet,
  TrendingUp,
  History,
  Settings,
  Store,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import ThemeToggle from '@/components/theme-toggle';

interface AdminNavbarProps {
  onOpenSidebar: () => void;
  notificationCount?: number;
}

export default function AdminNavbar({ onOpenSidebar, notificationCount = 0 }: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
      const dateStr = now.toLocaleDateString('th-TH', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic Page Title mapping: Replaces static text with current page title
  const getPageInfo = (path: string) => {
    if (path.startsWith('/admin/dashboard')) {
      return {
        title: 'แดชบอร์ดผู้บริหาร (Dashboard)',
        icon: LayoutDashboard,
      };
    }
    if (path.startsWith('/admin/products')) {
      return {
        title: 'จัดการสินค้าและเมนูขาย (Products & Menu)',
        icon: Package,
      };
    }
    if (path.startsWith('/admin/ingredients')) {
      return {
        title: 'จัดการคลังวัตถุดิบ (Raw Materials & Inventory)',
        icon: Layers,
      };
    }
    if (path.startsWith('/admin/recipes')) {
      return {
        title: 'สูตรการผลิตสินค้า (BOM – Bill of Materials)',
        icon: ChefHat,
      };
    }
    if (path.startsWith('/admin/users')) {
      return {
        title: 'จัดการผู้ใช้งานระบบ (User & Role Management)',
        icon: Users,
      };
    }
    if (path.startsWith('/admin/sales')) {
      return {
        title: 'ตรวจสอบยอดขายแต่ละร้าน (Store Sales Overview)',
        icon: Store,
      };
    }
    if (path.startsWith('/admin/stock-in')) {
      return {
        title: 'รับสินค้าเข้าคลัง / ซื้อเข้า (Stock In)',
        icon: ArrowDownToLine,
      };
    }
    if (path.startsWith('/admin/stock-count')) {
      return {
        title: 'ตรวจนับสินค้าจริง (Physical Stock Count)',
        icon: ClipboardCheck,
      };
    }
    if (path.startsWith('/admin/stock-adjustments')) {
      return {
        title: 'อนุมัติใบปรับปรุงสต็อก (Stock Adjustments)',
        icon: FileEdit,
      };
    }
    if (path.startsWith('/admin/stock-transactions')) {
      return {
        title: 'ประวัติเคลื่อนไหวสต็อก (Stock Movement History)',
        icon: History,
      };
    }
    if (path.startsWith('/admin/reports/stock')) {
      return {
        title: 'รายงานสต็อกสินค้า 14 คอลัมน์ (Stock Report & DoH)',
        icon: FileSpreadsheet,
      };
    }
    if (path.startsWith('/admin/reports/sales')) {
      return {
        title: 'รายงานยอดขายประจำวัน (Daily Sales Report)',
        icon: TrendingUp,
      };
    }
    if (path.startsWith('/admin/reports/ingredients')) {
      return {
        title: 'รายงานการใช้วัตถุดิบ (Ingredient Usage)',
        icon: Layers,
      };
    }
    if (path.startsWith('/admin/settings')) {
      return {
        title: 'ตั้งค่าระบบ (System Settings)',
        icon: Settings,
      };
    }
    return {
      title: 'JJ Mall Inventory & Stock Management System',
      icon: Crown,
    };
  };

  const pageInfo = getPageInfo(pathname);
  const PageIcon = pageInfo.icon;

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile Toggle & Dynamic Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none cursor-pointer shrink-0"
          title="เปิดเมนูด้านข้าง"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
              <Crown className="w-3 h-3 text-amber-700" />
              👑 ผู้ดูแลระบบ (Admin)
            </span>
            <span className="text-slate-300 text-xs hidden sm:inline">•</span>
            <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline truncate">
              JJ Mall Shopping Center
            </span>
          </div>

          {/* Dynamic Page Title: Changes based on the active page */}
          <h1 className="text-sm sm:text-base lg:text-lg font-black text-slate-800 tracking-tight mt-0.5 truncate flex items-center gap-2">
            <PageIcon className="w-5 h-5 text-emerald-600 shrink-0 hidden sm:block" />
            <span className="truncate">{pageInfo.title}</span>
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Real-time Clock */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
          <Clock className="w-4 h-4 text-emerald-600" />
          <div className="text-right">
            <div className="text-xs font-bold text-slate-800 leading-none">{currentTime}</div>
            <div className="text-[10px] text-slate-400">{currentDate}</div>
          </div>
        </div>

        {/* Theme Toggle Button (Sun / Moon) Next to Clock */}
        <ThemeToggle />

        {/* Low Stock Alerts */}
        <button
          onClick={() => router.push('/admin/dashboard#alerts')}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer"
          title="การแจ้งเตือนสต็อกใกล้หมด"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Admin User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/70 transition-colors cursor-pointer text-left"
          >
            <div className="w-7 h-7 rounded-xl bg-emerald-700 text-amber-300 flex items-center justify-center text-xs font-bold shadow-xs">
              <Crown className="w-3.5 h-3.5" />
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                {user?.name || 'ผู้ดูแลระบบ'}
              </div>
              <div className="text-[10px] font-black text-amber-800 uppercase flex items-center gap-0.5">
                <span>👑 Admin</span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-800">{user?.name}</div>
                <div className="text-[11px] text-slate-400">@{user?.username}</div>
                <div className="mt-1 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Full Administrator
                </div>
              </div>

              <Link
                href="/admin/users"
                onClick={() => setShowUserMenu(false)}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span>จัดการบัญชีผู้ใช้</span>
              </Link>

              <button
                onClick={logout}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
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
  ArrowUpFromLine,
  ClipboardCheck,
  FileEdit,
  FileSpreadsheet,
  TrendingUp,
  History,
  Settings,
  Store,
  AlertOctagon,
  AlertTriangle,
  FileClock,
  CheckCircle2,
  X,
  ArrowRight,
  CheckCheck,
  RefreshCw,
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsTab, setNotificationsTab] = useState<'ALL' | 'STOCK' | 'APPROVAL' | 'MENU'>('ALL');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('เมื่อสักครู่');
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch real-time notifications with instant auto-poll
  const { data: notifData, isValidating: isNotifValidating, mutate: mutateNotif } = useSWR(
    '/api/notifications',
    (url: string) => fetch(url).then((res) => res.json()),
    { refreshInterval: 6000, revalidateOnFocus: true }
  );

  const notificationsList = notifData?.data?.notifications || [];
  const kpis = notifData?.data?.kpis;

  // Google-like smooth refresh function
  const handleRefreshNotifications = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const startTime = Date.now();
    try {
      await mutateNotif();
    } catch (e) {
    } finally {
      // Keep smooth spin for at least 650ms like Google apps
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 650 - elapsed);
      setTimeout(() => {
        setIsRefreshing(false);
        const now = new Date();
        setLastUpdatedTime(
          now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
        );
      }, remaining);
    }
  };

  // Local storage read state
  useEffect(() => {
    try {
      const stored = localStorage.getItem('jj_read_notification_ids');
      if (stored) setReadIds(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const unreadCount = notificationsList.filter((n: any) => !readIds.includes(n.id)).length;
  const displayCount = unreadCount;

  const handleMarkAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem('jj_read_notification_ids', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = notificationsList.map((n: any) => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    try {
      localStorage.setItem('jj_read_notification_ids', JSON.stringify(updated));
    } catch (e) {}
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close when pathname changes
  useEffect(() => {
    setShowNotifications(false);
    setShowUserMenu(false);
  }, [pathname]);

  const filteredNotifications = notificationsList.filter((n: any) => {
    if (notificationsTab === 'STOCK') return n.category === 'STOCK';
    if (notificationsTab === 'APPROVAL') return n.category === 'APPROVAL';
    if (notificationsTab === 'MENU') return n.category === 'MENU';
    return true;
  });

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'เมื่อสักครู่';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} น.ที่แล้ว`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch {
      return '';
    }
  };

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
    if (path.startsWith('/admin/stock-out')) {
      return {
        title: 'เบิกจ่ายสินค้าไปหน้าร้าน (Stock Out / Store Requisition)',
        icon: ArrowUpFromLine,
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

        {/* System Notifications Popover */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer"
            title="การแจ้งเตือนระบบ"
          >
            <Bell className="w-5 h-5" />
            {displayCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs border-2 border-white ring-1 ring-red-500/20">
                {displayCount > 99 ? '99+' : displayCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 sm:-right-8 mt-2 w-[340px] sm:w-[430px] max-w-[95vw] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white leading-none">
                      การแจ้งเตือนระบบ
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isRefreshing
                        ? 'กำลังอัปเดตข้อมูล...'
                        : unreadCount > 0
                        ? `มี ${unreadCount} รายการใหม่ • อัปเดต ${lastUpdatedTime}`
                        : `ไม่มีรายการค้าง • อัปเดต ${lastUpdatedTime}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRefreshNotifications}
                    disabled={isRefreshing}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
                    title="รีเฟรชข้อมูล (เหมือน Google)"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 transition-transform duration-500 ${
                        isRefreshing ? 'animate-spin text-emerald-400' : ''
                      }`}
                    />
                    <span className="text-[11px]">รีเฟรช</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="ปิด"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Google-style Linear Progress Bar */}
              {isRefreshing && (
                <div className="h-0.5 w-full bg-slate-800 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500 animate-pulse" />
                </div>
              )}

              {/* Tabs */}
              <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setNotificationsTab('ALL')}
                  className={`px-3 py-1 rounded-xl transition-colors cursor-pointer ${
                    notificationsTab === 'ALL'
                      ? 'bg-white shadow-2xs text-slate-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ทั้งหมด ({notificationsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsTab('STOCK')}
                  className={`px-3 py-1 rounded-xl transition-colors cursor-pointer flex items-center gap-1 ${
                    notificationsTab === 'STOCK'
                      ? 'bg-red-500 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  <span>สต็อกวิกฤต ({(kpis?.outOfStockCount || 0) + (kpis?.lowStockCount || 0)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsTab('APPROVAL')}
                  className={`px-3 py-1 rounded-xl transition-colors cursor-pointer flex items-center gap-1 ${
                    notificationsTab === 'APPROVAL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  <span>รออนุมัติ ({kpis?.pendingAdjustmentsCount || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsTab('MENU')}
                  className={`px-3 py-1 rounded-xl transition-colors cursor-pointer flex items-center gap-1 ${
                    notificationsTab === 'MENU'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>เมนูหน้าร้าน ({kpis?.staffMenuActivityCount || 0})</span>
                </button>
              </div>

              {/* List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 text-xs">
                {filteredNotifications.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">ไม่มีการแจ้งเตือนค้างอยู่</p>
                    <p className="text-[11px] text-slate-400">ระบบคลังและสต็อกทั้งหมดอยู่ในเกณฑ์ปกติ</p>
                  </div>
                ) : (
                  filteredNotifications.map((item: any) => {
                    const isRead = readIds.includes(item.id);
                    const isCritical = item.severity === 'CRITICAL';
                    const isApproval = item.category === 'APPROVAL';
                    const isMenu = item.category === 'MENU';
                    const isWarning = item.severity === 'WARNING';

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleMarkAsRead(item.id)}
                        className={`p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors flex items-start gap-3 cursor-pointer ${
                          !isRead ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 border ${
                            isCritical
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : isApproval
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : isMenu
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isWarning
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isCritical ? (
                            <AlertOctagon className="w-4 h-4" />
                          ) : isApproval ? (
                            <FileClock className="w-4 h-4" />
                          ) : isMenu ? (
                            <Store className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                isCritical
                                  ? 'bg-red-100 text-red-700'
                                  : isApproval
                                  ? 'bg-blue-100 text-blue-700'
                                  : isMenu
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isCritical
                                ? 'หมดสต็อก'
                                : isApproval
                                ? 'รออนุมัติ'
                                : isMenu
                                ? (item.type === 'MENU_CREATE' ? '🏪 เพิ่มเมนูใหม่' : item.type === 'MENU_UPDATE' ? '🏪 แก้ไขเมนู' : '🏪 ลบ/ระงับเมนู')
                                : 'ใกล้หมด'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatTime(item.timestamp)}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-800 truncate">
                            {item.title}
                          </div>

                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          {/* Quick Action Button */}
                          <div className="pt-1 flex items-center justify-between">
                            <Link
                              href={item.actionUrl}
                              onClick={() => {
                                handleMarkAsRead(item.id);
                                setShowNotifications(false);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                            >
                              <span>{item.actionLabel}</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>

                            {!isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer pl-1"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>อ่านแล้วทั้งหมด</span>
                </button>

                <Link
                  href="/admin/reports/stock"
                  onClick={() => setShowNotifications(false)}
                  className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline pr-1"
                >
                  ดูรายงานสต็อกรวม &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Admin User Profile */}
        <div className="relative" ref={userMenuRef}>
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

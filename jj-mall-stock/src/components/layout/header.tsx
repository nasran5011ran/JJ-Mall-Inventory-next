'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Clock, LogOut, Shield, User, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';

interface HeaderProps {
  user: {
    id: number;
    name: string;
    username: string;
    role: 'ADMIN' | 'STAFF';
  };
  onOpenSidebar: () => void;
  notificationCount?: number;
}

export default function Header({ user, onOpenSidebar, notificationCount = 0 }: HeaderProps) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format Thai Time e.g. 10:04:15 น.
      const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
      // Format Thai Date e.g. พฤหัสบดี 5 พ.ย. 2569
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>JJ Mall Inventory & Stock System</span>
          </h2>
          <p className="text-xs text-slate-400 hidden sm:block">
            ระบบจัดการสต็อกและสูตรการผลิต (BOM) บันทึกยอดขายและตัดสต็อกอัตโนมัติ
          </p>
        </div>
      </div>

      {/* Right: Clock & User Menu */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600">
          <Clock className="w-4 h-4 text-emerald-600" />
          <div className="text-right">
            <div className="text-xs font-bold text-slate-800 leading-none">{currentTime}</div>
            <div className="text-[10px] text-slate-400">{currentDate}</div>
          </div>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => router.push('/dashboard#alerts')}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {notificationCount}
              </span>
            )}
          </button>
        </div>

        {/* User Profile Pill */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold ${
                user.role === 'ADMIN' ? 'bg-emerald-600' : 'bg-sky-600'
              }`}
            >
              {user.role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">{user.name}</div>
              <div className="text-[10px] font-semibold text-emerald-600 uppercase">
                {user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงานขาย'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-800">{user.name}</div>
                <div className="text-[11px] text-slate-400">@{user.username}</div>
                <div className="mt-1 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {user.role === 'ADMIN' ? 'Admin Role' : 'Staff Role'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
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

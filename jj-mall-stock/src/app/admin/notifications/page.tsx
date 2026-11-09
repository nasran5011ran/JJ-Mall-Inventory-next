'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  FileClock,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter,
  Search,
  RefreshCw,
  CheckCheck,
  PackagePlus,
  SlidersHorizontal,
  Layers,
  ChevronRight,
  Info,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Flame,
  ArrowRight,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  category: 'STOCK' | 'APPROVAL' | 'DISCREPANCY' | 'ACTIVITY';
  type: string;
  severity: 'CRITICAL' | 'ACTION_REQUIRED' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  timestamp: string;
  actionUrl: string;
  actionLabel: string;
  metadata?: Record<string, any>;
}

interface NotificationsData {
  kpis: {
    totalCount: number;
    totalActionable: number;
    outOfStockCount: number;
    lowStockCount: number;
    pendingAdjustmentsCount: number;
    discrepancyCount: number;
    recentActivityCount: number;
  };
  notifications: NotificationItem[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminNotificationsPage() {
  const { data: response, isLoading, isValidating, mutate } = useSWR<{
    success: boolean;
    data: NotificationsData;
  }>('/api/notifications', fetcher, {
    refreshInterval: 20000,
    revalidateOnFocus: true,
  });

  const kpis = response?.data?.kpis || {
    totalCount: 0,
    totalActionable: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    pendingAdjustmentsCount: 0,
    discrepancyCount: 0,
    recentActivityCount: 0,
  };

  const allNotifications = useMemo(() => response?.data?.notifications || [], [response]);

  // Read status managed via localStorage
  const [readIds, setReadIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'STOCK' | 'APPROVAL' | 'DISCREPANCY' | 'ACTIVITY'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'ACTION_REQUIRED' | 'WARNING' | 'INFO'>('ALL');
  const [readFilter, setReadFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('jj_read_notification_ids');
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const saveReadIds = (newIds: string[]) => {
    setReadIds(newIds);
    try {
      localStorage.setItem('jj_read_notification_ids', JSON.stringify(newIds));
    } catch (e) {}
  };

  const handleMarkAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      saveReadIds(updated);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = allNotifications.map((n) => n.id);
    saveReadIds(allIds);
    showToast('ทำเครื่องหมายอ่านแล้วทั้งหมดเรียบร้อย');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((item) => {
      // Tab filter
      if (activeTab !== 'ALL' && item.category !== activeTab) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) {
        return false;
      }

      // Read filter
      const isRead = readIds.includes(item.id);
      if (readFilter === 'UNREAD' && isRead) return false;
      if (readFilter === 'READ' && !isRead) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inCode = item.metadata?.code?.toLowerCase().includes(q);
        const inName = item.metadata?.ingredientName?.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inCode && !inName) return false;
      }

      return true;
    });
  }, [allNotifications, activeTab, severityFilter, readFilter, searchQuery, readIds]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !readIds.includes(n.id)).length;
  }, [allNotifications, readIds]);

  // Severity helper
  const getSeverityBadge = (severity: NotificationItem['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          label: 'วิกฤตเร่งด่วน',
          badgeClass: 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-400/30',
          icon: AlertOctagon,
          cardBorder: 'border-l-4 border-l-red-500',
          dotColor: 'bg-red-500',
        };
      case 'ACTION_REQUIRED':
        return {
          label: 'รอการอนุมัติ',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-400/30',
          icon: FileClock,
          cardBorder: 'border-l-4 border-l-blue-500',
          dotColor: 'bg-blue-500',
        };
      case 'WARNING':
        return {
          label: 'แจ้งเตือนเฝ้าระวัง',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-400/30',
          icon: AlertTriangle,
          cardBorder: 'border-l-4 border-l-amber-500',
          dotColor: 'bg-amber-500',
        };
      case 'INFO':
      default:
        return {
          label: 'ข้อมูลทั่วไป',
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: Info,
          cardBorder: 'border-l-4 border-l-slate-400',
          dotColor: 'bg-slate-400',
        };
    }
  };

  // Relative Time helper
  const formatRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return 'เมื่อสักครู่';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

      return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Bell className="w-6 h-6 text-emerald-600" />
              <span>ศูนย์แจ้งเตือนระบบ</span>
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                ยังไม่ได้อ่าน {unreadCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ตรวจสอบสต็อกวัตถุดิบวิกฤต รายการขออนุมัติปรับปรุง และผลต่างจากการตรวจนับสินค้าแบบ Real-time
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            title="รีเฟรชข้อมูลแจ้งเตือนล่าสุด"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
            <span>รีเฟรช</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>อ่านแล้วทั้งหมด</span>
            </button>
          )}

          <Link
            href="/admin/stock-in"
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            <span>รับเข้าคลังด่วน</span>
          </Link>
        </div>
      </div>

      {/* 4 Interactive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Out of Stock (Critical) */}
        <div
          onClick={() => {
            setActiveTab('STOCK');
            setSeverityFilter(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL');
          }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            severityFilter === 'CRITICAL'
              ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              <span>หมดสต็อก (วิกฤต)</span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 mt-1 font-mono">
            {kpis.outOfStockCount} <span className="text-xs font-semibold text-slate-500">ชนิด</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ยอดคงเหลือ 0 (ต้องสั่งซื้อทันที)</p>
        </div>

        {/* Card 2: Low Stock (Warning) */}
        <div
          onClick={() => {
            setActiveTab('STOCK');
            setSeverityFilter(severityFilter === 'WARNING' ? 'ALL' : 'WARNING');
          }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            severityFilter === 'WARNING'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              ใกล้หมด (ต่ำกว่า Min)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
            {kpis.lowStockCount} <span className="text-xs font-semibold text-slate-500">ชนิด</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ต่ำกว่าเกณฑ์ความปลอดภัย</p>
        </div>

        {/* Card 3: Pending Adjustments */}
        <div
          onClick={() => {
            setActiveTab(activeTab === 'APPROVAL' ? 'ALL' : 'APPROVAL');
            setSeverityFilter('ALL');
          }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'APPROVAL'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              รออนุมัติปรับสต็อก
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileClock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-1 font-mono">
            {kpis.pendingAdjustmentsCount} <span className="text-xs font-semibold text-slate-500">ใบคำขอ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">รอผู้จัดการตรวจสอบ</p>
        </div>

        {/* Card 4: Total Alerts */}
        <div
          onClick={() => {
            setActiveTab('ALL');
            setSeverityFilter('ALL');
          }}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'ALL' && severityFilter === 'ALL'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              การแจ้งเตือนทั้งหมด
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {kpis.totalCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">รวมทุกหมวดหมู่และกิจกรรม</p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({allNotifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STOCK')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'STOCK'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>สต็อกวิกฤต & ใกล้หมด ({kpis.outOfStockCount + kpis.lowStockCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'APPROVAL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <FileClock className="w-3.5 h-3.5" />
            <span>รอการอนุมัติ ({kpis.pendingAdjustmentsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DISCREPANCY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'DISCREPANCY'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ผลต่างตรวจนับ ({kpis.discrepancyCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVITY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ACTIVITY'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>ความเคลื่อนไหว ({kpis.recentActivityCount})</span>
          </button>
        </div>

        {/* Filter Bar: Search + Severity + Read Status */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อวัตถุดิบ, รหัส, เลขที่เอกสาร, หรือเนื้อหา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">ความเร่งด่วน: ทั้งหมด</option>
              <option value="CRITICAL">🔴 วิกฤตเร่งด่วน (Critical)</option>
              <option value="ACTION_REQUIRED">🔵 รออนุมัติ (Action Required)</option>
              <option value="WARNING">🟡 แจ้งเตือนเฝ้าระวัง (Warning)</option>
              <option value="INFO">⚪ ข้อมูลทั่วไป (Info)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">สถานะ: ทั้งหมด</option>
              <option value="UNREAD">ยังไม่ได้อ่าน ({unreadCount})</option>
              <option value="READ">อ่านแล้ว</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading && allNotifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 shadow-2xs">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">กำลังโหลดการแจ้งเตือนจากระบบ JJ Mall...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">ไม่มีรายการแจ้งเตือนค้างอยู่</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {searchQuery || severityFilter !== 'ALL' || readFilter !== 'ALL' || activeTab !== 'ALL'
                  ? 'ไม่พบการแจ้งเตือนที่ตรงกับเงื่อนไขการค้นหาของคุณ ลองเปลี่ยนตัวกรอง'
                  : 'ยอดเยี่ยม! ระบบคลังและสต็อกทั้งหมดอยู่ในเกณฑ์ปกติ ไม่มีรายการที่ต้องจัดการด่วนในขณะนี้'}
              </p>
            </div>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const severityMeta = getSeverityBadge(item.severity);
            const SeverityIcon = severityMeta.icon;
            const isRead = readIds.includes(item.id);

            return (
              <div
                key={item.id}
                onClick={() => handleMarkAsRead(item.id)}
                className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs transition-all relative group hover:shadow-md ${
                  severityMeta.cardBorder
                } ${isRead ? 'opacity-75 bg-slate-50/40' : 'bg-white'}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left: Icon & Content */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border ${
                        item.severity === 'CRITICAL'
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : item.severity === 'ACTION_REQUIRED'
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : item.severity === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <SeverityIcon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Top Badges & Timestamp */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${severityMeta.badgeClass}`}
                        >
                          {severityMeta.label}
                        </span>

                        {item.metadata?.code && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                            รหัส: {item.metadata.code}
                          </span>
                        )}

                        {item.metadata?.category && (
                          <span className="text-[10.5px] text-slate-400">
                            หมวด: {item.metadata.category}
                          </span>
                        )}

                        <span className="text-[10px] text-slate-400 font-medium ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(item.timestamp)}</span>
                        </span>

                        {!isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"
                            title="ยังไม่ได้อ่าน"
                          />
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {item.title}
                      </h4>

                      {/* Description */}
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Extra Meta Badges */}
                      {item.metadata && (item.category === 'STOCK' || item.category === 'DISCREPANCY') && (
                        <div className="pt-1 flex items-center gap-3 text-[11px] font-mono">
                          {item.metadata.currentStock !== undefined && (
                            <span className="text-slate-600">
                              คงเหลือ: <strong className="text-slate-900">{item.metadata.currentStock}</strong> {item.metadata.unit}
                            </span>
                          )}
                          {item.metadata.minStock !== undefined && (
                            <span className="text-slate-500">
                              เกณฑ์ขั้นต่ำ: <strong>{item.metadata.minStock}</strong> {item.metadata.unit}
                            </span>
                          )}
                          {item.metadata.deficit > 0 && (
                            <span className="text-red-700 font-bold">
                              ขาดอีก: -{item.metadata.deficit} {item.metadata.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Quick Action Button */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <Link
                      href={item.actionUrl}
                      onClick={() => handleMarkAsRead(item.id)}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs ${
                        item.severity === 'CRITICAL'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : item.severity === 'ACTION_REQUIRED'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    {!isRead ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(item.id);
                        }}
                        className="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer font-medium"
                      >
                        ทำเครื่องหมายว่าอ่านแล้ว
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <CheckCheck className="w-3 h-3 text-emerald-600" />
                        <span>อ่านแล้ว</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

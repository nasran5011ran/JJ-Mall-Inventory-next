'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ShoppingBag,
  Store,
  Search,
  RefreshCw,
  Calendar,
  Clock,
  DollarSign,
  Coffee,
  Receipt,
  User,
  CreditCard,
  QrCode,
  Banknote,
  ArrowRight,
  Eye,
  CheckCircle2,
  X,
  Layers,
  ChevronRight,
  ArrowDownToLine,
  Package,
  Sparkles,
  Users,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface SaleItemData {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: {
    id: number;
    code: string;
    name: string;
    category?: string;
    unit: string;
  };
}

interface SaleRecord {
  id: number;
  saleNumber: string;
  totalAmount: number;
  totalItems: number;
  paymentMethod: 'CASH' | 'QR' | 'CARD';
  note?: string | null;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  items: SaleItemData[];
}

interface StoreData {
  id: number;
  name: string;
  username: string;
  status: string;
  createdAt: string;
  metrics: {
    totalRevenue: number;
    totalBills: number;
    totalCups: number;
  };
  topProducts: Array<{
    id: number;
    name: string;
    code: string;
    unit: string;
    qty: number;
    revenue: number;
  }>;
  ingredientDeductions: Array<{
    id: number;
    name: string;
    code: string;
    unit: string;
    deductedQty: number;
  }>;
  stockReceived: Array<{
    id: number;
    name: string;
    code: string;
    unit: string;
    totalReceived: number;
    lastDate: string;
  }>;
  recentSales: SaleRecord[];
}

export default function AdminSalesPage() {
  const { user } = useAuth();
  const { data: salesData, isLoading: salesLoading, isValidating: salesValidating, mutate: mutateSales } = useSWR('/api/sales?limit=300');
  const { data: storesData, isLoading: storesLoading, isValidating: storesValidating, mutate: mutateStores } = useSWR('/api/admin/stores');

  const sales: SaleRecord[] = useMemo(() => {
    return salesData?.success && Array.isArray(salesData.sales) ? salesData.sales : [];
  }, [salesData]);

  const stores: StoreData[] = useMemo(() => {
    return storesData?.success && Array.isArray(storesData.stores) ? storesData.stores : [];
  }, [storesData]);

  const allIngredients = useMemo(() => {
    return storesData?.success && Array.isArray(storesData.allIngredients) ? storesData.allIngredients : [];
  }, [storesData]);

  const loading = (salesLoading || storesLoading) && sales.length === 0 && stores.length === 0;
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'ALL'>('ALL');

  // Selected Bill for Details Modal
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  // Selected Store for Full Drilldown Modal (ดูละเอียด: ขายกี่แก้ว, รับสต็อกอะไรบ้าง, วัตถุดิบที่ถูกตัด)
  const [inspectingStore, setInspectingStore] = useState<StoreData | null>(null);
  const [inspectTab, setInspectTab] = useState<'SALES' | 'STOCK_IN' | 'DEDUCTIONS'>('SALES');

  const fetchData = async (_isManual = false) => {
    setRefreshing(true);
    try {
      await Promise.all([mutateSales(), mutateStores()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered Sales Table
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return sales.filter((s) => {
      // Filter by Staff/Store
      if (selectedStaffId !== 'ALL' && s.createdBy?.id !== selectedStaffId) {
        return false;
      }

      // Search
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.saleNumber.toLowerCase().includes(q) ||
        s.createdBy?.name.toLowerCase().includes(q) ||
        s.items?.some((it) => it.product?.name.toLowerCase().includes(q));

      // Payment method
      const matchPayment = paymentFilter === 'ALL' || s.paymentMethod === paymentFilter;

      // Date
      let matchDate = true;
      const saleDate = new Date(s.createdAt);
      if (dateFilter === 'TODAY') {
        matchDate = s.createdAt.startsWith(todayStr);
      } else if (dateFilter === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchDate = saleDate >= weekAgo;
      } else if (dateFilter === 'MONTH') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchDate = saleDate >= monthAgo;
      }

      return matchSearch && matchPayment && matchDate;
    });
  }, [sales, search, paymentFilter, dateFilter, selectedStaffId]);

  // Executive Metrics
  const totalRevenue = useMemo(
    () => filteredSales.reduce((sum, s) => sum + Number(s.totalAmount), 0),
    [filteredSales]
  );
  const totalBills = filteredSales.length;
  const totalCupsSold = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.totalItems, 0),
    [filteredSales]
  );
  const avgTicket = totalBills > 0 ? totalRevenue / totalBills : 0;

  // Active Store Object (if filtered)
  const currentStore = useMemo(() => {
    if (selectedStaffId === 'ALL') return null;
    return stores.find((st) => st.id === selectedStaffId) || null;
  }, [selectedStaffId, stores]);

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            ระบบตรวจสอบยอดขายของแต่ละร้าน / จุดขาย และพนักงานแคชเชียร์แบบเรียลไทม์
          </p>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <Link
            href="/admin/users"
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs transition-all"
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>จัดการรายชื่อพนักงานขาย</span>
          </Link>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <div className="font-bold text-amber-950">
              โหมดตรวจสอบของผู้ดูแลระบบ (Admin)
            </div>
            <div className="text-amber-800 text-[11px]">
              หน้านี้มีไว้ตรวจสอบยอดขายและสต็อกของพนักงานขายแต่ละร้านเท่านั้น — ผู้ดูแลระบบไม่มีหน้าที่ขายสินค้าหน้าร้าน และไม่มีปุ่มขายในหน้านี้
            </div>
          </div>
        </div>
      </div>

      {/* Stores & Cashier Terminals Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            <span>เลือกร้านค้า / จุดขาย เพื่อเข้าไปตรวจดูยอดขายและสต็อก:</span>
          </div>

          {selectedStaffId !== 'ALL' && (
            <button
              onClick={() => setSelectedStaffId('ALL')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcwIcon className="w-3.5 h-3.5" />
              <span>แสดงรวมทุกร้าน ({sales.length} บิล)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card: All Stores Overview */}
          <div
            onClick={() => setSelectedStaffId('ALL')}
            className={`p-4 rounded-3xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedStaffId === 'ALL'
                ? 'bg-gradient-to-br from-emerald-700 to-teal-800 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  selectedStaffId === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  ภาพรวมรวมทุกร้าน
                </span>
                <Store className={`w-5 h-5 ${selectedStaffId === 'ALL' ? 'text-amber-300' : 'text-slate-400'}`} />
              </div>

              <div className="mt-3">
                <div className="font-extrabold text-base leading-snug">ทุกร้านค้า & จุดขาย</div>
                <div className={`text-xs mt-0.5 ${selectedStaffId === 'ALL' ? 'text-emerald-100' : 'text-slate-400'}`}>
                  พนักงานขายทั้งหมด ({stores.length} ร้าน)
                </div>
              </div>
            </div>

            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              selectedStaffId === 'ALL' ? 'border-white/20' : 'border-slate-100'
            }`}>
              <div>
                <span className="opacity-80">ยอดขายรวม:</span>
                <div className="font-mono font-black text-base">
                  ฿{sales.reduce((sum, s) => sum + Number(s.totalAmount), 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-right">
                <span className="opacity-80">ขายได้:</span>
                <div className="font-mono font-black text-base">
                  {sales.reduce((sum, s) => sum + s.totalItems, 0)} แก้ว
                </div>
              </div>
            </div>
          </div>

          {/* Individual Store / Cashier Cards */}
          {stores.map((st) => {
            const isSelected = selectedStaffId === st.id;

            return (
              <div
                key={st.id}
                className={`p-4 rounded-3xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-white hover:border-emerald-300 hover:shadow-2xs border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      <User className="w-3 h-3" />
                      เจ้าหน้าที่ขาย
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setInspectingStore(st);
                        setInspectTab('SALES');
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="กดเพื่อดูสรุปยอดแก้ว และการรับสต็อกของร้านนี้"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>เจาะลึกร้านนี้</span>
                    </button>
                  </div>

                  {/* Store Name & Cashier */}
                  <div
                    onClick={() => setSelectedStaffId(st.id)}
                    className="mt-3 cursor-pointer group"
                  >
                    <div className="font-black text-sm text-slate-800 group-hover:text-emerald-700 transition-colors leading-snug">
                      {st.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      @{st.username} • {st.metrics.totalBills} บิลขาย
                    </div>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div
                  onClick={() => setSelectedStaffId(st.id)}
                  className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs cursor-pointer"
                >
                  <div>
                    <span className="text-slate-400 text-[11px]">ขายได้:</span>
                    <div className="font-mono font-black text-sm text-slate-800">
                      {st.metrics.totalCups} แก้ว
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 text-[11px]">ยอดขายร้านนี้:</span>
                    <div className="font-mono font-black text-sm text-emerald-700">
                      ฿{st.metrics.totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Store Focus Banner */}
      {currentStore && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs">
              <Store className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                <span>กำลังดูข้อมูลของ: {currentStore.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold">
                  @{currentStore.username}
                </span>
              </div>
              <div className="text-emerald-800 text-xs mt-0.5">
                ขายได้ทั้งหมด <strong>{currentStore.metrics.totalCups} แก้ว</strong> • ยอดขายรวม <strong className="font-mono font-bold">฿{currentStore.metrics.totalRevenue.toFixed(2)}</strong> ({currentStore.metrics.totalBills} บิล)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInspectingStore(currentStore);
                setInspectTab('SALES');
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span>ดูข้อมูลเจาะลึกร้านนี้</span>
            </button>

            <button
              onClick={() => setSelectedStaffId('ALL')}
              className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>ปิด (ดูรวมทุกร้าน)</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              {currentStore ? `ยอดขาย (${currentStore.name.split(' ')[0]})` : 'ยอดขายรวมทุกร้าน'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            ฿{totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">จาก {totalBills} บิลขาย</p>
        </div>

        {/* Card 2: Total Bills */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              จำนวนบิลที่เปิดขาย
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {totalBills} <span className="text-xs font-semibold text-slate-500">บิล</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ชำระเงินเรียบร้อย</p>
        </div>

        {/* Card 3: Total Cups */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              จำนวนแก้วที่ขายได้
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {totalCupsSold} <span className="text-xs font-semibold text-slate-500">แก้ว</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ตัดสต็อกวัตถุดิบอัตโนมัติ</p>
        </div>

        {/* Card 4: Average Ticket */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              ยอดเฉลี่ยต่อบิล
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            ฿{avgTicket.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ค่าเฉลี่ยต่อคำสั่งซื้อ</p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่บิล หรือชื่อสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Staff Filter Dropdown */}
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer flex-1 md:flex-initial"
          >
            <option value="ALL">🏪 ทุกร้านค้า & เจ้าหน้าที่ ({stores.length} ร้าน)</option>
            {stores.map((st) => (
              <option key={st.id} value={st.id}>
                👤 {st.name} ({st.metrics.totalBills} บิล • {st.metrics.totalCups} แก้ว)
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
          >
            <option value="ALL">ช่วงเวลาทั้งหมด</option>
            <option value="TODAY">📅 วันนี้ (Today)</option>
            <option value="WEEK">🗓️ 7 วันล่าสุด</option>
            <option value="MONTH">📆 30 วันล่าสุด</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
          >
            <option value="ALL">ทุกช่องทางชำระ</option>
            <option value="CASH">💵 เงินสด</option>
            <option value="QR">📱 สแกน QR</option>
            <option value="CARD">💳 บัตรเครดิต</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดรายการบิลขาย...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <ShoppingBag className="w-10 h-10 text-slate-300" />
            <span>ไม่พบข้อมูลบิลขายที่ตรงกับเงื่อนไขการค้นหา</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">เลขที่บิลขาย</th>
                  <th className="py-3.5 px-4">วันที่ & เวลา</th>
                  <th className="py-3.5 px-4">ร้านค้า / เจ้าหน้าที่ขาย</th>
                  <th className="py-3.5 px-4 text-center">วิธีชำระเงิน</th>
                  <th className="py-3.5 px-4">รายการสินค้าในบิล</th>
                  <th className="py-3.5 px-4 text-center">จำนวน</th>
                  <th className="py-3.5 px-4 text-right">ยอดรวมทั้งสิ้น</th>
                  <th className="py-3.5 px-4 text-center">ดูใบเสร็จ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSales.map((s) => {
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Sale Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        <button
                          onClick={() => setSelectedSale(s)}
                          className="hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{s.saleNumber}</span>
                        </button>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">
                            {new Date(s.createdAt).toLocaleDateString('th-TH')}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(s.createdAt).toLocaleTimeString('th-TH')} น.
                          </span>
                        </div>
                      </td>

                      {/* Cashier / Store */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedStaffId(s.createdBy?.id)}
                          className="flex items-center gap-2 text-left hover:opacity-80 cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                              {s.createdBy?.name || 'พนักงาน'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">@{s.createdBy?.username}</div>
                          </div>
                        </button>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-center">
                        {s.paymentMethod === 'CASH' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Banknote className="w-3 h-3 text-emerald-600" />
                            เงินสด
                          </span>
                        )}
                        {s.paymentMethod === 'QR' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <QrCode className="w-3 h-3 text-sky-600" />
                            สแกน QR
                          </span>
                        )}
                        {s.paymentMethod === 'CARD' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            <CreditCard className="w-3 h-3 text-purple-600" />
                            บัตรเครดิต
                          </span>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-xs truncate text-slate-700">
                          {s.items?.map((it) => `${it.product?.name} × ${it.quantity}`).join(', ') || '-'}
                        </div>
                      </td>

                      {/* Total Items */}
                      <td className="py-3.5 px-4 text-center font-bold font-mono text-slate-800">
                        {s.totalItems} แก้ว
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-black font-mono text-sm text-emerald-700">
                        ฿{Number(s.totalAmount).toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedSale(s)}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูบิล</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Deep Store Inspection (เจาะลึกร้านค้า: ขายกี่แก้ว, รับสต็อกอะไรบ้าง, ตัดสต็อกไปเท่าไหร่) */}
      {inspectingStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
                  <Store className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                      รายงานเจาะลึกร้านค้า
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">@{inspectingStore.username}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mt-0.5">
                    {inspectingStore.name}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setInspectingStore(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick KPI Row */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800 uppercase">ยอดขายรวมร้านนี้</div>
                <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                  ฿{inspectingStore.metrics.totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
                <div className="text-[11px] font-bold text-amber-800 uppercase">ขายได้ทั้งหมด</div>
                <div className="text-xl font-black text-amber-800 font-mono mt-0.5">
                  {inspectingStore.metrics.totalCups} <span className="text-xs font-semibold">แก้ว</span>
                </div>
              </div>

              <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200">
                <div className="text-[11px] font-bold text-blue-800 uppercase">จำนวนบิลขาย</div>
                <div className="text-xl font-black text-blue-700 font-mono mt-0.5">
                  {inspectingStore.metrics.totalBills} <span className="text-xs font-semibold">บิล</span>
                </div>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setInspectTab('SALES')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  inspectTab === 'SALES'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>☕ สินค้าที่ขายได้ ({inspectingStore.topProducts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectTab('STOCK_IN')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  inspectTab === 'STOCK_IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>📥 รับสต็อกอะไรมาบ้าง ({inspectingStore.stockReceived.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectTab('DEDUCTIONS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  inspectTab === 'DEDUCTIONS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>✂️ วัตถุดิบที่ตัดสต็อกไป ({inspectingStore.ingredientDeductions.length})</span>
              </button>
            </div>

            {/* Tab 1: Products Sold Breakdown */}
            {inspectTab === 'SALES' && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-bold text-slate-700">รายการเมนูเครื่องดื่มที่ร้านนี้ขายได้:</div>
                {inspectingStore.topProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">ร้านนี้ยังไม่มีรายการขายสินค้า</div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">รหัส</th>
                          <th className="py-2.5 px-3">ชื่อสินค้า/เครื่องดื่ม</th>
                          <th className="py-2.5 px-3 text-center">ขายได้ (แก้ว)</th>
                          <th className="py-2.5 px-3 text-right">ยอดเงินรวม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingStore.topProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">{p.code}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{p.name}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                              {p.qty} {p.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              ฿{p.revenue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Stock Received (รับสต็อกอะไรมาบ้าง เท่าไหร่) */}
            {inspectTab === 'STOCK_IN' && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>รายการวัตถุดิบและบรรจุภัณฑ์ที่รับเข้าคลังของร้าน:</span>
                  <span className="text-[11px] text-slate-400 font-normal">อัปเดตตามใบจัดซื้อเข้าคลัง</span>
                </div>
                {inspectingStore.stockReceived.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">ยังไม่มีประวัติการรับเข้าวัตถุดิบ</div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">รหัสวัตถุดิบ</th>
                          <th className="py-2.5 px-3">ชื่อวัตถุดิบ</th>
                          <th className="py-2.5 px-3 text-right">จำนวนที่รับเข้า</th>
                          <th className="py-2.5 px-3 text-right">สต็อกคงเหลือปัจจุบัน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingStore.stockReceived.map((ing) => {
                          const currentStockInfo = allIngredients.find((i: any) => i.id === ing.id);
                          return (
                            <tr key={ing.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">{ing.code}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">{ing.name}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                +{Number(ing.totalReceived).toLocaleString()} {ing.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                                {currentStockInfo ? `${Number(currentStockInfo.currentStock).toLocaleString()} ${ing.unit}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Ingredient Deductions (วัตถุดิบที่ตัดสต็อกไปจากการขาย) */}
            {inspectTab === 'DEDUCTIONS' && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>วัตถุดิบที่ถูกตัดสต็อกอัตโนมัติตามสูตรการผลิต (BOM) จากยอดขายของร้านนี้:</span>
                </div>
                {inspectingStore.ingredientDeductions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">ยังไม่มีการตัดสต็อกวัตถุดิบ</div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">รหัสวัตถุดิบ</th>
                          <th className="py-2.5 px-3">ชื่อวัตถุดิบ</th>
                          <th className="py-2.5 px-3 text-right">ปริมาณที่ตัดออกไป</th>
                          <th className="py-2.5 px-3 text-right">สถานะสต็อก</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingStore.ingredientDeductions.map((ing) => (
                          <tr key={ing.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">{ing.code}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{ing.name}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600">
                              -{Number(ing.deductedQty).toLocaleString()} {ing.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                สต็อกเพียงพอ
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectingStore(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Sale Receipt Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">รายละเอียดใบเสร็จรับเงิน</h3>
                  <p className="text-xs font-mono font-bold text-emerald-700">{selectedSale.saleNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>ร้านค้า / พนักงานขาย:</span>
                <span className="font-bold text-slate-800">{selectedSale.createdBy?.name}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>วันที่ทำรายการ:</span>
                <span className="text-slate-700">
                  {new Date(selectedSale.createdAt).toLocaleDateString('th-TH')} {new Date(selectedSale.createdAt).toLocaleTimeString('th-TH')} น.
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>วิธีชำระเงิน:</span>
                <span className="font-bold text-slate-800">
                  {selectedSale.paymentMethod === 'CASH'
                    ? 'เงินสด'
                    : selectedSale.paymentMethod === 'QR'
                    ? 'สแกน QR Code'
                    : 'บัตรเครดิต'}
                </span>
              </div>

              {/* Items List */}
              <div className="pt-3 border-t border-slate-100">
                <div className="font-bold text-slate-700 mb-2">รายการสินค้าในบิล:</div>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                  {selectedSale.items?.map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{it.product?.name}</span>
                        <span className="text-[11px] text-slate-400 ml-1.5">× {it.quantity}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        ฿{Number(it.subtotal).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Total */}
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-black text-slate-800">
                <span>ยอดเงินรวมทั้งสิ้น:</span>
                <span className="text-xl font-mono text-emerald-700">
                  ฿{Number(selectedSale.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedSale(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RotateCcwIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

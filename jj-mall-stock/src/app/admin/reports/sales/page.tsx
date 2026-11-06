'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  TrendingUp,
  Search,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Calendar,
  Clock,
  Download,
  Printer,
  X,
  FileText,
  User,
  Store,
  CreditCard,
  QrCode,
  Banknote,
  Award,
  ChevronRight,
  BarChart3,
  PieChart,
  Coffee,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface StaffStore {
  id: number;
  username: string;
  name: string;
}

interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: {
    id: number;
    code: string;
    name: string;
    unit: string;
    price: number;
  };
}

interface SaleRecord {
  id: number;
  saleNumber: string;
  totalAmount: number;
  totalItems: number;
  paymentMethod: string;
  note: string | null;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  items: SaleItem[];
}

interface TopProduct {
  id: number;
  code: string;
  name: string;
  unit: string;
  qty: number;
  revenue: number;
  percentage: number;
}

interface StoreSalesStat {
  storeId: number;
  storeName: string;
  username: string;
  revenue: number;
  bills: number;
  cups: number;
}

interface HourlySalesStat {
  hour: number;
  label: string;
  revenue: number;
  cups: number;
  bills: number;
}

export default function AdminSalesReportPage() {
  // Filter States
  const [period, setPeriod] = useState<string>('ALL'); // ALL | TODAY | YESTERDAY | THIS_WEEK | THIS_MONTH
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [storeId, setStoreId] = useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // SWR URL with query params
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedDate) {
      params.set('date', selectedDate);
    } else {
      params.set('period', period);
    }
    if (storeId !== 'ALL') params.set('storeId', storeId);
    if (paymentMethod !== 'ALL') params.set('paymentMethod', paymentMethod);
    return `/api/admin/reports/sales?${params.toString()}`;
  }, [period, selectedDate, storeId, paymentMethod]);

  const { data: swrData, isLoading, isValidating, mutate } = useSWR(apiUrl);

  const sales: SaleRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.sales) ? swrData.sales : [];
  }, [swrData]);

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  const topProducts: TopProduct[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.topProducts) ? swrData.topProducts : [];
  }, [swrData]);

  const storeBreakdown: StoreSalesStat[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.storeBreakdown) ? swrData.storeBreakdown : [];
  }, [swrData]);

  const hourlySales: HourlySalesStat[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.hourlySales) ? swrData.hourlySales : [];
  }, [swrData]);

  const kpis = swrData?.kpis || {
    totalRevenue: 0,
    totalBills: 0,
    totalCups: 0,
    averageTicket: 0,
  };

  const paymentBreakdown = swrData?.paymentBreakdown || {
    cash: { revenue: 0, bills: 0, percentage: 0 },
    qr: { revenue: 0, bills: 0, percentage: 0 },
  };

  const loading = isLoading && sales.length === 0;

  // Detail Modal State
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  // Search Filter
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const matchNo = s.saleNumber.toLowerCase().includes(q);
        const matchStaff = s.createdBy?.name.toLowerCase().includes(q);
        const matchProduct = s.items.some((i) => i.product?.name.toLowerCase().includes(q));
        if (!matchNo && !matchStaff && !matchProduct) return false;
      }
      return true;
    });
  }, [sales, search]);

  // Max revenue in hourly chart for percentage calculation
  const maxHourlyRevenue = useMemo(() => {
    let max = 0;
    hourlySales.forEach((h) => {
      if (h.revenue > max) max = h.revenue;
    });
    return max > 0 ? max : 100;
  }, [hourlySales]);

  // Quick select period
  const handleSelectPeriod = (p: string) => {
    setSelectedDate('');
    setPeriod(p);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;

    const headers = [
      'เลขที่บิล (Sale Number)',
      'วันที่ & เวลา',
      'ร้านค้า / แคชเชียร์',
      'ช่องทางชำระเงิน',
      'จำนวนแก้ว',
      'ยอดรวมสุทธิ (บาท)',
      'รายการสินค้าในบิล',
    ];

    const rows = filteredSales.map((s) => [
      `"${s.saleNumber}"`,
      `"${new Date(s.createdAt).toLocaleString('th-TH')}"`,
      `"${s.createdBy?.name || ''}"`,
      `"${s.paymentMethod || 'CASH'}"`,
      s.totalItems,
      s.totalAmount,
      `"${s.items.map((i) => `${i.product?.name} x${i.quantity}`).join(', ')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `JJ_Mall_Daily_Sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            รายงานวิเคราะห์ยอดขายประจำวัน (Daily Sales & Financial Report) และการจัดอันดับสินค้าขายดีแยกตามสาขา
          </p>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>พิมพ์รายงานสรุป</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        {/* Quick Period Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => handleSelectPeriod('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              period === 'ALL' && !selectedDate
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด (All Time)
          </button>

          <button
            type="button"
            onClick={() => handleSelectPeriod('TODAY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              period === 'TODAY' && !selectedDate
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📅 วันนี้ (Today)
          </button>

          <button
            type="button"
            onClick={() => handleSelectPeriod('YESTERDAY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              period === 'YESTERDAY' && !selectedDate
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🗓️ เมื่อวาน (Yesterday)
          </button>

          <button
            type="button"
            onClick={() => handleSelectPeriod('THIS_WEEK')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              period === 'THIS_WEEK' && !selectedDate
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📊 7 วันล่าสุด (Week)
          </button>

          <button
            type="button"
            onClick={() => handleSelectPeriod('THIS_MONTH')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              period === 'THIS_MONTH' && !selectedDate
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📆 เดือนนี้ (Month)
          </button>
        </div>

        {/* Dropdown Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Specific Date Picker */}
          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Store Filter */}
          <div>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">🏪 ทุกร้านค้า / จุดขาย</option>
              {staffStores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} (@{st.username})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">💳 ทุกวิธีชำระเงิน</option>
              <option value="CASH">💵 เงินสด (Cash)</option>
              <option value="QR">📱 สแกน QR / พร้อมเพย์</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่บิล, ชื่อพนักงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>
        </div>
      </div>

      {/* 4 Financial Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              ยอดขายรวมสุทธิ (Revenue)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            ฿{Number(kpis.totalRevenue).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">รายได้จากจุดขายหน้าร้าน</p>
        </div>

        {/* Card 2: Total Bills */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              จำนวนบิลทั้งหมด
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {kpis.totalBills} <span className="text-xs font-semibold text-slate-500">บิล</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">คำสั่งซื้อที่เสร็จสมบูรณ์</p>
        </div>

        {/* Card 3: Total Cups Sold */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              จำนวนแก้วที่ขายได้
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
            {kpis.totalCups} <span className="text-xs font-semibold text-slate-500">แก้ว</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ตัดสต็อกวัตถุดิบเรียบร้อย</p>
        </div>

        {/* Card 4: Average Ticket Size */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              ยอดเฉลี่ยต่อบิล
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 mt-1 font-mono">
            ฿{Number(kpis.averageTicket).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Average Order Value</p>
        </div>
      </div>

      {/* Visual Analytics Grid: Hourly Sales + Payment/Store Share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Distribution Chart */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800">ช่วงเวลายอดขายสูงสุด (Hourly Sales)</h3>
                <p className="text-[10px] text-slate-400">การกระจายตัวของรายได้ตามช่วงเวลา 08:00 - 21:00 น.</p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-44 flex items-end gap-1.5 sm:gap-2 justify-between">
              {hourlySales.map((h) => {
                const heightPercent = maxHourlyRevenue > 0 ? (h.revenue / maxHourlyRevenue) * 100 : 0;
                const hasSales = h.revenue > 0;

                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-md">
                      {h.label}: ฿{h.revenue} ({h.cups} แก้ว)
                    </div>

                    <div className="w-full bg-slate-100 rounded-t-md h-32 flex items-end overflow-hidden">
                      <div
                        style={{ height: `${Math.max(heightPercent, hasSales ? 8 : 0)}%` }}
                        className={`w-full transition-all duration-500 rounded-t-md ${
                          hasSales
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-500 group-hover:from-emerald-500 group-hover:to-teal-400'
                            : 'bg-transparent'
                        }`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 truncate">
                      {String(h.hour).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Payment Methods & Store Share */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">ช่องทางชำระเงิน & ยอดขายแยกตามสาขา</h3>
              <p className="text-[10px] text-slate-400">สัดส่วนเงินสดเทียบกับพร้อมเพย์ และผลงานแต่ละจุดขาย</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Payment Method Bars */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" /> เงินสด (Cash)
                </span>
                <span className="font-mono text-slate-800">
                  ฿{paymentBreakdown.cash.revenue.toLocaleString()} ({paymentBreakdown.cash.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  style={{ width: `${paymentBreakdown.cash.percentage}%` }}
                  className="h-full bg-emerald-600 transition-all duration-500"
                />
              </div>

              <div className="flex items-center justify-between font-bold pt-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-blue-600" /> สแกน QR / พร้อมเพย์
                </span>
                <span className="font-mono text-slate-800">
                  ฿{paymentBreakdown.qr.revenue.toLocaleString()} ({paymentBreakdown.qr.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  style={{ width: `${paymentBreakdown.qr.percentage}%` }}
                  className="h-full bg-blue-600 transition-all duration-500"
                />
              </div>
            </div>

            {/* Store Sales Share */}
            <div className="space-y-2">
              <div className="font-bold text-slate-700 text-[11px]">ยอดขายแยกตามร้านค้า:</div>
              <div className="space-y-2">
                {storeBreakdown.map((st) => (
                  <div
                    key={st.storeId}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-amber-600" />
                      <div>
                        <div className="font-bold text-slate-800">{st.storeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">@{st.username}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-700">
                        ฿{st.revenue.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {st.bills} บิล • {st.cups} แก้ว
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Best-Selling Products */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">อันดับเมนูเครื่องดื่มขายดี (Top Best-Sellers)</h3>
              <p className="text-[10px] text-slate-400">เรียงตามยอดขายรวมและจำนวนแก้วที่ขายได้</p>
            </div>
          </div>
        </div>

        {topProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">ยังไม่มีข้อมูลยอดขายเมนูสินค้า</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topProducts.slice(0, 6).map((prod, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              return (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-black w-6 text-center">{medal}</span>
                    <div>
                      <div className="font-bold text-slate-800">{prod.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ขายได้ {prod.qty} {prod.unit}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-700">
                      ฿{prod.revenue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">{prod.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sales Transactions Listing */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800">
              ตารางบิลการขายประจำวัน ({filteredSales.length} รายการ)
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดรายการบิลขาย...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <ShoppingCart className="w-10 h-10 text-slate-300" />
            <span>ไม่พบบิลการขายตามเงื่อนไขที่เลือก</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">เลขที่บิลขาย</th>
                  <th className="py-3.5 px-4">วันที่ & เวลา</th>
                  <th className="py-3.5 px-4">ร้านค้า / แคชเชียร์</th>
                  <th className="py-3.5 px-4">ช่องทางชำระเงิน</th>
                  <th className="py-3.5 px-4 text-center">จำนวนแก้ว</th>
                  <th className="py-3.5 px-4 text-right">ยอดรวมสุทธิ</th>
                  <th className="py-3.5 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSales.map((s) => {
                  const isCash = (s.paymentMethod || 'CASH').toUpperCase() === 'CASH';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSale(s)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Sale Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        <div className="group-hover:underline flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{s.saleNumber}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-bold text-slate-700">
                          {new Date(s.createdAt).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(s.createdAt).toLocaleTimeString('th-TH')} น.
                        </div>
                      </td>

                      {/* Store / Staff */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-amber-600" />
                          <span>{s.createdBy?.name || 'ร้านค้า'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          @{s.createdBy?.username}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4">
                        {isCash ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" /> เงินสด
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <QrCode className="w-3.5 h-3.5 text-blue-600" /> สแกน QR
                          </span>
                        )}
                      </td>

                      {/* Cups */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {s.totalItems} แก้ว
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-emerald-700">
                        ฿{Number(s.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(s);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                        >
                          ดูบิล
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

      {/* Detail Modal (Receipt Slip) */}
      {selectedSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ReceiptIcon />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">ใบเสร็จรับเงิน (Sales Receipt)</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedSale.saleNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ร้านค้า / สาขา:</span>
                  <span className="font-bold text-slate-800">{selectedSale.createdBy?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">วันที่ & เวลา:</span>
                  <span className="font-bold text-slate-700">
                    {new Date(selectedSale.createdAt).toLocaleString('th-TH')} น.
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">วิธีชำระเงิน:</span>
                  <span className="font-bold text-emerald-800">
                    {selectedSale.paymentMethod === 'CASH' ? '💵 เงินสด' : '📱 สแกน QR / พร้อมเพย์'}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="font-bold text-slate-700 text-[11px] pb-1 border-b border-slate-100">
                  รายการเครื่องดื่มในบิล ({selectedSale.items.length} รายการ):
                </div>
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{item.product?.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.quantity} x ฿{Number(item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-800">
                      ฿{Number(item.subtotal).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-900">ยอดชำระทั้งสิ้น:</span>
                <span className="font-mono font-black text-lg text-emerald-800">
                  ฿{Number(selectedSale.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบเสร็จ</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

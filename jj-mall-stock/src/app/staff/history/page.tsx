'use client';

import React, { useEffect, useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ShoppingBag,
  Search,
  Clock,
  Calendar,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  Eye,
  Receipt,
  X,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';

export default function StaffSalesHistoryPage() {
  const { user } = useAuth();

  // Filter mode: 'ALL' | 'DAILY' | 'MONTHLY' | 'YEARLY'
  const [filterMode, setFilterMode] = useState<'ALL' | 'DAILY' | 'MONTHLY' | 'YEARLY'>('DAILY');

  // Dates defaults (Thailand GMT+7)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const currentYearStr = useMemo(() => {
    return String(new Date().getFullYear());
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Selected Sale for detail modal
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Construct API URL with date/month/year params
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('myOnly', 'true');
    params.set('limit', '500');

    if (filterMode === 'DAILY' && selectedDate) {
      params.set('date', selectedDate);
    } else if (filterMode === 'MONTHLY' && selectedMonth) {
      params.set('month', selectedMonth);
    } else if (filterMode === 'YEARLY' && selectedYear) {
      params.set('year', selectedYear);
    }

    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }

    return `/api/sales?${params.toString()}`;
  }, [filterMode, selectedDate, selectedMonth, selectedYear, searchTerm]);

  const { data, isLoading, isValidating, mutate } = useSWR(apiUrl, (url) =>
    fetch(url).then((res) => (res.ok ? res.json() : null))
  );

  const rawSales: any[] = useMemo(() => {
    return data?.success && Array.isArray(data.sales) ? data.sales : [];
  }, [data]);

  // Client-side quick search filter
  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return rawSales;
    const q = searchTerm.trim().toLowerCase();
    return rawSales.filter((sale) => {
      const matchNumber = sale.saleNumber?.toLowerCase().includes(q);
      const matchPayment = sale.paymentMethod?.toLowerCase().includes(q);
      const matchItems = sale.items?.some((it: any) =>
        it.product?.name?.toLowerCase().includes(q)
      );
      return matchNumber || matchPayment || matchItems;
    });
  }, [rawSales, searchTerm]);

  const paginatedSales = useMemo(() => {
    return filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredSales, currentPage, pageSize]);

  // KPIs
  const totalBills = filteredSales.length;
  const totalCups = filteredSales.reduce((sum, s) => sum + (s.totalItems || 0), 0);
  const totalMoney = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  // Available Years list (5 years back to current)
  const availableYears = useMemo(() => {
    const curr = new Date().getFullYear();
    const years: number[] = [];
    for (let y = curr; y >= curr - 4; y--) {
      years.push(y);
    }
    return years;
  }, []);

  // Formatted Label for current view
  const currentFilterLabel = useMemo(() => {
    if (filterMode === 'ALL') return 'ประวัติการขายทั้งหมด';
    if (filterMode === 'DAILY') {
      if (!selectedDate) return 'ทุกวัน';
      const d = new Date(selectedDate);
      return `ยอดขายวันที่ ${d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;
    }
    if (filterMode === 'MONTHLY') {
      if (!selectedMonth) return 'ทุกเดือน';
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return `ยอดขายประจำเดือน ${d.toLocaleDateString('th-TH', {
        month: 'long',
        year: 'numeric',
      })}`;
    }
    if (filterMode === 'YEARLY') {
      return `ยอดขายประจำปี พ.ศ. ${Number(selectedYear) + 543} (${selectedYear})`;
    }
    return '';
  }, [filterMode, selectedDate, selectedMonth, selectedYear]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>ประวัติการขายของฉัน (My Sales Log)</span>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          disabled={isValidating}
          className="p-2 sm:px-3 sm:py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-sky-600' : ''}`} />
          <span>รีเฟรช</span>
        </button>
      </div>

      {/* Filter Panel: เลือก วัน / เดือน / ปี / ทั้งหมด */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filter Mode Selector Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit">
            <button
              onClick={() => {
                setFilterMode('DAILY');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'DAILY'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 รายวัน
            </button>
            <button
              onClick={() => {
                setFilterMode('MONTHLY');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'MONTHLY'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗓️ รายเดือน
            </button>
            <button
              onClick={() => {
                setFilterMode('YEARLY');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'YEARLY'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📈 รายปี
            </button>
            <button
              onClick={() => {
                setFilterMode('ALL');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌐 ทั้งหมด
            </button>
          </div>

          {/* Date Picker Specific Inputs */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterMode === 'DAILY' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayStr);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    selectedDate === todayStr
                      ? 'bg-sky-50 border-sky-300 text-sky-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  วันนี้
                </button>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {filterMode === 'MONTHLY' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(currentMonthStr);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    selectedMonth === currentMonthStr
                      ? 'bg-sky-50 border-sky-300 text-sky-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  เดือนนี้
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                />
              </div>
            )}

            {filterMode === 'YEARLY' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold">เลือกปี:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={String(y)}>
                      พ.ศ. {y + 543} ({y})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่บิลขาย หรือชื่อสินค้า..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5 self-start sm:self-auto">
            <span>แสดงผล:</span>
            <span className="text-sky-700 font-semibold">{currentFilterLabel}</span>
          </div>
        </div>
      </div>

      {/* 3 Quick KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase">จำนวนบิลที่เปิดขาย</div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {totalBills} <span className="text-xs font-semibold text-slate-500">บิล</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase">จำนวนแก้วที่ขายได้</div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {totalCups} <span className="text-xs font-semibold text-slate-500">แก้ว</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-emerald-600 uppercase">ยอดขายรวมในช่วงที่เลือก</div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            ฿{totalMoney.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading && rawSales.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดประวัติการขาย...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">ไม่พบประวัติการขายในช่วงเวลานี้</p>
            <p className="text-[11px] text-slate-400">ลองเปลี่ยนวันที่ เดือน หรือปี หรือเปลี่ยนคำค้นหาใหม่</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-3 text-center w-12 text-slate-400">#</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">เลขที่ใบเสร็จ</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">วันที่ / เวลา</th>
                    <th className="py-3.5 px-4">รายการสินค้า</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">วิธีชำระ</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">จำนวน</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">ยอดรวม</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">ดูบิล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedSales.map((sale, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                          {rowNumber}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {sale.saleNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(sale.createdAt).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {sale.items?.map((it: any) => `${it.product?.name} (${it.quantity})`).join(', ')}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sale.paymentMethod === 'QR' || sale.paymentMethod === 'PROMPTPAY'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {sale.paymentMethod === 'QR' || sale.paymentMethod === 'PROMPTPAY' ? 'สแกน QR' : 'เงินสด'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 whitespace-nowrap">
                          {sale.totalItems} แก้ว
                        </td>
                        <td className="py-3.5 px-4 text-right font-black font-mono text-slate-800 text-sm whitespace-nowrap">
                          ฿{Number(sale.totalAmount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedSale(sale)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700 transition-colors cursor-pointer"
                            title="ดูรายละเอียดใบเสร็จ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredSales.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Modal: รายละเอียดใบเสร็จรับเงิน (Receipt Detail Modal) */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Receipt className="w-4 h-4 text-sky-600" />
                <span>รายละเอียดบิลขาย #{selectedSale.saleNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Receipt Paper Style */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Shop / Time Header */}
              <div className="text-center border-b border-dashed border-slate-200 pb-3 space-y-0.5">
                <div className="text-sm font-black text-slate-800">
                  {selectedSale.createdBy?.name || user?.name || 'JJ Mall Café'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  วันที่: {new Date(selectedSale.createdAt).toLocaleString('th-TH')}
                </div>
                <div className="text-[11px] font-bold text-emerald-700 font-mono">
                  เลขที่บิล: {selectedSale.saleNumber}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border-b border-dashed border-slate-200 pb-3">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  รายการสินค้า ({selectedSale.totalItems} แก้ว)
                </div>
                <div className="space-y-1.5">
                  {selectedSale.items?.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between text-slate-700">
                      <div>
                        <span className="font-bold">{it.product?.name}</span>{' '}
                        <span className="text-slate-400">× {it.quantity}</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        ฿{Number(it.subtotal || it.unitPrice * it.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>ยอดเงินรวมทั้งสิ้น:</span>
                  <span className="font-mono text-emerald-700 text-base">
                    ฿{Number(selectedSale.totalAmount).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>วิธีชำระเงิน:</span>
                  <span className="font-bold text-slate-700">
                    {selectedSale.paymentMethod === 'QR' || selectedSale.paymentMethod === 'PROMPTPAY'
                      ? 'สแกน QR พร้อมเพย์'
                      : 'เงินสด (Cash)'}
                  </span>
                </div>
                {selectedSale.note && (
                  <div className="text-[11px] text-slate-400 pt-1">
                    หมายเหตุ: {selectedSale.note}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
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

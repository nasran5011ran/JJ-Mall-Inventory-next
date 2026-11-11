'use client';

import React, { useState, useMemo } from 'react';
import Pagination from '@/components/Pagination';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Wheat,
  Search,
  RefreshCw,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  X,
  PieChart,
  BarChart3,
  DollarSign,
  Boxes,
} from 'lucide-react';

interface IngredientReportItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  costPerUnit: number;
  openingStock: number;
  inboundQty: number;
  salesUsage: number;
  wasteQty: number;
  transferOut: number;
  currentStock: number;
  minStock: number;
  usedCost: number;
  wasteCost: number;
  inventoryValue: number;
  wastePercent: number;
}

interface ReportSummary {
  totalIngredientsCount: number;
  totalUsedCost: number;
  totalUsedVolume: number;
  totalWasteCost: number;
  totalInboundCost: number;
  totalInventoryValue: number;
  topUsedIngredients: IngredientReportItem[];
  categoryBreakdown: {
    category: string;
    count: number;
    usedCost: number;
    inventoryValue: number;
    percentage: number;
  }[];
}

export default function AdminIngredientsReportPage() {
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Build API URL
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    return `/api/admin/reports/ingredients?${params.toString()}`;
  }, [period, categoryFilter]);

  const { data: swrData, isLoading, isValidating, mutate } = useSWR(apiUrl);

  const reportItems: IngredientReportItem[] = swrData?.data?.items || [];
  const summary: ReportSummary | undefined = swrData?.data?.summary;
  const categories: string[] = swrData?.data?.categories || [];

  // Filtered Items by search query
  const filteredItems = useMemo(() => {
    if (!search.trim()) return reportItems;
    const q = search.toLowerCase();
    return reportItems.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [reportItems, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, period]);

  // Paginated items (10 items per page for screen view)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Period label for headers & printouts
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today':
        return 'วันนี้ (' + new Date().toLocaleDateString('th-TH') + ')';
      case '7days':
        return '7 วันล่าสุด';
      case '30days':
        return '30 วันล่าสุด';
      case 'all':
        return 'ข้อมูลทั้งหมด';
      default:
        return '30 วันล่าสุด';
    }
  }, [period]);

  // Export to Excel (CSV UTF-8 with BOM)
  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const exportTimeStr = new Date().toLocaleString('th-TH');
    const safeDate = new Date().toISOString().slice(0, 10);

    const totalUsedCost = filteredItems.reduce((sum, i) => sum + Number(i.usedCost || 0), 0);
    const totalInventoryVal = filteredItems.reduce((sum, i) => sum + Number(i.inventoryValue || 0), 0);

    // Title and Info Section
    const titleRows = [
      ['"รายงานการใช้วัตถุดิบและต้นทุน - JJ Mall Stock & Inventory Management"'],
      [`"หัวข้อรายงาน:","รายงานวิเคราะห์การใช้วัตถุดิบ สต็อก และอัตราการสูญเสีย (Ingredient Usage & Waste Report)"`],
      [`"รอบข้อมูล / วันที่:","${periodLabel}"`],
      [`"หมวดหมู่ที่เลือก:","${categoryFilter === 'ALL' ? 'ทุกหมวดหมู่' : categoryFilter}"`],
      [`"วันที่และเวลาที่ออกรายงาน:","${exportTimeStr} น."`],
      [`"สรุปภาพรวม:","จำนวนวัตถุดิบทั้งหมด ${filteredItems.length} รายการ","มูลค่าที่ใช้จริง ฿${totalUsedCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท","มูลค่าสต็อกคงเหลือ ฿${totalInventoryVal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท"`],
      [''], // Blank separator
    ];

    const headers = [
      'ลำดับ',
      'รอบข้อมูล / วันที่',
      'รหัสวัตถุดิบ',
      'ชื่อวัตถุดิบ',
      'หมวดหมู่',
      'หน่วยนับ',
      'สต็อกยกมา',
      'รับเข้าเพิ่ม',
      'ใช้ผลิต/ขาย',
      'ของเสีย/ตัดทิ้ง',
      'สต็อกคงเหลือปัจจุบัน',
      'ต้นทุนต่อหน่วย (บาท)',
      'มูลค่าต้นทุนที่ใช้จริง (บาท)',
      'มูลค่าสต็อกคงเหลือ (บาท)',
      'อัตราของเสีย (%)',
    ];

    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      `"${periodLabel}"`,
      `"${item.code}"`,
      `"${item.name}"`,
      `"${item.category}"`,
      `"${item.unit}"`,
      item.openingStock,
      item.inboundQty,
      item.salesUsage,
      item.wasteQty,
      item.currentStock,
      item.costPerUnit.toFixed(2),
      item.usedCost.toFixed(2),
      item.inventoryValue.toFixed(2),
      `"${item.wastePercent}%"`,
    ]);

    // Summary footer row
    const footerRow = [
      '""',
      '"รวมยอดทั้งสิ้น (TOTAL)"',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      totalUsedCost.toFixed(2),
      totalInventoryVal.toFixed(2),
      '""',
    ];

    const allRows = [
      ...titleRows.map((r) => r.join(',')),
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      footerRow.join(','),
    ];

    const csvContent = '\uFEFF' + allRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `รายงานการใช้วัตถุดิบ_JJMall_${period}_${safeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Normal Screen UI (Hidden on print so it occupies 0px and avoids blank pages) */}
      <div className="print:hidden space-y-6">
        {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            <Wheat className="w-4 h-4" />
            <span>รายงาน & การเงิน</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-slate-500 dark:text-slate-400">การใช้วัตถุดิบและต้นทุน</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>รายงานการใช้วัตถุดิบ (Ingredient Usage)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
              {filteredItems.length} รายการ
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            วิเคราะห์ปริมาณการใช้วัตถุดิบทำเครื่องดื่ม, ต้นทุนขาย (COGS), ของเสีย และมูลค่าสต็อกคงคลัง
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-emerald-600' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>ส่งออก Excel</span>
          </button>

          <button
            onClick={() => setPrintModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm shadow-emerald-700/20"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Period & Category Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Period Selector Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> ช่วงเวลา:
          </span>
          {[
            { key: 'today', label: 'วันนี้' },
            { key: '7days', label: '7 วันล่าสุด' },
            { key: '30days', label: '30 วันล่าสุด' },
            { key: 'all', label: 'ทั้งหมด' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                period === tab.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category & Search Filter */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">ทุกหมวดหมู่วัตถุดิบ</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัส หรือชื่อวัตถุดิบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Cost Used */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
              {periodLabel}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ต้นทุนวัตถุดิบที่ใช้ไป (COGS)
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              ฿{summary ? summary.totalUsedCost.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ปริมาณใช้ออกรวม: <span className="font-bold text-slate-700 dark:text-slate-300">{summary ? summary.totalUsedVolume.toLocaleString('th-TH') : 0} หน่วย</span>
            </p>
          </div>
        </div>

        {/* Card 2: Waste Loss Cost */}
        <div className="bg-gradient-to-br from-rose-500/10 via-red-500/5 to-transparent bg-white dark:bg-slate-900 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
              ของเสีย/ปรับลด
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              มูลค่าสูญเสีย / ตัดทิ้ง (Waste)
            </p>
            <h3 className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-0.5 font-mono">
              ฿{summary ? summary.totalWasteCost.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              จากรายการชำรุด, หมดอายุ, หรือทำหก
            </p>
          </div>
        </div>

        {/* Card 3: Current Stock Valuation */}
        <div className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent bg-white dark:bg-slate-900 p-5 rounded-2xl border border-blue-200 dark:border-blue-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
              คงคลังปัจจุบัน
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              มูลค่าสต็อกคงเหลือรวม
            </p>
            <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-0.5 font-mono">
              ฿{summary ? summary.totalInventoryValue.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              จากวัตถุดิบทั้งหมด {reportItems.length} ชนิด
            </p>
          </div>
        </div>

        {/* Card 4: Inbound / Purchases */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
              รับเข้าสต็อก
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              มูลค่ารับเข้าเพิ่มในช่วงเวลา
            </p>
            <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-0.5 font-mono">
              ฿{summary ? summary.totalInboundCost.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              สั่งซื้อเข้าคลัง + ปรับปรุงยอดเพิ่ม
            </p>
          </div>
        </div>
      </div>

      {/* 4. Visual Insights: Top 5 High-Usage Ingredients & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 High Usage */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                🏆
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  5 อันดับวัตถุดิบที่มีต้นทุนการใช้สูงสุด
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  คำนวณจากปริมาณใช้ออก × ต้นทุนต่อหน่วย ({periodLabel})
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {summary?.topUsedIngredients && summary.topUsedIngredients.length > 0 ? (
              summary.topUsedIngredients.map((item, idx) => {
                const percentOfTotal =
                  summary.totalUsedCost > 0
                    ? ((item.usedCost / summary.totalUsedCost) * 100).toFixed(1)
                    : '0';

                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">({item.code})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          ฿{item.usedCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                          ({percentOfTotal}%)
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, parseFloat(percentOfTotal)))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีข้อมูลการใช้วัตถุดิบในช่วงเวลานี้
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  สัดส่วนต้นทุนแยกตามหมวดหมู่
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  สัดส่วนมูลค่าต้นทุนที่ใช้และมูลค่าสต็อกปัจจุบัน
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 ? (
              summary.categoryBreakdown.map((cat, idx) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{cat.category}</p>
                      <p className="text-[10px] text-slate-400">{cat.count} รายการ</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 dark:text-white font-mono">
                      ฿{cat.usedCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                      {cat.percentage}% ของต้นทุนรวม
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีข้อมูลหมวดหมู่
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Detailed Ingredient Usage Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wheat className="w-4 h-4 text-emerald-600" />
              <span>ตารางรายงานสรุปการใช้วัตถุดิบและมูลค่า</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              แสดงการเคลื่อนไหวสต็อก (ยกมา, รับเข้า, ใช้ออก, เสียหาย) พร้อมคำนวณต้นทุนต่อหน่วยและมูลค่ารวม
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-slate-500">
            แสดง {filteredItems.length} จาก {reportItems.length} รายการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                <th className="py-3 px-3 w-28">รหัสวัตถุดิบ</th>
                <th className="py-3 px-3 min-w-[180px]">ชื่อวัตถุดิบ</th>
                <th className="py-3 px-2 text-center w-24">หมวดหมู่</th>
                <th className="py-3 px-2 text-center w-16">หน่วย</th>
                <th className="py-3 px-2 text-right w-20">ยกมา</th>
                <th className="py-3 px-2 text-right w-20 text-emerald-700 dark:text-emerald-400">รับเข้า</th>
                <th className="py-3 px-2 text-right w-24 text-blue-700 dark:text-blue-400">ใช้ผลิต/ขาย</th>
                <th className="py-3 px-2 text-right w-20 text-rose-700 dark:text-rose-400">ของเสีย</th>
                <th className="py-3 px-2 text-right w-24 font-black">คงเหลือ</th>
                <th className="py-3 px-2 text-right w-20">ต้นทุน/หน่วย</th>
                <th className="py-3 px-3 text-right w-28 text-emerald-700 dark:text-emerald-400 font-black">
                  มูลค่าใช้จริง
                </th>
                <th className="py-3 px-2 text-center w-20">ของเสีย %</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span>กำลังโหลดข้อมูลรายงานวัตถุดิบ...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    ไม่พบรายการวัตถุดิบที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Code */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {item.code}
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.category}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 font-medium">
                      {item.unit}
                    </td>

                    {/* Opening */}
                    <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                      {item.openingStock.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Inbound */}
                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.inboundQty > 0
                        ? `+${item.inboundQty.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </td>

                    {/* Sales Usage */}
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.salesUsage > 0
                        ? item.salesUsage.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                        : '-'}
                    </td>

                    {/* Waste */}
                    <td className="py-2.5 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                      {item.wasteQty > 0
                        ? `(${item.wasteQty.toLocaleString('th-TH', { minimumFractionDigits: 2 })})`
                        : '-'}
                    </td>

                    {/* Current Stock */}
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {item.currentStock.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Cost Per Unit */}
                    <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                      ฿{item.costPerUnit.toFixed(2)}
                    </td>

                    {/* Total Used Cost */}
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ฿{item.usedCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Waste Percentage */}
                    <td className="py-2.5 px-2 text-center font-mono">
                      {item.wastePercent > 0 ? (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.wastePercent > 5
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {item.wastePercent}%
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">0%</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredItems.length > 0 && summary && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={5} className="py-3 px-3 text-right">
                    ยอดรวมทั้งหมด ({filteredItems.length} รายการ):
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    {filteredItems
                      .reduce((acc, i) => acc + i.openingStock, 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {filteredItems
                      .reduce((acc, i) => acc + i.inboundQty, 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-blue-700 dark:text-blue-400">
                    {filteredItems
                      .reduce((acc, i) => acc + i.salesUsage, 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-rose-700 dark:text-rose-400">
                    {filteredItems
                      .reduce((acc, i) => acc + i.wasteQty, 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right font-mono">
                    {filteredItems
                      .reduce((acc, i) => acc + i.currentStock, 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right text-slate-400">-</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">
                    ฿
                    {filteredItems
                      .reduce((acc, i) => acc + i.usedCost, 0)
                      .toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-slate-400">-</td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Pagination (10 items per page) */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
      </div>

      {/* 6. Printable Official Report Modal */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6 print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Toolbar (Hidden when printing) */}
          <div className="no-print w-full max-w-4xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างพิมพ์รายงานสรุปการใช้วัตถุดิบและต้นทุน (A4 แนวนอน)
                </h4>
                <p className="text-[11px] text-slate-500">
                  รายงานสรุปการใช้วัตถุดิบ ปริมาณขาย ของเสีย และต้นทุนสินค้า (สีขาว-ดำ ทางการ)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-600 font-medium bg-slate-100 px-3 py-1.5 rounded-xl">
                รวมทั้งหมด <span className="font-bold font-mono text-slate-900">{filteredItems.length}</span> รายการ
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Document Sheet (Standard Official Monochrome Black & White) */}
          <div
            id="official-ingredient-print-report"
            className="w-full max-w-4xl mx-auto bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-black font-sans text-[11px] leading-normal relative my-2 print:my-0 print:border-none print:shadow-none print:p-0 space-y-4"
          >
            {/* Top Right Reference Meta */}
            <div className="absolute top-4 right-6 text-right text-[10px] text-black font-mono leading-tight">
              <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
              <div>RTTR070ATHA.QRP</div>
            </div>

            {/* Document Header */}
            <div className="relative pb-2 mb-3 border-b border-black">
              {/* Company & Document Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-semibold text-black tracking-tight uppercase">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-normal text-black">
                  รายงานสรุปการใช้วัตถุดิบและมูลค่าต้นทุนสินค้า (Ingredient Usage & Cost Analysis Report)
                </h3>
              </div>

              {/* Sub-Header: Date, Filter Info */}
              <div className="mt-3.5 flex items-center justify-between text-[11px] font-normal border-t border-black pt-2 text-black">
                <div className="flex items-center gap-5">
                  <div>
                    <span className="font-medium">ช่วงเวลา: </span>
                    <span className="font-mono">{periodLabel}</span>
                  </div>
                  {categoryFilter !== 'ALL' && (
                    <div>
                      <span className="font-medium">หมวดหมู่: </span>
                      <span>{categoryFilter}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">จำนวนรายการ: </span>
                    <span className="font-mono">{filteredItems.length}</span> รายการ
                  </div>
                </div>
                <div>
                  <span className="font-medium">พิมพ์เมื่อ: </span>
                  <span className="font-mono">
                    {new Date().toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} น.
                  </span>
                </div>
              </div>
            </div>

            {/* Print Table Section */}
            <div className="pt-1 text-black space-y-1.5">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10.5px] font-medium text-black">
                  รายละเอียดรายการใช้วัตถุดิบและต้นทุน (Ingredient Usage & Cost Ledger)
                </span>
                <span className="text-[9.5px] text-black font-mono">
                  แสดงทั้งหมด {filteredItems.length} รายการ
                </span>
              </div>
              <div className="border border-black overflow-hidden bg-white">
                <table className="w-full text-left text-[9.5px] border-collapse text-black font-normal">
                  <thead>
                    <tr className="border-b border-black text-black font-semibold bg-white text-center">
                      <th className="py-1.5 px-1.5 border-r border-black w-8 text-center">ลำดับ</th>
                      <th className="py-1.5 px-2 border-r border-black w-24">รหัสวัตถุดิบ</th>
                      <th className="py-1.5 px-2.5 border-r border-black text-left">ชื่อวัตถุดิบ</th>
                      <th className="py-1.5 px-2 border-r border-black w-20 text-center">หมวดหมู่</th>
                      <th className="py-1.5 px-1.5 border-r border-black w-12 text-center">หน่วย</th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-16">ยกมา</th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-16">รับเข้า</th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-20">ใช้ผลิต/ขาย</th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-16">ของเสีย</th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-20">คงเหลือ</th>
                      <th className="py-1.5 px-2 border-r border-black text-right w-16">ต้นทุน/หน.</th>
                      <th className="py-1.5 px-2.5 text-right w-24">มูลค่าใช้จริง (฿)</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-black font-mono text-black font-normal">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-4 text-center text-black font-sans">
                          ไม่พบข้อมูลการใช้วัตถุดิบในช่วงเวลาที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-black hover:bg-slate-50/50">
                          <td className="py-1 px-1.5 text-center border-r border-black font-sans text-black">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-2 border-r border-black text-black whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="py-1 px-2.5 border-r border-black font-sans text-black truncate max-w-[180px] text-left">
                            {item.name}
                          </td>
                          <td className="py-1 px-2 border-r border-black text-center font-sans text-black">
                            {item.category}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-center font-sans text-black">
                            {item.unit}
                          </td>
                          <td className="py-1 px-2 text-right border-r border-black text-black">
                            {item.openingStock.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-right border-r border-black text-black">
                            {item.inboundQty > 0 ? item.inboundQty.toFixed(2) : '-'}
                          </td>
                          <td className="py-1 px-2 text-right border-r border-black text-black">
                            {item.salesUsage > 0 ? `(${item.salesUsage.toFixed(2)})` : '-'}
                          </td>
                          <td className="py-1 px-2 text-right border-r border-black text-black">
                            {item.wasteQty > 0 ? `(${item.wasteQty.toFixed(2)})` : '-'}
                          </td>
                          <td className="py-1 px-2 text-right border-r border-black text-black">
                            {item.currentStock.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-right border-r border-black text-black">
                            {item.costPerUnit.toFixed(2)}
                          </td>
                          <td className="py-1 px-2.5 text-right font-medium text-black">
                            {item.usedCost > 0 ? item.usedCost.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {filteredItems.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-black font-semibold text-black bg-white text-[10px]">
                        <td colSpan={5} className="py-1.5 px-2.5 text-right border-r border-black font-sans">
                          รวมทั้งสิ้น ({filteredItems.length} รายการ):
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-black font-mono">
                          {filteredItems.reduce((acc, i) => acc + i.openingStock, 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-black font-mono">
                          {filteredItems.reduce((acc, i) => acc + i.inboundQty, 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-black font-mono">
                          ({filteredItems.reduce((acc, i) => acc + i.salesUsage, 0).toFixed(2)})
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-black font-mono">
                          ({filteredItems.reduce((acc, i) => acc + i.wasteQty, 0).toFixed(2)})
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-black font-mono">
                          {filteredItems.reduce((acc, i) => acc + i.currentStock, 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-black text-black">-</td>
                        <td className="py-1.5 px-2.5 text-right font-semibold font-mono">
                          ฿{filteredItems.reduce((acc, i) => acc + i.usedCost, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Bottom 3 Signature Blocks */}
            <div className="print-signature-section mt-6 pt-4 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-medium text-black">ผู้จัดทำรายงาน (สโตร์ / เจ้าหน้าที่คลัง)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-medium text-black">ผู้ตรวจสอบ (ผู้จัดการสาขา)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-medium text-black">ผู้อนุมัติ (ฝ่ายบัญชี / ต้นทุน)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  Clock,
  Download,
  Printer,
  X,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Info,
  Calendar,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

interface DoHItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  totalValue: number;
  dailyUsage: number;
  doh: number;
  healthStatus: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'OPTIMAL' | 'OVERSTOCK';
  riskLabel: string;
  recommendedReorder: number;
}

export default function AdminStockReportPage() {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // SWR URL with filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    return `/api/admin/reports/stock?${params.toString()}`;
  }, [categoryFilter, statusFilter]);

  const { data: swrData, isLoading, isValidating, mutate } = useSWR(apiUrl);

  const items: DoHItem[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.items) ? swrData.items : [];
  }, [swrData]);

  const categories: string[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.categories) ? swrData.categories : [];
  }, [swrData]);

  const kpis = swrData?.kpis || {
    totalIngredients: 0,
    totalStockValue: 0,
    criticalCount: 0,
    lowCount: 0,
    optimalCount: 0,
    overstockCount: 0,
  };

  const loading = isLoading && items.length === 0;

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState<DoHItem | null>(null);

  // Search Filter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [items, search]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'รหัสวัตถุดิบ (Code)',
      'ชื่อวัตถุดิบ',
      'หมวดหมู่',
      'คงเหลือปัจจุบัน',
      'เกณฑ์ขั้นต่ำ (Min Stock)',
      'หน่วย',
      'สถานะสต็อก',
      'ต้นทุน/หน่วย (บาท)',
      'มูลค่ารวม (บาท)',
      'แนะนำสั่งเพิ่ม',
    ];

    const rows = filteredItems.map((i) => [
      `"${i.code}"`,
      `"${i.name}"`,
      `"${i.category}"`,
      i.currentStock,
      i.minStock,
      `"${i.unit}"`,
      `"${i.riskLabel}"`,
      i.costPerUnit,
      i.totalValue,
      `"${i.recommendedReorder > 0 ? 'ควรสั่งซื้อเพิ่ม' : 'สต็อกเพียงพอ'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `JJ_Mall_Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Stock Status Badge (Simple & Clear)
  const getStockStatusBadge = (item: DoHItem) => {
    switch (item.healthStatus) {
      case 'OUT_OF_STOCK':
        return {
          label: 'สินค้าหมด (0)',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 font-black',
        };
      case 'CRITICAL':
        return {
          label: 'วิกฤต ต่ำกว่า Min',
          badgeClass: 'bg-red-50 text-red-700 border-red-300 font-black animate-pulse',
        };
      case 'LOW':
        return {
          label: 'ใกล้หมด (เฝ้าระวัง)',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
        };
      default:
        return {
          label: 'สต็อกเพียงพอ',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Normal Screen View (Hidden on print) */}
      <div className="print:hidden space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            รายงานสรุปสต็อกคงคลังและมูลค่าสินค้า เปรียบเทียบกับเกณฑ์ขั้นต่ำ (Min Stock) เพื่อวางแผนสั่งซื้อ
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
            onClick={() => setPrintModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>พิมพ์ตารางสต็อก</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Stock Value */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              มูลค่าสต็อกรวมในคลัง
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            ฿{Number(kpis.totalStockValue).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">รวม {kpis.totalIngredients} ชนิดวัตถุดิบ</p>
        </div>

        {/* Card 2: Critical Items */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            statusFilter === 'CRITICAL'
              ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
              วิกฤต / ต้องสั่งด่วน
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 mt-1 font-mono">
            {kpis.criticalCount} <span className="text-xs font-semibold text-slate-500">ชนิด</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">สต็อกต่ำกว่าเกณฑ์ขั้นต่ำ (Min)</p>
        </div>

        {/* Card 3: Low Stock Warning */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            statusFilter === 'LOW'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              ใกล้หมด / เฝ้าระวัง
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
            {kpis.lowCount} <span className="text-xs font-semibold text-slate-500">ชนิด</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ใกล้ถึงเกณฑ์ขั้นต่ำ (Min)</p>
        </div>

        {/* Card 4: Optimal / Safe Stock */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'OPTIMAL' ? 'ALL' : 'OPTIMAL')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            statusFilter === 'OPTIMAL'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              สต็อกเพียงพอ / ปกติ
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {kpis.optimalCount} <span className="text-xs font-semibold text-slate-500">ชนิด</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ปริมาณสต็อกอยู่ในระดับปลอดภัย</p>
        </div>
      </div>

      {/* Filter Ribbon & Category Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'ALL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({kpis.totalIngredients})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('CRITICAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'CRITICAL'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ต้องสั่งด่วน ({kpis.criticalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('LOW')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'LOW'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>ใกล้หมด ({kpis.lowCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('OPTIMAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'OPTIMAL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>สต็อกปกติ ({kpis.optimalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('OVERSTOCK')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'OVERSTOCK'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>สต็อกเกิน ({kpis.overstockCount})</span>
          </button>
        </div>

        {/* Category & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">📦 ทุกหมวดหมู่วัตถุดิบ</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อวัตถุดิบ, รหัสวัตถุดิบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>
        </div>
      </div>

      {/* DoH Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังคำนวณรายงานสต็อกและระยะเวลาคงคลัง (DoH)...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-10 h-10 text-slate-300" />
            <span>ไม่พบวัตถุดิบตามเงื่อนไขที่เลือก</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">รหัส / ชื่อวัตถุดิบ</th>
                  <th className="py-3.5 px-4 text-center">หมวดหมู่</th>
                  <th className="py-3.5 px-4 text-right">คงเหลือปัจจุบัน</th>
                  <th className="py-3.5 px-4 text-right">เกณฑ์ขั้นต่ำ (Min)</th>
                  <th className="py-3.5 px-4 text-center">สถานะสต็อก</th>
                  <th className="py-3.5 px-4 text-right">ต้นทุน/หน่วย</th>
                  <th className="py-3.5 px-4 text-right">มูลค่าสต็อกรวม</th>
                  <th className="py-3.5 px-4 text-center">คำแนะนำสั่งซื้อ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredItems.map((item) => {
                  const statusBadge = getStockStatusBadge(item);
                  const isCritical = item.healthStatus === 'CRITICAL' || item.healthStatus === 'OUT_OF_STOCK';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isCritical ? 'bg-red-50/30' : ''
                      }`}
                    >
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 group-hover:underline flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.code}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={item.currentStock <= item.minStock ? 'text-red-600 font-black' : 'text-slate-800'}>
                          {item.currentStock.toLocaleString()} {item.unit}
                        </span>
                      </td>

                      {/* Min Stock */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {item.minStock.toLocaleString()} {item.unit}
                      </td>

                      {/* Stock Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${statusBadge.badgeClass}`}
                        >
                          <span>{statusBadge.label}</span>
                        </span>
                      </td>

                      {/* Cost per unit */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        ฿{item.costPerUnit.toFixed(2)}
                      </td>

                      {/* Total Value */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        ฿{item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Reorder Recommendation */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {item.recommendedReorder > 0 ? (
                          <Link
                            href={`/admin/stock-in?code=${item.code}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-2xs transition-colors"
                            title="คลิกเพื่อเปิดหน้ารับเข้าสต็อก"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>ควรสั่งซื้อเพิ่ม</span>
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>สต็อกเพียงพอ</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Modal: Item Stock Profile Detail */}
      {selectedItem && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">{selectedItem.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedItem.code} • {selectedItem.category}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">สถานะสต็อก:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${getStockStatusBadge(selectedItem).badgeClass}`}>
                    {selectedItem.riskLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ยอดคงเหลือปัจจุบัน:</span>
                  <span className="font-bold font-mono text-slate-800 text-sm">
                    {selectedItem.currentStock.toLocaleString()} {selectedItem.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">เกณฑ์ขั้นต่ำ (Min Stock):</span>
                  <span className="font-mono text-slate-700">
                    {selectedItem.minStock.toLocaleString()} {selectedItem.unit}
                  </span>
                </div>
              </div>

              {/* Valuation */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-[10px]">ต้นทุน ฿{selectedItem.costPerUnit.toFixed(2)} / {selectedItem.unit}</div>
                  <div className="font-bold text-emerald-900">มูลค่าสต็อกคงเหลือรวม:</div>
                </div>
                <div className="font-mono font-black text-base text-emerald-800">
                  ฿{selectedItem.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {selectedItem.recommendedReorder > 0 && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>คำแนะนำการเติมสต็อก:</span>
                  </div>
                  <p className="text-[11px]">
                    สต็อกปัจจุบันต่ำกว่าเกณฑ์ขั้นต่ำ (Min Stock) แนะนำให้เปิดใบสั่งซื้อเข้าคลังเพื่อเติมสต็อกให้อยู่ในระดับปลอดภัย
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              {selectedItem.recommendedReorder > 0 ? (
                <Link
                  href="/admin/stock-in"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>ไปหน้าบันทึกรับเข้าคลัง</span>
                </Link>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Stock Inventory Report Print Preview Modal */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6 print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print w-full max-w-4xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ตัวอย่างพิมพ์รายงานสรุปสต็อกสินค้าคงคลังและมูลค่า (A4 แนวนอน)
                </h3>
                <p className="text-[11px] text-slate-500">
                  รายงานสรุปสต็อกสินค้าคงคลังและมูลค่าตามเงื่อนไขตัวกรอง (สีขาว-ดำ ทางการ)
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
            id="official-stock-inventory-report"
            className="w-full max-w-4xl mx-auto bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-black font-sans text-[11px] leading-normal relative my-2 print:my-0 print:border-none print:shadow-none print:p-0 space-y-5"
          >
            {/* Top Right Reference Meta */}
            <div className="absolute top-4 right-6 text-right text-[10px] text-black font-mono leading-tight">
              <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
              <div>RTTR080ATHA.QRP</div>
            </div>

            {/* Document Header */}
            <div className="relative pb-2 mb-3 border-b border-black">
              {/* Company & Document Title */}
              <div className="text-center space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-black tracking-tight uppercase">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  รายงานสรุปสต็อกสินค้าคงคลังและมูลค่า (Stock Inventory & Valuation Report)
                </h3>
              </div>

              {/* Sub-Header: Filter Info */}
              <div className="mt-4 flex items-center justify-between text-[11px] font-medium border-t border-black pt-2.5 text-black">
                <div className="flex items-center gap-5">
                  <div>
                    <span className="font-bold">หมวดหมู่: </span>
                    <span>{categoryFilter === 'ALL' ? 'ทุกหมวดหมู่' : categoryFilter}</span>
                  </div>
                  <div>
                    <span className="font-bold">สถานะสต็อก: </span>
                    <span>
                      {statusFilter === 'ALL'
                        ? 'ทั้งหมด'
                        : statusFilter === 'CRITICAL'
                        ? 'วิกฤต/ต้องสั่งด่วน'
                        : statusFilter === 'LOW'
                        ? 'ใกล้หมด'
                        : 'สต็อกปกติ'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">จำนวนรายการ: </span>
                    <span className="font-bold font-mono">{filteredItems.length}</span> รายการ
                  </div>
                </div>
                <div>
                  <span className="font-bold">พิมพ์เมื่อ: </span>
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

            {/* 4 Primary KPI Summary Cards Strip (Monochrome Black & White) */}
            <div className="print-avoid-break grid grid-cols-4 gap-3.5 text-center my-4 text-black">
              <div className="p-3 border border-black bg-white flex flex-col justify-between">
                <div className="text-[10.5px] font-bold text-black">มูลค่าสต็อกรวมในคลัง</div>
                <div className="text-base font-black font-mono text-black my-1">
                  ฿{Number(kpis.totalStockValue).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[9.5px] text-black">บาท</div>
              </div>

              <div className="p-3 border border-black bg-white flex flex-col justify-between">
                <div className="text-[10.5px] font-bold text-black">จำนวนวัตถุดิบทั้งหมด</div>
                <div className="text-base font-black font-mono text-black my-1">
                  {kpis.totalIngredients}
                </div>
                <div className="text-[9.5px] text-black">รายการ / ชนิด</div>
              </div>

              <div className="p-3 border border-black bg-white flex flex-col justify-between">
                <div className="text-[10.5px] font-bold text-black">วิกฤต / ต้องสั่งด่วน (ต่ำกว่า Min)</div>
                <div className="text-base font-black font-mono text-black my-1">
                  {kpis.criticalCount}
                </div>
                <div className="text-[9.5px] text-black">รายการ</div>
              </div>

              <div className="p-3 border border-black bg-white flex flex-col justify-between">
                <div className="text-[10.5px] font-bold text-black">ใกล้หมด (เฝ้าระวัง)</div>
                <div className="text-base font-black font-mono text-black my-1">
                  {kpis.lowCount}
                </div>
                <div className="text-[9.5px] text-black">รายการ</div>
              </div>
            </div>

            {/* Official Stock Table Section */}
            <div className="pt-2 text-black space-y-1.5">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold text-black">
                  รายละเอียดรายการสต็อกสินค้าคงคลังและมูลค่า (Stock Items Inventory Ledger)
                </span>
                <span className="text-[10px] text-black font-mono">
                  แสดงทั้งหมด {filteredItems.length} รายการ
                </span>
              </div>
              <div className="border border-black overflow-hidden bg-white">
                <table className="w-full text-left text-[9.5px] border-collapse text-black">
                  <thead>
                    <tr className="border-b border-black text-black font-bold bg-white text-center">
                      <th className="py-2 px-2 border-r border-black w-8 text-center">ลำดับ</th>
                      <th className="py-2 px-2 border-r border-black w-24">รหัสวัตถุดิบ</th>
                      <th className="py-2 px-3 border-r border-black text-left">ชื่อวัตถุดิบ</th>
                      <th className="py-2 px-2 border-r border-black w-24">หมวดหมู่</th>
                      <th className="py-2 px-2 border-r border-black w-12 text-center">หน่วย</th>
                      <th className="py-2 px-2.5 border-r border-black text-right w-20">คงเหลือปัจจุบัน</th>
                      <th className="py-2 px-2.5 border-r border-black text-right w-20">เกณฑ์ขั้นต่ำ (Min)</th>
                      <th className="py-2 px-2.5 border-r border-black text-right w-18">ต้นทุน/หน่วย</th>
                      <th className="py-2 px-3 border-r border-black text-right w-24">มูลค่ารวม (บาท)</th>
                      <th className="py-2 px-2 border-r border-black text-center w-24">สถานะสต็อก</th>
                      <th className="py-2 px-2 text-center w-24">ข้อเสนอแนะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-mono text-black">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-4 text-center text-black font-sans">
                          ไม่พบข้อมูลสต็อกวัตถุดิบตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const statusBadge = getStockStatusBadge(item);

                        return (
                          <tr key={item.id} className="border-b border-black hover:bg-slate-50/50">
                            <td className="py-1.5 px-2 text-center font-sans text-black border-r border-black">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2 border-r border-black font-bold text-black font-mono">
                              {item.code}
                            </td>
                            <td className="py-1.5 px-3 border-r border-black font-sans font-bold text-black text-left">
                              {item.name}
                            </td>
                            <td className="py-1.5 px-2 border-r border-black text-center font-sans text-black">
                              {item.category}
                            </td>
                            <td className="py-1.5 px-2 border-r border-black text-center font-sans text-black">
                              {item.unit}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-black text-right font-bold text-black font-mono">
                              {item.currentStock.toLocaleString()}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-black text-right text-black font-mono">
                              {item.minStock.toLocaleString()}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-black text-right font-mono text-black">
                              {item.costPerUnit.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-3 border-r border-black text-right font-bold text-black font-mono">
                              {item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-2 border-r border-black text-center font-sans font-bold text-black">
                              {statusBadge.label}
                            </td>
                            <td className="py-1.5 px-2 text-center font-sans text-[9px] text-black">
                              {item.recommendedReorder > 0 ? 'ควรสั่งซื้อเพิ่ม' : 'ปกติ'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredItems.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-black font-bold text-black bg-white text-[10px]">
                        <td colSpan={8} className="py-2 px-3 text-right font-sans border-r border-black">
                          รวมมูลค่าสต็อกคงคลังทั้งสิ้น ({filteredItems.length} รายการ):
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-black border-r border-black font-black">
                          ฿{filteredItems.reduce((acc, i) => acc + i.totalValue, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} className="py-2 px-2 text-center text-black font-sans text-[9px]">
                          สถานะ: {kpis.criticalCount > 0 ? `วิกฤต ${kpis.criticalCount} รายการ` : 'ระดับสต็อกปลอดภัย'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Official 3 Signature Blocks */}
            <div className="print-signature-section mt-6 pt-4 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้จัดทำรายงาน (เจ้าหน้าที่สต็อก / แคชเชียร์)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจสอบสต็อก (ผู้จัดการสาขา)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้มีอำนาจอนุมัติ / ฝ่ายบัญชี</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

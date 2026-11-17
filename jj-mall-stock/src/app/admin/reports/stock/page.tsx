'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  Download,
  Printer,
  X,
  Package,
  Layers,
  CheckCircle2,
  ShoppingBag,
  Store,
} from 'lucide-react';

interface StoreInfo {
  id: number;
  name: string;
  username: string;
}

interface StockReportItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  openingQuantity: number;
  inboundQuantity: number;
  salesQuantity: number;
  wasteQuantity: number;
  totalOutQuantity: number;
  currentStock: number;
  costPerUnit: number;
  totalValue: number;
  healthStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
  riskLabel: string;
  storeName: string;
}

export default function AdminStockReportPage() {
  const [storeId, setStoreId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | IN_STOCK | OUT_OF_STOCK
  const [search, setSearch] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // SWR URL with filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (storeId) params.set('storeId', storeId);
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    return `/api/admin/reports/stock?${params.toString()}`;
  }, [storeId, categoryFilter, statusFilter]);

  const { data: swrData, isLoading, isValidating, mutate } = useSWR(apiUrl);

  const stores: StoreInfo[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.stores) ? swrData.stores : [];
  }, [swrData]);

  const selectedStore: StoreInfo | null = useMemo(() => {
    return swrData?.success && swrData.selectedStore ? swrData.selectedStore : stores[0] || null;
  }, [swrData, stores]);

  const items: StockReportItem[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.items) ? swrData.items : [];
  }, [swrData]);

  const categories: string[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.categories) ? swrData.categories : [];
  }, [swrData]);

  const kpis = swrData?.kpis || {
    totalIngredients: 0,
    totalStockValue: 0,
    inStockCount: 0,
    outOfStockCount: 0,
  };

  const loading = isLoading && items.length === 0;

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState<StockReportItem | null>(null);

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

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, storeId, categoryFilter, statusFilter]);

  // Paginated items (10 items per page for screen view)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'รหัสวัตถุดิบ (Code)',
      'ชื่อวัตถุดิบ',
      'หมวดหมู่',
      'ร้านค้า',
      'ยอดยกมา',
      'รับเข้า (+)',
      'จ่ายออก/ขาย (-)',
      'คงเหลือปัจจุบัน',
      'หน่วย',
      'ต้นทุน/หน่วย (บาท)',
      'มูลค่ารวม (บาท)',
      'สถานะสต็อก',
    ];

    const rows = filteredItems.map((i) => [
      `"${i.code}"`,
      `"${i.name}"`,
      `"${i.category}"`,
      `"${i.storeName}"`,
      i.openingQuantity,
      i.inboundQuantity,
      i.totalOutQuantity,
      i.currentStock,
      `"${i.unit}"`,
      i.costPerUnit,
      i.totalValue,
      `"${i.riskLabel}"`,
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

  // Helper for Stock Status Badge
  const getStockStatusBadge = (item: StockReportItem) => {
    if (item.healthStatus === 'OUT_OF_STOCK') {
      return {
        label: 'สต็อกหมด (0)',
        badgeClass: 'bg-red-50 text-red-700 border-red-200 font-bold',
      };
    }
    return {
      label: 'มีสต็อกพร้อมใช้',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold',
    };
  };

  return (
    <div className="space-y-6">
      {/* Normal Screen View (Hidden on print) */}
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">
              รายงานสรุปสต็อกคงเหลือ ความเคลื่อนไหว และมูลค่าสินค้าของร้านค้า (ยอดยกมา + รับเข้า - จ่ายออก/ขาย POS)
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

        {/* Store Selection Tabs */}
        {stores.length > 0 && (
          <div className="flex">
            <div className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto border border-slate-200">
              <div className="px-3 py-1.5 text-xs font-bold text-slate-500 flex items-center shrink-0">
                <span>เลือกร้านค้า:</span>
              </div>
              {stores.map((st) => {
                const isSelected = String(selectedStore?.id) === String(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStoreId(String(st.id))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>สต็อกร้าน: {st.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 Primary KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Stock Value */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                มูลค่าสต็อกรวมในร้าน
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              ฿{Number(kpis.totalStockValue).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ร้าน: {selectedStore?.name || 'หน้าร้าน'}
            </p>
          </div>

          {/* Card 2: Total Ingredients */}
          <div
            onClick={() => setStatusFilter('ALL')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                วัตถุดิบทั้งหมด
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              {kpis.totalIngredients} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">รายการวัตถุดิบทั้งหมดของร้าน</p>
          </div>

          {/* Card 3: In Stock (> 0) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer ${
              statusFilter === 'IN_STOCK'
                ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                มีสต็อกคงเหลือ (&gt; 0)
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              {kpis.inStockCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">มีปริมาณคงเหลือพร้อมใช้งาน</p>
          </div>

          {/* Card 4: Out of Stock (0) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer ${
              statusFilter === 'OUT_OF_STOCK'
                ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
                : 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                สต็อกหมด (0)
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-red-600 mt-1 font-mono">
              {kpis.outOfStockCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">ยอดคงเหลือเป็น 0 ต้องรับเข้าเพิ่ม</p>
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
              onClick={() => setStatusFilter('IN_STOCK')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'IN_STOCK'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>มีสต็อกคงเหลือ ({kpis.inStockCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('OUT_OF_STOCK')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'OUT_OF_STOCK'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>สต็อกหมด (0) ({kpis.outOfStockCount})</span>
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

        {/* Stock Valuation Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">กำลังคำนวณรายงานสต็อกคงเหลือและมูลค่า...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-300" />
              <span>ไม่พบวัตถุดิบตามเงื่อนไขที่เลือก</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-3 text-center w-12 text-slate-400">#</th>
                      <th className="py-3.5 px-4">รหัส / ชื่อวัตถุดิบ</th>
                      <th className="py-3.5 px-3 text-center">หมวดหมู่</th>
                      <th className="py-3.5 px-3 text-right">ยอดยกมา</th>
                      <th className="py-3.5 px-3 text-right">รับเข้า (+)</th>
                      <th className="py-3.5 px-3 text-right">จ่ายออก/ขาย (-)</th>
                      <th className="py-3.5 px-4 text-right">คงเหลือปัจจุบัน</th>
                      <th className="py-3.5 px-3 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-3.5 px-4 text-right">มูลค่าสต็อกรวม</th>
                      <th className="py-3.5 px-4 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedItems.map((item, idx) => {
                      const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                      const statusBadge = getStockStatusBadge(item);
                      const isOut = item.healthStatus === 'OUT_OF_STOCK';

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                            isOut ? 'bg-red-50/20' : ''
                          }`}
                        >
                          {/* Sequence Row Number */}
                          <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                            {rowNumber}
                          </td>

                          {/* Name & Code */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 group-hover:underline flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{item.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {item.code} • หน่วย: {item.unit}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {item.category}
                            </span>
                          </td>

                          {/* Opening */}
                          <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                            {item.openingQuantity.toLocaleString()}
                          </td>

                          {/* Inbound (+) */}
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {item.inboundQuantity > 0 ? `+${item.inboundQuantity.toLocaleString()}` : '0'}
                          </td>

                          {/* Outbound / Sales (-) */}
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-700">
                            {item.totalOutQuantity > 0 ? `-${item.totalOutQuantity.toLocaleString()}` : '0'}
                          </td>

                          {/* Current Stock */}
                          <td className="py-3.5 px-4 text-right font-mono font-black">
                            <span className={isOut ? 'text-red-600' : 'text-slate-900'}>
                              {item.currentStock.toLocaleString()}
                            </span>{' '}
                            <span className="text-[11px] font-normal text-slate-500">{item.unit}</span>
                          </td>

                          {/* Cost per unit */}
                          <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                            ฿{item.costPerUnit.toFixed(2)}
                          </td>

                          {/* Total Value */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                            ฿{item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Stock Status Badge */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${statusBadge.badgeClass}`}
                            >
                              <span>{statusBadge.label}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination (10 items per page) */}
              <Pagination
                currentPage={currentPage}
                totalItems={filteredItems.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
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
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedItem.code} • {selectedItem.category} ({selectedItem.storeName})
                  </p>
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
                  <span className="text-slate-400">ยอดยกมา:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {selectedItem.openingQuantity.toLocaleString()} {selectedItem.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">รับเข้า (+):</span>
                  <span className="font-mono font-bold text-emerald-700">
                    +{selectedItem.inboundQuantity.toLocaleString()} {selectedItem.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">จ่ายออก / ขาย POS (-):</span>
                  <span className="font-mono font-bold text-amber-700">
                    -{selectedItem.totalOutQuantity.toLocaleString()} {selectedItem.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">ยอดคงเหลือปัจจุบัน:</span>
                  <span className="font-bold font-mono text-slate-900 text-sm">
                    {selectedItem.currentStock.toLocaleString()} {selectedItem.unit}
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
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              {selectedItem.healthStatus === 'OUT_OF_STOCK' ? (
                <Link
                  href="/admin/stock-in"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>ไปหน้าบันทึกรับเข้าสต็อก</span>
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
            className="w-full max-w-4xl mx-auto bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-black font-sans text-[11px] leading-normal relative my-2 print:my-0 print:border-none print:shadow-none print:p-0 space-y-4"
          >
            {/* Top Right Reference Meta */}
            <div className="absolute top-4 right-6 text-right text-[10px] text-black font-mono leading-tight">
              <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
              <div>RTTR080ATHA.QRP</div>
            </div>

            {/* Document Header */}
            <div className="relative pb-2 mb-2 border-b border-black">
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-semibold text-black tracking-tight uppercase">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-normal text-black">
                  รายงานสรุปสต็อกสินค้าคงคลังและมูลค่า (Stock Inventory & Valuation Report)
                </h3>
              </div>

              {/* Sub-Header: Filter Info */}
              <div className="mt-3.5 flex items-center justify-between text-[11px] font-normal border-t border-black pt-2 text-black">
                <div className="flex items-center gap-5">
                  <div>
                    <span className="font-medium">ร้านค้า: </span>
                    <span className="font-semibold">{selectedStore?.name || 'หน้าร้าน'}</span>
                  </div>
                  <div>
                    <span className="font-medium">หมวดหมู่: </span>
                    <span>{categoryFilter === 'ALL' ? 'ทุกหมวดหมู่' : categoryFilter}</span>
                  </div>
                  <div>
                    <span className="font-medium">สถานะสต็อก: </span>
                    <span>
                      {statusFilter === 'ALL'
                        ? 'ทั้งหมด'
                        : statusFilter === 'IN_STOCK'
                        ? 'มีสต็อกคงเหลือ (> 0)'
                        : 'สต็อกหมด (0)'}
                    </span>
                  </div>
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

            {/* Official Stock Table Section */}
            <div className="pt-1 text-black space-y-1.5">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10.5px] font-medium text-black">
                  รายละเอียดรายการสต็อกสินค้าคงคลังและมูลค่า (Stock Items Inventory Ledger)
                </span>
                <span className="text-[9.5px] text-black font-mono">
                  แสดงทั้งหมด {filteredItems.length} รายการ
                </span>
              </div>
              <div className="border border-black bg-white">
                <table className="w-full table-fixed text-left text-[9.5px] border-collapse text-black font-normal">
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '21%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-black text-black font-semibold bg-white text-center">
                      <th className="py-1.5 px-1 border-r border-black text-center">ลำดับ</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-center">รหัสวัตถุดิบ</th>
                      <th className="py-1.5 px-2 border-r border-black text-left">ชื่อวัตถุดิบ</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-center">หมวดหมู่</th>
                      <th className="py-1.5 px-1 border-r border-black text-center">หน่วย</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-right">ยอดยกมา</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-right">รับเข้า (+)</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-right">จ่ายออก (-)</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-right">คงเหลือ</th>
                      <th className="py-1.5 px-1.5 border-r border-black text-right">ต้นทุน</th>
                      <th className="py-1.5 px-2 text-right">มูลค่ารวม (฿)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-mono text-black font-normal">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-4 text-center text-black font-sans">
                          ไม่พบข้อมูลสต็อกวัตถุดิบตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-black align-top">
                          <td className="py-1 px-1 text-center font-sans text-black border-r border-black">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-center text-black font-mono break-all">
                            {item.code}
                          </td>
                          <td className="py-1 px-2 border-r border-black font-sans text-black text-left whitespace-normal break-words leading-snug">
                            {item.name}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-center font-sans text-black whitespace-normal break-words leading-snug">
                            {item.category}
                          </td>
                          <td className="py-1 px-1 border-r border-black text-center font-sans text-black whitespace-normal break-words leading-snug">
                            {item.unit}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-right text-black font-mono whitespace-nowrap">
                            {item.openingQuantity.toLocaleString()}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-right text-black font-mono whitespace-nowrap">
                            {item.inboundQuantity > 0 ? `+${item.inboundQuantity.toLocaleString()}` : '0'}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-right text-black font-mono whitespace-nowrap">
                            {item.totalOutQuantity > 0 ? `-${item.totalOutQuantity.toLocaleString()}` : '0'}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-right text-black font-mono font-semibold whitespace-nowrap">
                            {item.currentStock.toLocaleString()}
                          </td>
                          <td className="py-1 px-1.5 border-r border-black text-right font-mono text-black whitespace-nowrap">
                            {item.costPerUnit.toFixed(2)}
                          </td>
                          <td className="py-1 px-2 text-right text-black font-mono whitespace-nowrap">
                            {item.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredItems.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-black font-semibold text-black bg-white text-[10px]">
                        <td colSpan={10} className="py-2 px-3 text-right font-sans border-r border-black">
                          รวมมูลค่าสต็อกคงคลังทั้งสิ้น ({filteredItems.length} รายการ):
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-black font-semibold whitespace-nowrap">
                          ฿{filteredItems.reduce((acc, i) => acc + i.totalValue, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
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

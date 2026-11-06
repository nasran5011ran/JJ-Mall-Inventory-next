'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  History,
  Search,
  RefreshCw,
  ArrowDownToLine,
  ShoppingCart,
  SlidersHorizontal,
  ClipboardCheck,
  Package,
  Layers,
  Calendar,
  Clock,
  X,
  FileText,
  User,
  TrendingDown,
  TrendingUp,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Sparkles,
  Info,
} from 'lucide-react';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  costPerUnit: number;
  currentStock: number;
}

interface StockTransactionRecord {
  id: number;
  transactionNumber: string;
  ingredientId: number;
  type: 'PURCHASE_IN' | 'SALE_DEDUCT' | 'ADJUST_ADD' | 'ADJUST_SUB' | 'PHYSICAL_COUNT' | 'TRANSFER_OUT' | 'DAMAGE_OUT';
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: string;
  ingredient: Ingredient;
  createdBy: {
    id: number;
    name: string;
    username: string;
    role: string;
  };
}

export default function AdminStockTransactionsPage() {
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [ingredientFilter, setIngredientFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Instant SWR Cache
  const { data: swrData, isLoading, isValidating, mutate } = useSWR(
    `/api/stock-transactions?type=${typeFilter}&ingredientId=${ingredientFilter}&dateRange=${dateFilter}`
  );

  const transactions: StockTransactionRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.transactions) ? swrData.transactions : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const metrics = swrData?.metrics || {
    totalTransactions: 0,
    purchaseCount: 0,
    saleDeductCount: 0,
    adjustCount: 0,
    physicalCount: 0,
    totalQtyIn: 0,
    totalQtyOut: 0,
  };

  const loading = isLoading && transactions.length === 0;

  // Detail Modal State
  const [selectedTx, setSelectedTx] = useState<StockTransactionRecord | null>(null);

  // Search Filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const matchNum = tx.transactionNumber.toLowerCase().includes(q);
        const matchRef = tx.refId?.toLowerCase().includes(q);
        const matchIng = tx.ingredient?.name.toLowerCase().includes(q) || tx.ingredient?.code.toLowerCase().includes(q);
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchUser = tx.createdBy?.name.toLowerCase().includes(q);
        if (!matchNum && !matchRef && !matchIng && !matchNote && !matchUser) return false;
      }
      return true;
    });
  }, [transactions, search]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = [
      'เลขที่รายการ (Tx Number)',
      'วันที่ & เวลา',
      'ประเภท (Type)',
      'รหัสวัตถุดิบ',
      'ชื่อวัตถุดิบ',
      'รับเข้า (+)',
      'จ่ายออก (-)',
      'คงเหลือหลังทำรายการ',
      'หน่วย',
      'เลขที่อ้างอิง (Ref ID)',
      'ผู้ทำรายการ',
      'หมายเหตุ',
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${tx.transactionNumber}"`,
      `"${new Date(tx.createdAt).toLocaleString('th-TH')}"`,
      `"${tx.type}"`,
      `"${tx.ingredient?.code || ''}"`,
      `"${tx.ingredient?.name || ''}"`,
      tx.quantityIn,
      tx.quantityOut,
      tx.balanceAfter,
      `"${tx.ingredient?.unit || ''}"`,
      `"${tx.refId || ''}"`,
      `"${tx.createdBy?.name || ''}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `JJ_Mall_Stock_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Transaction Type Display
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PURCHASE_IN':
        return {
          label: 'รับสินค้าเข้า (ซื้อเข้า)',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: ArrowDownToLine,
        };
      case 'SALE_DEDUCT':
        return {
          label: 'ตัดสต็อกจากการขาย',
          className: 'bg-amber-50 text-amber-900 border-amber-200',
          icon: ShoppingCart,
        };
      case 'ADJUST_ADD':
        return {
          label: 'ปรับปรุงสต็อก (เพิ่ม)',
          className: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: TrendingUp,
        };
      case 'ADJUST_SUB':
        return {
          label: 'ปรับปรุงสต็อก (ลด)',
          className: 'bg-red-50 text-red-800 border-red-200',
          icon: TrendingDown,
        };
      case 'PHYSICAL_COUNT':
        return {
          label: 'ตรวจนับสต็อกจริง',
          className: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: ClipboardCheck,
        };
      default:
        return {
          label: type,
          className: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: History,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            สมุดบัญชีคุมสต็อก (Stock Movement History & Audit Trail) ตรวจสอบประวัติการรับเข้า ตัดขาย ปรับปรุง และตรวจนับ
          </p>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>ส่งออก CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Purchases Inbound */}
        <div
          onClick={() => setTypeFilter(typeFilter === 'PURCHASE_IN' ? 'ALL' : 'PURCHASE_IN')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            typeFilter === 'PURCHASE_IN'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              รับเข้าคลัง (ซื้อเข้า)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {metrics.purchaseCount} <span className="text-xs font-semibold text-slate-500">ครั้ง</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">กระจายเข้าคลัง & สาขา</p>
        </div>

        {/* Card 2: Sale Deductions */}
        <div
          onClick={() => setTypeFilter(typeFilter === 'SALE_DEDUCT' ? 'ALL' : 'SALE_DEDUCT')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            typeFilter === 'SALE_DEDUCT'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              ตัดขายหน้าร้าน (POS)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
            {metrics.saleDeductCount} <span className="text-xs font-semibold text-slate-500">ครั้ง</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ตัดอัตโนมัติตามสูตร BOM</p>
        </div>

        {/* Card 3: Adjustments */}
        <div
          onClick={() => setTypeFilter(typeFilter === 'ADJUSTMENTS' ? 'ALL' : 'ADJUSTMENTS')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            typeFilter === 'ADJUSTMENTS'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              ปรับปรุงสต็อก
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-1 font-mono">
            {metrics.adjustCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">เสียหาย / ชำรุด / ปรับยอด</p>
        </div>

        {/* Card 4: Physical Count Audits */}
        <div
          onClick={() => setTypeFilter(typeFilter === 'PHYSICAL_COUNT' ? 'ALL' : 'PHYSICAL_COUNT')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            typeFilter === 'PHYSICAL_COUNT'
              ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              ตรวจนับสินค้าจริง
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 mt-1 font-mono">
            {metrics.physicalCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">นับจริงและปรับยอดคลัง</p>
        </div>
      </div>

      {/* Filter Tabs & Selector Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        {/* Quick Type Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              typeFilter === 'ALL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({metrics.totalTransactions})
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('PURCHASE_IN')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              typeFilter === 'PURCHASE_IN'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>รับเข้าคลัง ({metrics.purchaseCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('SALE_DEDUCT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              typeFilter === 'SALE_DEDUCT'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>ตัดขาย POS ({metrics.saleDeductCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('ADJUSTMENTS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              typeFilter === 'ADJUSTMENTS'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>ปรับปรุงสต็อก ({metrics.adjustCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('PHYSICAL_COUNT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              typeFilter === 'PHYSICAL_COUNT'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>ตรวจนับจริง ({metrics.physicalCount})</span>
          </button>
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Ingredient Dropdown */}
          <div>
            <select
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">📦 ทุกชนิดวัตถุดิบ ({ingredients.length} ชนิด)</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Dropdown */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">🗓️ ช่วงเวลาทั้งหมด</option>
              <option value="TODAY">📅 วันนี้ (Today)</option>
              <option value="WEEK">🗓️ 7 วันล่าสุด</option>
              <option value="MONTH">📆 30 วันล่าสุด</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่รายการ, เอกสารอ้างอิง, ผู้ทำรายการ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>
        </div>
      </div>

      {/* Stock Transactions Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดประวัติเคลื่อนไหวสต็อก...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <History className="w-12 h-12 text-slate-300" />
            <div className="font-bold text-slate-600 text-sm">ไม่พบประวัติการเคลื่อนไหวสต็อกที่ตรงกับเงื่อนไข</div>
            <p className="max-w-md text-slate-400">
              ลองเปลี่ยนตัวกรองประเภท หรือเลือกระยะเวลาการแสดงผลใหม่
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">วันที่ & เวลา</th>
                  <th className="py-3.5 px-4">รหัสรายการ / เอกสารอ้างอิง</th>
                  <th className="py-3.5 px-4">ประเภทรายการ</th>
                  <th className="py-3.5 px-4">วัตถุดิบ</th>
                  <th className="py-3.5 px-4 text-right">รับเข้า (+)</th>
                  <th className="py-3.5 px-4 text-right">จ่ายออก (-)</th>
                  <th className="py-3.5 px-4 text-right">คงเหลือหลังรายการ</th>
                  <th className="py-3.5 px-4">ผู้ทำรายการ</th>
                  <th className="py-3.5 px-4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTransactions.map((tx) => {
                  const badge = getTypeBadge(tx.type);
                  const BadgeIcon = badge.icon;
                  const qtyIn = Number(tx.quantityIn);
                  const qtyOut = Number(tx.quantityOut);
                  const balanceAfter = Number(tx.balanceAfter);

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-700">
                          {new Date(tx.createdAt).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.createdAt).toLocaleTimeString('th-TH')} น.
                        </div>
                      </td>

                      {/* Transaction # & Ref ID */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-emerald-700 group-hover:underline truncate max-w-xs">
                          {tx.refId || tx.transactionNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {tx.transactionNumber}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.className}`}
                        >
                          <BadgeIcon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Ingredient */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{tx.ingredient?.name || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {tx.ingredient?.code}
                        </div>
                      </td>

                      {/* Qty In */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {qtyIn > 0 ? (
                          <span className="text-emerald-700">
                            +{qtyIn.toLocaleString()} {tx.ingredient?.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Qty Out */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {qtyOut > 0 ? (
                          <span className="text-red-600">
                            -{qtyOut.toLocaleString()} {tx.ingredient?.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Balance After */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-800 whitespace-nowrap">
                        {balanceAfter.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{tx.ingredient?.unit}</span>
                      </td>

                      {/* Created By */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{tx.createdBy?.name || 'System'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          @{tx.createdBy?.username} ({tx.createdBy?.role})
                        </div>
                      </td>

                      {/* Note */}
                      <td className="py-3.5 px-4 max-w-xs text-slate-600">
                        <div className="truncate text-slate-700" title={tx.note || ''}>
                          {tx.note || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal (Stock Movement Card Slip) */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    รายละเอียดรายการเคลื่อนไหวสต็อก (Stock Slip)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedTx.transactionNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              {/* Type & Date Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ประเภทรายการ:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold border text-[11px] ${getTypeBadge(selectedTx.type).className}`}>
                    {getTypeBadge(selectedTx.type).label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">วันที่ทำรายการ:</span>
                  <span className="font-bold text-slate-700">
                    {new Date(selectedTx.createdAt).toLocaleString('th-TH')} น.
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">เลขที่อ้างอิง (Ref):</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {selectedTx.refId || '-'} {selectedTx.refType ? `(${selectedTx.refType})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ผู้ทำรายการ:</span>
                  <span className="font-bold text-slate-700">
                    {selectedTx.createdBy?.name} (@{selectedTx.createdBy?.username})
                  </span>
                </div>
              </div>

              {/* Ingredient Card */}
              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-slate-500 font-bold">ข้อมูลวัตถุดิบ:</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{selectedTx.ingredient?.name}</div>
                    <div className="text-slate-400 font-mono text-[11px]">รหัส: {selectedTx.ingredient?.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px]">ต้นทุนต่อหน่วย</div>
                    <div className="font-mono font-bold text-slate-700">
                      ฿{Number(selectedTx.ingredient?.costPerUnit || 0).toFixed(2)} / {selectedTx.ingredient?.unit}
                    </div>
                  </div>
                </div>

                {/* Flow: In / Out / Balance */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400">รับเข้า (+)</div>
                    <div className="font-mono font-bold text-emerald-700 text-sm">
                      {Number(selectedTx.quantityIn) > 0 ? `+${Number(selectedTx.quantityIn)}` : '0'}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400">จ่ายออก (-)</div>
                    <div className="font-mono font-bold text-red-600 text-sm">
                      {Number(selectedTx.quantityOut) > 0 ? `-${Number(selectedTx.quantityOut)}` : '0'}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] text-emerald-800 font-semibold">คงเหลือหลังทำ</div>
                    <div className="font-mono font-black text-emerald-800 text-sm">
                      {Number(selectedTx.balanceAfter).toLocaleString()} {selectedTx.ingredient?.unit}
                    </div>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900">
                <span className="font-bold">หมายเหตุ: </span>
                <span>{selectedTx.note || '-'}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบ Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
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

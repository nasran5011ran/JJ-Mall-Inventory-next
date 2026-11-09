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

  // Print Modals
  const [printListModalOpen, setPrintListModalOpen] = useState(false);
  const [printSlipOpen, setPrintSlipOpen] = useState(false);
  const [printLimit, setPrintLimit] = useState<'30' | '50' | 'ALL'>('30');

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

  // Transactions for Print Report (respecting 1-page 30-limit or custom)
  const printTransactions = useMemo(() => {
    if (printLimit === '30') return filteredTransactions.slice(0, 30);
    if (printLimit === '50') return filteredTransactions.slice(0, 50);
    return filteredTransactions;
  }, [filteredTransactions, printLimit]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = [
      'เลขที่รายการ (Tx Number)',
      'วันที่ & เวลา (Date & Time)',
      'วันที่ (Date)',
      'เวลา (Time)',
      'วันที่ (พ.ศ.)',
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

    const rows = filteredTransactions.map((tx) => {
      const d = new Date(tx.createdAt);
      const isValid = !isNaN(d.getTime());

      const yyyy = isValid ? d.getFullYear() : '';
      const mm = isValid ? String(d.getMonth() + 1).padStart(2, '0') : '';
      const dd = isValid ? String(d.getDate()).padStart(2, '0') : '';
      const hh = isValid ? String(d.getHours()).padStart(2, '0') : '';
      const min = isValid ? String(d.getMinutes()).padStart(2, '0') : '';
      const ss = isValid ? String(d.getSeconds()).padStart(2, '0') : '';

      // Standard ISO Date & Time (recognized natively in all versions of Excel without locale errors)
      const isoDateTime = isValid ? `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}` : '';
      const dateOnly = isValid ? `${yyyy}-${mm}-${dd}` : '';
      const timeOnly = isValid ? `${hh}:${min}:${ss}` : '';
      // Safe Thai Buddhist text for Excel: prefixed with ="..." so Excel never parses year 2569 as AD
      const thaiDateTimeFormula = isValid ? `="${dd}/${mm}/${Number(yyyy) + 543} ${hh}:${min}:${ss}"` : '""';

      const typeLabel = getTypeBadge(tx.type).label;

      return [
        `"${tx.transactionNumber}"`,
        `"${isoDateTime}"`,
        `"${dateOnly}"`,
        `"${timeOnly}"`,
        thaiDateTimeFormula,
        `"${typeLabel}"`,
        `"${tx.ingredient?.code || ''}"`,
        `"${tx.ingredient?.name || ''}"`,
        tx.quantityIn,
        tx.quantityOut,
        tx.balanceAfter,
        `"${tx.ingredient?.unit || ''}"`,
        `"${tx.refId || ''}"`,
        `"${tx.createdBy?.name || ''}"`,
        `"${(tx.note || '').replace(/"/g, '""')}"`,
      ];
    });

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
            type="button"
            onClick={() => setPrintListModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>พิมพ์สมุดคุมสต็อก</span>
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
                  <th className="py-2.5 px-3 whitespace-nowrap">วันที่ & เวลา</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">รหัสรายการ / เอกสารอ้างอิง</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center">ประเภทรายการ</th>
                  <th className="py-2.5 px-3">วัตถุดิบ</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">รับเข้า (+)</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">จ่ายออก (-)</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">คงเหลือหลังรายการ</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">ผู้ทำรายการ</th>
                  <th className="py-2.5 px-3">หมายเหตุ</th>
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
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <div className="font-bold text-slate-700">
                          {new Date(tx.createdAt).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.createdAt).toLocaleTimeString('th-TH')} น.
                        </div>
                      </td>

                      {/* Transaction # & Ref ID */}
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <div className="font-bold text-emerald-700 group-hover:underline truncate max-w-xs">
                          {tx.refId || tx.transactionNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {tx.transactionNumber}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.className}`}
                        >
                          <BadgeIcon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Ingredient */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{tx.ingredient?.name || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {tx.ingredient?.code}
                        </div>
                      </td>

                      {/* Qty In */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {qtyIn > 0 ? (
                          <span className="text-emerald-700">
                            +{qtyIn.toLocaleString()} {tx.ingredient?.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Qty Out */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {qtyOut > 0 ? (
                          <span className="text-red-600">
                            -{qtyOut.toLocaleString()} {tx.ingredient?.unit}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Balance After */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-800 whitespace-nowrap">
                        {balanceAfter.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{tx.ingredient?.unit}</span>
                      </td>

                      {/* Created By */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{tx.createdBy?.name || 'System'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          @{tx.createdBy?.username} ({tx.createdBy?.role})
                        </div>
                      </td>

                      {/* Note */}
                      <td className="py-2.5 px-3 max-w-xs text-slate-600">
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
                onClick={() => setPrintSlipOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
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

      {/* Official Stock Transaction Slip Print Preview Modal */}
      {printSlipOpen && selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print w-full max-w-5xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ตัวอย่างพิมพ์ใบสำคัญรายการสต็อก (A4 แนวนอน)
                </h3>
                <p className="text-[11px] text-slate-500">
                  เลขที่รายการ: {selectedTx.transactionNumber} • ตรวจสอบความถูกต้องก่อนสั่งพิมพ์หรือบันทึกเป็น PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintSlipOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Voucher Sheet (A4 Landscape Style) */}
          <div
            id="official-stock-transaction-slip"
            className="w-full max-w-5xl bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-slate-300 font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-2 mb-2 border-b-2 border-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                    บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                  </h1>
                  <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                    ใบสำคัญรายการความเคลื่อนไหวสต็อกสินค้า (Stock Movement Slip)
                  </h2>
                </div>
                <div className="text-right text-[10px] text-slate-600 font-mono leading-tight">
                  <div className="font-bold text-slate-800">ฝ่ายควบคุมสต็อกและคลังสินค้า</div>
                  <div>เลขที่รายการ: {selectedTx.transactionNumber}</div>
                  <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</div>
                </div>
              </div>

              {/* Sub-Header: Meta Grid */}
              <div className="mt-3 p-2.5 rounded border border-slate-300 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div>
                  <span className="font-bold text-slate-700">วันที่ & เวลา: </span>
                  <span className="font-mono">{new Date(selectedTx.createdAt).toLocaleDateString('th-TH')} {new Date(selectedTx.createdAt).toLocaleTimeString('th-TH')} น.</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">ประเภทรายการ: </span>
                  <span className="font-bold text-emerald-800">{getTypeBadge(selectedTx.type).label}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">เลขที่อ้างอิง: </span>
                  <span className="font-mono">{selectedTx.refId || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">ผู้ทำรายการ: </span>
                  <span>{selectedTx.createdBy?.name || 'User'} (@{selectedTx.createdBy?.username})</span>
                </div>
                <div className="sm:col-span-4 border-t border-slate-200 pt-1.5 mt-0.5">
                  <span className="font-bold text-slate-700">หมายเหตุ: </span>
                  <span>{selectedTx.note || '-'}</span>
                </div>
              </div>
            </div>

            {/* Movement Details Table */}
            <div className="my-2.5">
              <table className="w-full table-fixed text-left border-collapse text-[10px] leading-tight">
                <thead>
                  <tr className="border-t-2 border-b border-slate-800 text-slate-900 font-bold bg-slate-100 text-center">
                    <th className="py-1.5 px-2 border-r border-slate-300 w-[110px]">รหัสวัตถุดิบ</th>
                    <th className="py-1.5 px-3 border-r border-slate-300 text-left">ชื่อวัตถุดิบ</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 w-[100px]">หมวดหมู่</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right w-[95px]">ต้นทุน/หน่วย</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right w-[95px]">รับเข้า (+)</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right w-[95px]">จ่ายออก (-)</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right w-[110px]">คงเหลือหลังทำ</th>
                    <th className="py-1.5 px-2 text-center w-[60px]">หน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[10px]">
                  <tr>
                    <td className="py-2 px-2 border-r border-slate-200 font-bold text-center">
                      {selectedTx.ingredient?.code}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-sans font-bold text-slate-800 text-left">
                      {selectedTx.ingredient?.name}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-center font-sans">
                      {selectedTx.ingredient?.category || '-'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right">
                      ฿{Number(selectedTx.ingredient?.costPerUnit || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right font-bold text-emerald-700">
                      {Number(selectedTx.quantityIn) > 0 ? `+${Number(selectedTx.quantityIn).toLocaleString()}` : '0'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right font-bold text-red-700">
                      {Number(selectedTx.quantityOut) > 0 ? `-${Number(selectedTx.quantityOut).toLocaleString()}` : '0'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right font-black text-slate-900">
                      {Number(selectedTx.balanceAfter).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center font-sans text-slate-600">
                      {selectedTx.ingredient?.unit}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signature Section */}
            <div className="print-signature-section pt-5 grid grid-cols-3 gap-6 text-center text-[10px] font-sans">
              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้ทำรายการ (Staff / ผู้ส่งมอบ)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้ตรวจสอบ (ผู้จัดการสาขา / ผู้รับมอบ)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้มีอำนาจอนุมัติ / ฝ่ายบัญชี</div>
                <div className="text-[9.5px] text-slate-500 font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Stock Transactions Ledger Print Preview Modal */}
      {printListModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print w-full max-w-5xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ตัวอย่างพิมพ์สมุดบัญชีคุมสต็อก (A4 แนวนอน)
                </h3>
                <p className="text-[11px] text-slate-500">
                  ตรวจสอบความถูกต้องก่อนสั่งพิมพ์ หรือบันทึกเป็น PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-700">
                <span className="text-[11px] text-slate-500 pl-1.5">พิมพ์:</span>
                <button
                  type="button"
                  onClick={() => setPrintLimit('30')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    printLimit === '30' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 รายการ (พอดี 1 แผ่น)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLimit('50')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    printLimit === '50' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  50 รายการ
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLimit('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    printLimit === 'ALL' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด ({filteredTransactions.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintListModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Report Sheet (A4 Landscape Style) */}
          <div
            id="official-stock-transactions-report"
            className="w-full max-w-5xl bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-slate-300 font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-2 mb-2 border-b-2 border-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                    บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                  </h1>
                  <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                    สมุดบัญชีคุมสต็อกและความเคลื่อนไหวสินค้า (Stock Movement Ledger & Audit Trail)
                  </h2>
                </div>
                <div className="text-right text-[10px] text-slate-600 font-mono leading-tight">
                  <div className="font-bold text-slate-800">ฝ่ายควบคุมสต็อกและคลังสินค้า</div>
                  <div>เลขที่เอกสาร: TX-LEDGER-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}</div>
                  <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</div>
                </div>
              </div>

              {/* Sub-Header: Filter Info */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 font-medium">
                <div>
                  <span className="font-bold text-slate-800">ประเภทรายการ: </span>
                  <span>{typeFilter === 'ALL' ? 'ทุกประเภทรายการ' : typeFilter}</span>
                  <span className="mx-2">•</span>
                  <span className="font-bold text-slate-800">ช่วงเวลา: </span>
                  <span>{dateFilter === 'ALL' ? 'ทั้งหมด' : dateFilter === 'TODAY' ? 'วันนี้' : dateFilter === 'WEEK' ? '7 วันล่าสุด' : '30 วันล่าสุด'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">จำนวนที่พิมพ์: </span>
                  <span className="font-bold font-mono">{printTransactions.length}</span> จากทั้งหมด <span className="font-bold font-mono">{filteredTransactions.length}</span> รายการ
                </div>
              </div>
            </div>

            {/* Compact Filter & Summary Strip */}
            <div className="print-avoid-break my-2 p-2 px-3 rounded border border-slate-300 bg-slate-50 flex items-center justify-between text-[9px] font-sans">
              <div>
                <span className="font-bold text-slate-800">ตัวกรอง: </span>
                <span>{typeFilter === 'ALL' ? 'ทุกประเภทรายการ' : getTypeBadge(typeFilter).label}</span>
                <span className="mx-2">•</span>
                <span className="font-bold text-slate-800">ช่วงเวลา: </span>
                <span>{dateFilter === 'ALL' ? 'ทั้งหมด' : dateFilter === 'TODAY' ? 'วันนี้' : dateFilter === 'WEEK' ? '7 วันล่าสุด' : '30 วันล่าสุด'}</span>
                {ingredientFilter !== 'ALL' && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="font-bold text-slate-800">วัตถุดิบ: </span>
                    <span>{ingredients.find((i) => String(i.id) === ingredientFilter)?.name || ingredientFilter}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span>รับเข้า: <strong className="text-emerald-700">{metrics.purchaseCount}</strong></span>
                <span>ตัดขาย POS: <strong className="text-amber-700">{metrics.saleDeductCount}</strong></span>
                <span>ปรับปรุง: <strong className="text-blue-700">{metrics.adjustCount}</strong></span>
                <span>ตรวจนับ: <strong className="text-purple-700">{metrics.physicalCount}</strong></span>
                <span className="border-l border-slate-300 pl-2">รวม: <strong>{printTransactions.length}</strong>/{filteredTransactions.length} รายการ</span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="w-full">
              <table className="w-full table-fixed text-left border-collapse text-[9px] leading-tight">
                <thead>
                  <tr className="border-t-2 border-b border-slate-800 text-slate-900 font-bold bg-slate-100 text-center">
                    <th className="py-1 px-1 border-r border-slate-300 w-[30px]">ลำดับ</th>
                    <th className="py-1 px-1 border-r border-slate-300 w-[82px]">วันที่ & เวลา</th>
                    <th className="py-1 px-1.5 border-r border-slate-300 w-[110px]">เลขที่รายการ</th>
                    <th className="py-1 px-1 border-r border-slate-300 w-[80px]">ประเภท</th>
                    <th className="py-1 px-2 border-r border-slate-300 w-[125px] text-left">วัตถุดิบ</th>
                    <th className="py-1 px-1 border-r border-slate-300 text-right w-[65px]">รับเข้า (+)</th>
                    <th className="py-1 px-1 border-r border-slate-300 text-right w-[65px]">จ่ายออก (-)</th>
                    <th className="py-1 px-1 border-r border-slate-300 text-right w-[80px]">คงเหลือ</th>
                    <th className="py-1 px-1 border-r border-slate-300 text-center w-[38px]">หน่วย</th>
                    <th className="py-1 px-1.5 border-r border-slate-300 text-left w-[95px]">เลขอ้างอิง</th>
                    <th className="py-1 px-1.5 text-left w-[95px]">ผู้ทำรายการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[8.5px]">
                  {printTransactions.map((tx, idx) => {
                    const badge = getTypeBadge(tx.type);
                    const d = new Date(tx.createdAt);
                    const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
                    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-0.5 px-1 text-center border-r border-slate-200 font-sans">
                          {idx + 1}
                        </td>
                        <td className="py-0.5 px-1 border-r border-slate-200 font-sans text-center whitespace-nowrap">
                          {dateStr} <span className="text-[7.5px] text-slate-500">{timeStr}</span>
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-slate-200 font-bold font-mono truncate">
                          {tx.transactionNumber}
                        </td>
                        <td className="py-0.5 px-1 border-r border-slate-200 text-center font-sans font-bold text-[8px] truncate">
                          {badge.label}
                        </td>
                        <td className="py-0.5 px-2 border-r border-slate-200 font-sans text-left overflow-hidden">
                          <div className="font-bold text-slate-800 text-[8.5px] truncate" title={tx.ingredient?.name}>
                            {tx.ingredient?.name}
                          </div>
                          <div className="text-[7.5px] text-slate-500 font-mono">
                            {tx.ingredient?.code}
                          </div>
                        </td>
                        <td className="py-0.5 px-1 border-r border-slate-200 text-right font-bold text-emerald-700">
                          {Number(tx.quantityIn) > 0 ? `+${Number(tx.quantityIn)}` : '-'}
                        </td>
                        <td className="py-0.5 px-1 border-r border-slate-200 text-right font-bold text-red-700">
                          {Number(tx.quantityOut) > 0 ? `-${Number(tx.quantityOut)}` : '-'}
                        </td>
                        <td className="py-0.5 px-1 border-r border-slate-200 text-right font-black text-slate-900 whitespace-nowrap">
                          {Number(tx.balanceAfter).toLocaleString()}
                        </td>
                        <td className="py-0.5 px-1 border-r border-slate-200 text-center font-sans text-slate-600">
                          {tx.ingredient?.unit}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-slate-200 font-mono text-slate-700 text-[8px] truncate" title={tx.refId || ''}>
                          {tx.refId || '-'}
                        </td>
                        <td className="py-0.5 px-1.5 font-sans text-slate-700 text-[8.5px] truncate" title={tx.createdBy?.name || ''}>
                          {tx.createdBy?.name || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 bg-slate-100 font-bold text-[9.5px]">
                    <td colSpan={5} className="py-1.5 px-3 text-right font-sans border-r border-slate-300">
                      รวมรายการความเคลื่อนไหวที่พิมพ์:
                    </td>
                    <td colSpan={6} className="py-1.5 px-3 text-left font-sans text-slate-800">
                      <span className="font-mono font-bold">{printTransactions.length}</span> รายการ {printLimit !== 'ALL' && `(จากทั้งหมด ${filteredTransactions.length} รายการ)`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signature Section */}
            <div className="print-signature-section pt-4 grid grid-cols-3 gap-6 text-center text-[10px] font-sans">
              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้จัดทำรายงาน (เจ้าหน้าที่สต็อก / แคชเชียร์)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้ตรวจสอบ (ผู้จัดการสาขา)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้มีอำนาจอนุมัติ / ฝ่ายบัญชี</div>
                <div className="text-[9.5px] text-slate-500 font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

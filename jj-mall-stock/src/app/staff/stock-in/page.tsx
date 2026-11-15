'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  ArrowDownToLine,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  Layers,
  X,
  FileText,
  Trash2,
  Printer,
  Store,
  Package,
  AlertTriangle,
  Info,
  Check,
  Building,
  DollarSign,
  Tag,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

const PRESET_UNITS = [
  'กรัม',
  'กิโลกรัม',
  'มิลลิลิตร',
  'ลิตร',
  'ชิ้น',
  'ใบ',
  'ฟอง',
  'แก้ว',
  'ขวด',
  'กระป๋อง',
  'ซอง',
  'ถุง',
  'แพ็ค',
  'กล่อง',
];
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  costPerUnit: number;
  minStock: number;
  storeStock: number | null;
}

interface StoreIngredientBalance {
  ingredientId: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  costPerUnit: number;
  openingQuantity: number;
  inboundQuantity: number;
  salesQuantity: number;
  expectedStock: number;
  minStock: number;
  hasStockHistory: boolean;
}

interface StockInTransaction {
  id: number;
  transactionNumber: string;
  type: string;
  quantityIn: number;
  balanceAfter: number;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: string;
  ingredient: {
    id: number;
    code: string;
    name: string;
    unit: string;
    category: string | null;
  };
  createdBy: {
    id: number;
    name: string;
    username: string;
  };
}

export default function StaffStockInPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'CURRENT_STOCK' | 'HISTORY'>('CURRENT_STOCK');

  // SWR for realtime data
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-in', {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const storeBalances: StoreIngredientBalance[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.storeBalances) ? swrData.storeBalances : [];
  }, [swrData]);

  const transactions: StockInTransaction[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.transactions) ? swrData.transactions : [];
  }, [swrData]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- TAB 1: STORE STOCK FILTERS & STATE ---
  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'SAFE' | 'LOW' | 'UNSTOCKED'>('ALL');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('ALL');
  const [stockPage, setStockPage] = useState(1);
  const stockPageSize = 10;

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    storeBalances.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set);
  }, [storeBalances]);

  // Stock KPI Metrics
  const stockMetrics = useMemo(() => {
    let safe = 0;
    let low = 0;
    let unstocked = 0;

    storeBalances.forEach((b) => {
      if (!b.hasStockHistory) {
        unstocked++;
      } else if (Number(b.expectedStock) <= Number(b.minStock)) {
        low++;
      } else {
        safe++;
      }
    });

    return {
      total: storeBalances.length,
      safe,
      low,
      unstocked,
    };
  }, [storeBalances]);

  // Filtered Store Balances
  const filteredStoreBalances = useMemo(() => {
    return storeBalances.filter((b) => {
      const q = stockSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q));

      const matchCategory = stockCategoryFilter === 'ALL' || b.category === stockCategoryFilter;

      let matchStatus = true;
      if (stockStatusFilter === 'SAFE') {
        matchStatus = b.hasStockHistory && Number(b.expectedStock) > Number(b.minStock);
      } else if (stockStatusFilter === 'LOW') {
        matchStatus = b.hasStockHistory && Number(b.expectedStock) <= Number(b.minStock);
      } else if (stockStatusFilter === 'UNSTOCKED') {
        matchStatus = !b.hasStockHistory;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [storeBalances, stockSearch, stockCategoryFilter, stockStatusFilter]);

  const paginatedStoreBalances = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStoreBalances.slice(start, start + stockPageSize);
  }, [filteredStoreBalances, stockPage, stockPageSize]);

  // --- TAB 2: HISTORY STATE ---
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const q = historySearch.trim().toLowerCase();
      return (
        !q ||
        tx.transactionNumber.toLowerCase().includes(q) ||
        tx.ingredient.name.toLowerCase().includes(q) ||
        tx.ingredient.code.toLowerCase().includes(q) ||
        (tx.note && tx.note.toLowerCase().includes(q))
      );
    });
  }, [transactions, historySearch]);

  const paginatedTransactions = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredTransactions.slice(start, start + historyPageSize);
  }, [filteredTransactions, historyPage, historyPageSize]);

  // --- MODAL: CREATE STOCK IN ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [supplierInput, setSupplierInput] = useState('');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [formItems, setFormItems] = useState<
    Array<{
      ingredientId: number;
      customName?: string;
      unit?: string;
      quantity: string;
      costPerUnit: string;
    }>
  >([{ ingredientId: 0, customName: '', unit: '', quantity: '', costPerUnit: '' }]);

  // Close stock-in suggestions popover when clicking anywhere outside or pressing Escape
  useEffect(() => {
    if (activeSearchIdx === null) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const activeCombobox = document.querySelector(`[data-stock-in-combobox="${activeSearchIdx}"]`);
      if (activeCombobox && activeCombobox.contains(target)) {
        return;
      }
      setActiveSearchIdx(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveSearchIdx(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSearchIdx]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open Modal Standard
  const handleOpenModal = () => {
    setSupplierInput('แม็คโคร');
    setInvoiceNumberInput('');
    setNoteInput('');
    setFormItems([{ ingredientId: 0, customName: '', unit: '', quantity: '', costPerUnit: '' }]);
    setFormError(null);
    setActiveSearchIdx(null);
    setIsModalOpen(true);
  };

  // Quick Restock from row
  const handleQuickRestock = (ingId: number) => {
    const ing = ingredients.find((i) => i.id === ingId);
    setSupplierInput('ทั่วไป');
    setInvoiceNumberInput('');
    setNoteInput('');
    setFormItems([
      {
        ingredientId: ingId,
        customName: ing?.name || '',
        unit: ing?.unit || '',
        quantity: '',
        costPerUnit: ing ? String(ing.costPerUnit || '') : '',
      },
    ]);
    setFormError(null);
    setActiveSearchIdx(null);
    setIsModalOpen(true);
  };

  // Row handlers
  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      { ingredientId: 0, customName: '', unit: '', quantity: '', costPerUnit: '' },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
    if (activeSearchIdx === index) {
      setActiveSearchIdx(null);
    }
  };

  const handleItemChange = (
    index: number,
    field: 'ingredientId' | 'customName' | 'unit' | 'quantity' | 'costPerUnit',
    value: any
  ) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'ingredientId') {
        const ing = ingredients.find((i) => i.id === Number(value));
        if (ing) {
          updated[index].customName = ing.name;
          updated[index].unit = ing.unit;
          if (ing.costPerUnit) {
            updated[index].costPerUnit = String(ing.costPerUnit);
          }
        }
      }
      return updated;
    });
  };

  // Submit Stock In
  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const valid = formItems.filter(
      (it) =>
        (it.ingredientId > 0 || (it.customName && it.customName.trim())) &&
        !isNaN(parseFloat(it.quantity)) &&
        parseFloat(it.quantity) > 0
    );

    if (valid.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนที่รับเข้าอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier: supplierInput,
          invoiceNumber: invoiceNumberInput,
          note: noteInput,
          items: valid.map((it) => ({
            ingredientId: it.ingredientId > 0 ? it.ingredientId : undefined,
            name: it.customName ? it.customName.trim() : undefined,
            unit: it.unit ? it.unit.trim() : undefined,
            quantity: parseFloat(it.quantity),
            costPerUnit: it.costPerUnit ? parseFloat(it.costPerUnit) : undefined,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'บันทึกรับเข้าไม่สำเร็จ');
      }

      showToast(json.message || 'บันทึกรับวัตถุดิบเข้าสต็อกร้านเรียบร้อยแล้ว');
      setIsModalOpen(false);
      mutate();
    } catch (e: any) {
      setFormError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">บันทึกรับวัตถุดิบเข้าสต็อก (ซื้อเข้า)</h1>
              <p className="text-xs text-slate-500">
                ร้าน <strong>{user?.name}</strong> (@{user?.username}) — บันทึกสินค้าและวัตถุดิบที่ซื้อมาเติมสต็อกหน้าร้านโดยตรง
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenModal}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ บันทึกรับของเข้าสต็อก</span>
          </button>
        </div>
      </div>

      {/* 2 Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('CURRENT_STOCK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'CURRENT_STOCK'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 text-emerald-600" />
          <span>📦 สต็อกคงเหลือในร้านของคุณ</span>
          {stockMetrics.low > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-500/40">
              {stockMetrics.low} ใกล้หมด
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'HISTORY'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-sky-600" />
          <span>📋 ประวัติการซื้อเข้า / รับเข้า</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {transactions.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CURRENT STORE STOCK */}
      {/* ========================================================================= */}
      {activeTab === 'CURRENT_STOCK' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              onClick={() => {
                setStockStatusFilter('ALL');
                setStockPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                stockStatusFilter === 'ALL'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">วัตถุดิบทั้งหมด</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {stockMetrics.total} <span className="text-xs font-semibold text-slate-500">รายการ</span>
              </div>
            </div>

            <div
              onClick={() => {
                setStockStatusFilter('SAFE');
                setStockPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                stockStatusFilter === 'SAFE'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">สต็อกพร้อมขาย</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {stockMetrics.safe} <span className="text-xs font-semibold text-slate-500">รายการ</span>
              </div>
            </div>

            <div
              onClick={() => {
                setStockStatusFilter('LOW');
                setStockPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                stockStatusFilter === 'LOW'
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">ใกล้หมด (ต้องซื้อเพิ่ม)</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {stockMetrics.low} <span className="text-xs font-semibold text-slate-500">รายการ</span>
              </div>
            </div>

            <div
              onClick={() => {
                setStockStatusFilter('UNSTOCKED');
                setStockPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                stockStatusFilter === 'UNSTOCKED'
                  ? 'border-slate-400 ring-2 ring-slate-400/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ยังไม่เคยมีในร้าน</span>
                <Info className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-600 mt-1">
                {stockMetrics.unstocked} <span className="text-xs font-semibold text-slate-400">รายการ</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 w-full md:w-auto flex-1">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อวัตถุดิบ, รหัส..."
                  value={stockSearch}
                  onChange={(e) => {
                    setStockSearch(e.target.value);
                    setStockPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={stockCategoryFilter}
                onChange={(e) => {
                  setStockCategoryFilter(e.target.value);
                  setStockPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">📁 ทุกหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {(['ALL', 'SAFE', 'LOW', 'UNSTOCKED'] as const).map((st) => {
                const labels = {
                  ALL: 'ทั้งหมด',
                  SAFE: 'พร้อมขาย',
                  LOW: 'ใกล้หมด',
                  UNSTOCKED: 'ยังไม่มีในร้าน',
                };
                return (
                  <button
                    key={st}
                    onClick={() => {
                      setStockStatusFilter(st);
                      setStockPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      stockStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {labels[st]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Store Stock Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            {isLoading && storeBalances.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">กำลังคำนวณยอดสต็อกคงเหลือในร้าน...</div>
            ) : paginatedStoreBalances.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">ไม่พบรายการวัตถุดิบ</p>
                <p className="text-[11px] text-slate-400">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                      <th className="py-3 px-4">รหัส/ชื่อวัตถุดิบ</th>
                      <th className="py-3 px-3">หมวดหมู่</th>
                      <th className="py-3 px-3 text-right">ยอดยกมา</th>
                      <th className="py-3 px-3 text-right">รับเข้า (ซื้อมา)</th>
                      <th className="py-3 px-3 text-right">ขาย POS (-)</th>
                      <th className="py-3 px-3.5 text-right font-black text-slate-900">คงเหลือในร้าน</th>
                      <th className="py-3 px-3 text-right">เกณฑ์ขั้นต่ำ (Min)</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-4 text-center">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedStoreBalances.map((item, idx) => {
                      const rowNumber = (stockPage - 1) * stockPageSize + idx + 1;
                      const isLow = item.hasStockHistory && Number(item.expectedStock) <= Number(item.minStock);
                      const isUnstocked = !item.hasStockHistory;

                      return (
                        <tr
                          key={item.ingredientId}
                          className={`transition-colors ${
                            isLow ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{item.code}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {item.category || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {Number(item.openingQuantity).toLocaleString()}{' '}
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                            {Number(item.inboundQuantity) > 0 ? `+${Number(item.inboundQuantity).toLocaleString()}` : '0'}{' '}
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-red-700 font-bold">
                            {Number(item.salesQuantity) > 0 ? `-${Number(item.salesQuantity).toLocaleString()}` : '0'}{' '}
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-sm bg-slate-50/50">
                            <span
                              className={
                                isUnstocked
                                  ? 'text-slate-400 font-normal'
                                  : isLow
                                  ? 'text-amber-600 font-black'
                                  : 'text-slate-900'
                              }
                            >
                              {Number(item.expectedStock).toLocaleString()}
                            </span>{' '}
                            <span className="text-[11px] font-normal text-slate-500">{item.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {Number(item.minStock).toLocaleString()} {item.unit}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isUnstocked ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                ยังไม่มีในร้าน
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                ใกล้หมด
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                พร้อมขาย
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleQuickRestock(item.ingredientId)}
                              className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all shadow-2xs cursor-pointer"
                              title={`ซื้อ ${item.name} เข้าสต็อกร้าน`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ รับเข้า</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {filteredStoreBalances.length > stockPageSize && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  แสดงหน้า {stockPage} จาก {Math.ceil(filteredStoreBalances.length / stockPageSize)}
                </span>
                <Pagination
                  currentPage={stockPage}
                  totalItems={filteredStoreBalances.length}
                  pageSize={stockPageSize}
                  onPageChange={setStockPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Search Toolbar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่บิล, ชื่อวัตถุดิบ, หมายเหตุ..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            {isLoading && transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">กำลังโหลดประวัติการรับเข้า...</div>
            ) : paginatedTransactions.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">ยังไม่มีประวัติการรับสินค้าเข้าสต็อก</p>
                <p className="text-[11px] text-slate-400">เมื่อคุณซื้อวัตถุดิบและกดบันทึกรับเข้า รายการจะปรากฏที่นี่</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                      <th className="py-3 px-4">เลขที่รายการ</th>
                      <th className="py-3 px-3">วันที่ / เวลา</th>
                      <th className="py-3 px-3">วัตถุดิบ</th>
                      <th className="py-3 px-3 text-right">จำนวนที่รับเข้า</th>
                      <th className="py-3 px-3">ซัพพลายเออร์ / หมายเหตุ</th>
                      <th className="py-3 px-3">ผู้บันทึก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedTransactions.map((tx, idx) => {
                      const rowNumber = (historyPage - 1) * historyPageSize + idx + 1;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-4">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                            {tx.transactionNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {new Date(tx.createdAt).toLocaleString('th-TH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })} น.
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{tx.ingredient.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{tx.ingredient.code}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                          +{Number(tx.quantityIn).toLocaleString()} {tx.ingredient.unit}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <div className="truncate max-w-xs">{tx.note || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {tx.createdBy.name}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {filteredTransactions.length > historyPageSize && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  แสดงหน้า {historyPage} จาก {Math.ceil(filteredTransactions.length / historyPageSize)}
                </span>
                <Pagination
                  currentPage={historyPage}
                  totalItems={filteredTransactions.length}
                  pageSize={historyPageSize}
                  onPageChange={setHistoryPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD STOCK IN */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">บันทึกรับวัตถุดิบเข้าสต็อกร้าน (ซื้อเข้า)</h3>
                  <p className="text-[11px] text-slate-500">
                    ร้าน: <strong>{user?.name}</strong> — เมื่อบันทึก สต็อกคงเหลือในร้านจะเพิ่มขึ้นทันที
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitStockIn} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ซื้อมาจาก (ซัพพลายเออร์/ร้าน)</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น แม็คโคร, บิ๊กซี, ตลาดสด"
                    value={supplierInput}
                    onChange={(e) => setSupplierInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เลขที่ใบเสร็จ / บิล (ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="เช่น INV-00123"
                    value={invoiceNumberInput}
                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ (ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="ระบุเพิ่มเติม..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">รายการวัตถุดิบที่รับเข้า</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มรายการ</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formItems.map((item, idx) => {
                    const selectedIng = ingredients.find(
                      (i) => (Number(item.ingredientId) > 0 && i.id === Number(item.ingredientId)) ||
                             (item.customName && i.name.trim().toLowerCase() === item.customName.trim().toLowerCase())
                    );
                    const displayName = typeof item.customName === 'string'
                      ? item.customName
                      : (selectedIng ? selectedIng.name : '');
                    return (
                      <div
                        key={idx}
                        className={`p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 relative ${
                          activeSearchIdx === idx ? 'z-50 ring-2 ring-emerald-500/30' : 'z-0'
                        }`}
                      >
                        <div className="flex-1 w-full sm:w-auto relative" data-stock-in-combobox={idx}>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => {
                                const val = e.target.value;
                                const exactMatch = ingredients.find(
                                  (ing) =>
                                    ing.name.trim().toLowerCase() === val.trim().toLowerCase() ||
                                    ing.code.trim().toLowerCase() === val.trim().toLowerCase()
                                );
                                if (exactMatch) {
                                  setFormItems((prev) => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...next[idx],
                                      ingredientId: exactMatch.id,
                                      customName: exactMatch.name,
                                      unit: exactMatch.unit || next[idx].unit || 'ชิ้น',
                                      costPerUnit: String(exactMatch.costPerUnit || ''),
                                    };
                                    return next;
                                  });
                                } else {
                                  setFormItems((prev) => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...next[idx],
                                      ingredientId: 0,
                                      customName: val,
                                      unit: next[idx].unit || 'ชิ้น',
                                    };
                                    return next;
                                  });
                                }
                                setActiveSearchIdx(idx);
                              }}
                              onFocus={() => setActiveSearchIdx(idx)}
                              placeholder="พิมพ์ชื่อวัตถุดิบ หรือคลิกเลือกจากระบบ..."
                              className="w-full pl-8 pr-14 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />

                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              {item.customName && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormItems((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], ingredientId: 0, customName: '', unit: '', costPerUnit: '' };
                                      return next;
                                    });
                                  }}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  title="ล้างข้อมูล"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveSearchIdx(activeSearchIdx === idx ? null : idx)}
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                title="แสดงรายการวัตถุดิบในระบบ"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Status Indicator: Shows ingredient name if matched in system, or new ingredient tag */}
                          {selectedIng ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>ในระบบ: {selectedIng.name}</span>
                              </span>
                            </div>
                          ) : item.customName && item.customName.trim() ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                <Sparkles className="w-3 h-3 text-blue-600" />
                                <span>วัตถุดิบใหม่: &ldquo;{item.customName.trim()}&rdquo;</span>
                              </span>
                              <select
                                value={item.unit || 'ชิ้น'}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                className="text-[10px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
                              >
                                {PRESET_UNITS.map((u) => (
                                  <option key={u} value={u}>หน่วย: {u}</option>
                                ))}
                              </select>
                            </div>
                          ) : null}

                          {/* Suggestions Popover */}
                          {activeSearchIdx === idx && (() => {
                            const q = (item.customName || '').trim().toLowerCase();
                            const filtered = ingredients.filter(
                              (ing) =>
                                !q ||
                                ing.name.toLowerCase().includes(q) ||
                                ing.code.toLowerCase().includes(q) ||
                                (ing.category && ing.category.toLowerCase().includes(q))
                            );
                            const isExactExisting = ingredients.some(
                              (ing) => ing.name.trim().toLowerCase() === q
                            );

                            return (
                              <div className="absolute top-full left-0 w-[420px] sm:w-[500px] max-w-[90vw] mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[99] max-h-64 sm:max-h-72 overflow-y-auto divide-y divide-slate-100 ring-4 ring-black/5">
                                {q && !isExactExisting && (
                                  <div
                                    onClick={() => {
                                      setFormItems((prev) => {
                                        const next = [...prev];
                                        next[idx] = {
                                          ...next[idx],
                                          ingredientId: 0,
                                          customName: item.customName!.trim(),
                                          unit: next[idx].unit || 'ชิ้น',
                                        };
                                        return next;
                                      });
                                      setActiveSearchIdx(null);
                                    }}
                                    className="p-2.5 bg-emerald-50/90 hover:bg-emerald-100 transition-colors flex items-center justify-between gap-2 cursor-pointer border-b border-emerald-200"
                                  >
                                    <div>
                                      <div className="font-bold text-xs text-emerald-900 flex items-center gap-1">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>ใช้ชื่อนี้:</span>
                                        <span className="underline decoration-emerald-500 font-black">"{item.customName}"</span>
                                      </div>
                                      <div className="text-[10px] text-emerald-700 mt-0.5">
                                        จะบันทึกเป็นวัตถุดิบใหม่เข้าคลังร้านและระบบอัตโนมัติ
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-1 rounded-lg shrink-0">
                                      + ใช้ชื่อนี้
                                    </span>
                                  </div>
                                )}

                                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                                  <span>วัตถุดิบในระบบ ({filtered.length})</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSearchIdx(null)}
                                    className="text-slate-400 hover:text-slate-600 font-bold"
                                  >
                                    ปิด ✕
                                  </button>
                                </div>

                                {filtered.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400">
                                    ไม่พบวัตถุดิบในระบบที่ตรงกับ &ldquo;{item.customName}&rdquo;
                                    <div className="text-[11px] text-emerald-700 font-bold mt-1">
                                      คลิก "+ ใช้ชื่อนี้" ด้านบนเพื่อเพิ่มวัตถุดิบใหม่เข้าระบบ
                                    </div>
                                  </div>
                                ) : (
                                  filtered.map((ing) => {
                                    const isSelected = ing.id === item.ingredientId;
                                    return (
                                      <div
                                        key={ing.id}
                                        onClick={() => {
                                          handleItemChange(idx, 'ingredientId', ing.id);
                                          setActiveSearchIdx(null);
                                        }}
                                        className={`p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                          isSelected ? 'bg-emerald-50/70' : ''
                                        }`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="font-bold text-xs sm:text-sm text-slate-900 break-words whitespace-normal leading-snug">
                                            {ing.name}
                                            {isSelected && (
                                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full ml-2">
                                                ✓ เลือกอยู่
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                                            {ing.category && (
                                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium border border-emerald-200/60 text-[10px]">
                                                {ing.category}
                                              </span>
                                            )}
                                            <span className="text-slate-500 text-[10px]">
                                              ต้นทุน ฿{Number(ing.costPerUnit || 0).toFixed(2)} / {ing.unit}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0 pt-0.5">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                            ในร้าน: {Number(ing.storeStock || 0).toLocaleString()} {ing.unit}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center gap-1.5 w-full sm:w-36">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            required
                            placeholder="จำนวนรับเข้า"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <span className="text-xs font-semibold text-slate-500 shrink-0 w-10 text-left">
                            {item.unit || selectedIng?.unit || 'หน่วย'}
                          </span>
                        </div>

                        {/* Cost Per Unit */}
                        <div className="flex items-center gap-1.5 w-full sm:w-32">
                          <span className="text-xs text-slate-400">฿</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="ราคา/หน่วย"
                            value={item.costPerUnit}
                            onChange={(e) => handleItemChange(idx, 'costPerUnit', e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            title="ต้นทุนต่อหน่วย (ถ้าไม่กรอก จะใช้ราคาเดิม)"
                          />
                        </div>

                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>บันทึกรับเข้าสต็อกร้าน</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

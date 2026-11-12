'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Pagination from '@/components/Pagination';
import {
  ArrowDownToLine,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Warehouse,
  Store,
  DollarSign,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  User,
  Truck,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  currentStock: number;
  costPerUnit: number;
}

interface StaffStore {
  id: number;
  username: string;
  name: string;
}

interface InboundTransaction {
  id: number;
  transactionNumber: string;
  ingredientId: number;
  type: string;
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

interface InboundItemForm {
  ingredientId: string;
  quantity: string;
  costPerUnit: string;
}

export default function AdminStockInPage() {
  const { user } = useAuth();

  // Instant SWR Cache for Inbound Stock Data with Real-time Auto-refresh
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-in', {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  const transactions: InboundTransaction[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.transactions) ? swrData.transactions : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  const storeBalancesByStore: Record<number, any[]> = useMemo(() => {
    return swrData?.storeBalancesByStore || swrData?.storeBalances || {};
  }, [swrData]);

  const loading = isLoading && transactions.length === 0;
  const refreshing = isValidating;

  // Filter States
  const [search, setSearch] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('ALL'); // ALL | staffStoreId
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Modal State for New Stock In
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modalIngSearch, setModalIngSearch] = useState('');

  // Detail Modal State
  const [selectedTx, setSelectedTx] = useState<InboundTransaction | null>(null);

  // Form Fields
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [note, setNote] = useState('');
  const [formItems, setFormItems] = useState<InboundItemForm[]>([
    { ingredientId: '', quantity: '', costPerUnit: '' },
  ]);

  // Current selected store's stock map: ingredientId -> expectedStock
  const currentStoreStockMap = useMemo(() => {
    const map = new Map<number, number>();
    const storeIdNum = Number(targetStoreId);
    if (storeIdNum && storeBalancesByStore[storeIdNum]) {
      storeBalancesByStore[storeIdNum].forEach((b: any) => {
        map.set(b.ingredientId, Number(b.expectedStock));
      });
    }
    return map;
  }, [storeBalancesByStore, targetStoreId]);

  const targetStoreObj = useMemo(() => {
    return staffStores.find((s) => String(s.id) === String(targetStoreId));
  }, [staffStores, targetStoreId]);

  // Filter ingredients in modal by search keyword
  const filteredIngredientsForModal = useMemo(() => {
    if (!modalIngSearch.trim()) return ingredients;
    const q = modalIngSearch.toLowerCase().trim();
    return ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(q) ||
        ing.code.toLowerCase().includes(q) ||
        (ing.category && ing.category.toLowerCase().includes(q))
    );
  }, [ingredients, modalIngSearch]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check URL params on mount (?storeId=...&code=...)
  React.useEffect(() => {
    if (typeof window !== 'undefined' && ingredients.length > 0 && staffStores.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const qStoreId = urlParams.get('storeId');
      const qCode = urlParams.get('code');

      if (qStoreId || qCode) {
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        setInvoiceNumber(`PO-${todayStr}-${randomSuffix}`);

        const matchedStore = staffStores.find((s) => String(s.id) === qStoreId) || staffStores[0];
        setTargetStoreId(matchedStore ? String(matchedStore.id) : '');

        const matchedIng = ingredients.find((i) => i.code === qCode) || ingredients[0];
        setFormItems([
          {
            ingredientId: matchedIng ? String(matchedIng.id) : '',
            quantity: '',
            costPerUnit: String(matchedIng?.costPerUnit || '0'),
          },
        ]);
        setSupplier('แม็คโคร (Makro)');
        setNote('');
        setFormError(null);
        setModalOpen(true);
      }
    }
  }, [ingredients, staffStores]);

  // Open modal with fresh auto-generated PO number
  const openNewStockInModal = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`PO-${todayStr}-${randomSuffix}`);
    setTargetStoreId(staffStores[0]?.id ? String(staffStores[0].id) : '');
    setSupplier('แม็คโคร (Makro)');
    setNote('');
    setModalIngSearch('');
    setFormItems([{ ingredientId: ingredients[0]?.id ? String(ingredients[0].id) : '', quantity: '', costPerUnit: String(ingredients[0]?.costPerUnit || '0') }]);
    setFormError(null);
    setModalOpen(true);
  };

  // Handle dynamic form items
  const handleItemChange = (index: number, field: keyof InboundItemForm, value: string) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If ingredient changed, auto-fill standard cost
      if (field === 'ingredientId') {
        const found = ingredients.find((i) => i.id === Number(value));
        if (found) {
          updated[index].costPerUnit = String(found.costPerUnit || '0');
        }
      }
      return updated;
    });
  };

  const addItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      { ingredientId: ingredients[0]?.id ? String(ingredients[0].id) : '', quantity: '', costPerUnit: String(ingredients[0]?.costPerUnit || '0') },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Grand Total Calculation of Inbound Bill
  const grandTotalCost = useMemo(() => {
    return formItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.costPerUnit) || 0;
      return sum + qty * cost;
    }, 0);
  }, [formItems]);

  // Submit Inbound Stock Receipt
  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate items
    const validItems = formItems.filter(
      (item) => item.ingredientId && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนที่รับเข้าอย่างน้อย 1 รายการ');
      return;
    }

    if (!targetStoreId) {
      setFormError('กรุณาเลือกร้านค้า / จุดขายที่รับสต็อกเข้า');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        targetType: 'STORE',
        targetStoreId: Number(targetStoreId),
        supplier: supplier.trim(),
        invoiceNumber: invoiceNumber.trim(),
        note: note.trim(),
        items: validItems.map((item) => ({
          ingredientId: Number(item.ingredientId),
          quantity: parseFloat(item.quantity),
          costPerUnit: item.costPerUnit ? parseFloat(item.costPerUnit) : undefined,
        })),
      };

      const res = await fetch('/api/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'บันทึกรับสินค้าไม่สำเร็จ');
      }

      showToast(data.message || 'บันทึกรับสินค้าเข้าสต็อกร้านเรียบร้อยแล้ว');
      await mutate();
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return transactions.filter((tx) => {
      // Store Destination filter
      if (destinationFilter !== 'ALL') {
        const staffId = Number(destinationFilter);
        const selectedStore = staffStores.find((st) => st.id === staffId);
        const matchStore =
          tx.createdBy?.id === staffId ||
          tx.refId === `STORE-${staffId}` ||
          (selectedStore && tx.note?.includes(selectedStore.name)) ||
          tx.note?.includes(`[STORE_ID:${staffId}]`);
        if (!matchStore) return false;
      }

      // Search keyword
      const q = search.toLowerCase().trim();
      if (q) {
        const matchTx = tx.transactionNumber.toLowerCase().includes(q);
        const matchIng = tx.ingredient?.name.toLowerCase().includes(q) || tx.ingredient?.code.toLowerCase().includes(q);
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchRef = tx.refId?.toLowerCase().includes(q);
        if (!matchTx && !matchIng && !matchNote && !matchRef) return false;
      }

      // Date filter
      const txDate = new Date(tx.createdAt);
      if (dateFilter === 'TODAY') {
        return tx.createdAt.startsWith(todayStr);
      } else if (dateFilter === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return txDate >= weekAgo;
      } else if (dateFilter === 'MONTH') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return txDate >= monthAgo;
      }

      return true;
    });
  }, [transactions, destinationFilter, search, dateFilter, staffStores]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, destinationFilter, dateFilter]);

  // Paginated transactions (10 items per page)
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Executive Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter((t) => t.createdAt.startsWith(todayStr));
  const todayTotalCost = todayTransactions.reduce(
    (sum, t) => sum + Number(t.quantityIn) * Number(t.ingredient?.costPerUnit || 0),
    0
  );
  const totalInboundItems = transactions.length;
  const storeAllocationsCount = transactions.filter((t) => t.refType === 'STORE_ALLOCATE').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span>📥 บันทึกรับสินค้าเข้าสต็อก (ซื้อเข้า)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            บันทึกการซื้อวัตถุดิบเข้าสต็อกร้านค้าโดยตรง (ไม่มีคลังกลาง - ร้านค้าเป็นผู้ซื้อและเพิ่มสต็อกเข้าจุดขาย)
          </p>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={() => mutate()}
            disabled={refreshing}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <button
            onClick={openNewStockInModal}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ บันทึกรับสินค้าเข้าสต็อกร้าน (ซื้อเข้า)</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today Receipts */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              รับเข้าวันนี้
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {todayTransactions.length} <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            มูลค่า ฿{todayTotalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Card 2: Total Receipts Count */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              ประวัติรับเข้าทั้งหมด
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {totalInboundItems} <span className="text-xs font-semibold text-slate-500">ครั้ง</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">บันทึกซื้อเข้าสต็อก</p>
        </div>

        {/* Card 3: Store Count */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              ร้านค้าในระบบ
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {staffStores.length} <span className="text-xs font-semibold text-slate-500">สาขา/ร้าน</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">พร้อมบันทึกสต็อกขาย</p>
        </div>

        {/* Card 4: Total Raw Materials */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
              วัตถุดิบในระบบ
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {ingredients.length} <span className="text-xs font-semibold text-slate-500">ชนิด</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">พร้อมรับเข้าและตัดสต็อก</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ PO, ชื่อวัตถุดิบ, หรือผู้จำหน่าย..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Destination Store Filter */}
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer flex-1 md:flex-initial"
          >
            <option value="ALL">🏪 ทุกร้านค้า / จุดขาย</option>
            {staffStores.map((st) => (
              <option key={st.id} value={st.id}>
                🏪 {st.name} (@{st.username})
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
        </div>
      </div>

      {/* Inbound Stock Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดประวัติการรับสินค้าเข้าสต็อก...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <ArrowDownToLine className="w-10 h-10 text-slate-300" />
            <span>ไม่พบประวัติการรับสินค้าเข้าสต็อกที่ตรงกับเงื่อนไข</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-3 text-center w-12 text-slate-400">#</th>
                  <th className="py-3.5 px-4">เลขที่เอกสาร / รหัส</th>
                  <th className="py-3.5 px-4">วันที่ & เวลา</th>
                  <th className="py-3.5 px-4">ร้านค้าที่รับเข้า</th>
                  <th className="py-3.5 px-4">วัตถุดิบที่รับเข้า</th>
                  <th className="py-3.5 px-4 text-right">จำนวนที่ซื้อเข้า</th>
                  <th className="py-3.5 px-4 text-right">คงเหลือหลังรับ</th>
                  <th className="py-3.5 px-4">ผู้บันทึก / ข้อมูล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedTransactions.map((tx, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Sequence Row Number */}
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                        {rowNumber}
                      </td>

                      {/* Document / PO Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        <div className="group-hover:underline flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{tx.refId || tx.transactionNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {tx.transactionNumber}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="font-bold text-slate-700">
                          {new Date(tx.createdAt).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.createdAt).toLocaleTimeString('th-TH')} น.
                        </div>
                      </td>

                      {/* Destination Store Badge */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <Store className="w-3 h-3 text-amber-700" />
                          <span>{tx.createdBy?.name || 'ร้านค้า'}</span>
                        </span>
                      </td>

                      {/* Ingredient Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tx.ingredient?.name || '-'}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          รหัส: {tx.ingredient?.code}
                        </div>
                      </td>

                      {/* Quantity In */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-black text-sm text-emerald-700">
                          +{Number(tx.quantityIn).toLocaleString()} {tx.ingredient?.unit}
                        </span>
                      </td>

                      {/* Balance After */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {Number(tx.balanceAfter).toLocaleString()} {tx.ingredient?.unit}
                      </td>

                      {/* Note / Created By */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                        <div className="truncate text-slate-700 font-medium">
                          {tx.note || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          โดย: {tx.createdBy?.name || 'Admin'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination (10 items per page) */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredTransactions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">รายละเอียดใบรับสินค้าเข้าสต็อก</h3>
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
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">เลขที่อ้างอิง (Ref PO):</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTx.refId || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">วันที่ทำรายการ:</span>
                  <span className="font-bold text-slate-700">
                    {new Date(selectedTx.createdAt).toLocaleString('th-TH')} น.
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ร้านค้าปลายทาง:</span>
                  <span className="font-bold text-emerald-800">
                    🏪 {selectedTx.createdBy?.name || 'ร้านค้า'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-700">รายการวัตถุดิบ:</div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-black text-slate-800">{selectedTx.ingredient?.name}</div>
                    <div className="text-xs text-slate-400 font-mono">รหัส: {selectedTx.ingredient?.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-700 font-mono text-base">
                      +{Number(selectedTx.quantityIn).toLocaleString()} {selectedTx.ingredient?.unit}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ต้นทุนต่อหน่วย: ฿{Number(selectedTx.ingredient?.costPerUnit || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900">
                <span className="font-bold">หมายเหตุการรับเข้า: </span>
                <span>{selectedTx.note || '-'}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
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

      {/* Modal: Record New Stock In */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 h-[92vh] max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">📥 บันทึกรับสินค้าเข้าสต็อก (ซื้อเข้า)</h3>
                  <p className="text-xs text-slate-500">บันทึกยอดการซื้อวัตถุดิบและเพิ่มยอดเข้าสต็อกของร้านค้าโดยตรง</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitStockIn} className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Single Scrollable Form Container (No Double Scrollbars!) */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 space-y-3.5 scrollbar-thin">
                {/* Store Selection */}
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Store className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>เลือกร้านค้า / จุดขายที่รับสต็อกเข้า (ซื้อเข้า):</span>
                    <span className="text-red-500">*</span>
                  </div>
                  <select
                    value={targetStoreId}
                    onChange={(e) => setTargetStoreId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {staffStores.map((st) => (
                      <option key={st.id} value={st.id}>
                        🏪 {st.name} (@{st.username})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-amber-800">
                    💡 วัตถุดิบที่บันทึกรับเข้าจะถูกเพิ่มเข้าสต็อกคงเหลือของร้านค้านี้โดยตรงทันที เพื่อให้พร้อมใช้งานและขายผ่าน POS
                  </p>
                </div>

                {/* Bill Meta: PO Number & Supplier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เลขที่ใบสั่งซื้อ / ใบเสร็จ (PO Number) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="PO-20261106-xxxx"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ผู้จำหน่าย / แหล่งซื้อ (Supplier)
                    </label>
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="เช่น แม็คโคร, ตลาดไท, โรงงาน..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Dynamic Items List (Natural flow without inner nested scrollbar!) */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      รายการวัตถุดิบที่รับเข้า ({formItems.length} รายการ) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มแถววัตถุดิบ</span>
                    </button>
                  </div>

                  {/* Search box to filter ingredients */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="🔍 ค้นหาวัตถุดิบ (พิมพ์ชื่อหรือรหัสเพื่อกรองตัวเลือกในแถว)..."
                      value={modalIngSearch}
                      onChange={(e) => setModalIngSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {modalIngSearch && (
                      <button
                        type="button"
                        onClick={() => setModalIngSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        title="ล้างคำค้นหา"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {formItems.map((item, idx) => {
                      const selectedIng = ingredients.find((i) => i.id === Number(item.ingredientId));
                      const storeStock = selectedIng ? (currentStoreStockMap.get(selectedIng.id) ?? 0) : 0;
                      const inboundQty = parseFloat(item.quantity) || 0;
                      const newBalance = storeStock + inboundQty;
                      const rowSubtotal = inboundQty * (parseFloat(item.costPerUnit) || 0);

                      return (
                        <div
                          key={idx}
                          className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5 transition-all hover:border-slate-300"
                        >
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            {/* Ingredient Select */}
                            <div className="flex-1 w-full">
                              <select
                                value={item.ingredientId}
                                onChange={(e) => handleItemChange(idx, 'ingredientId', e.target.value)}
                                required
                                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              >
                                <option value="">-- เลือกวัตถุดิบ --</option>
                                {/* Keep currently selected ingredient visible even if search filters it out */}
                                {selectedIng && !filteredIngredientsForModal.some((i) => i.id === selectedIng.id) && (
                                  <option value={selectedIng.id}>
                                    {selectedIng.name} (ในร้านเหลือ: {(currentStoreStockMap.get(selectedIng.id) ?? 0).toLocaleString()} {selectedIng.unit})
                                  </option>
                                )}
                                {filteredIngredientsForModal.map((ing) => {
                                  const inStoreBal = currentStoreStockMap.get(ing.id) ?? 0;
                                  return (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} (ในร้านเหลือ: {inStoreBal.toLocaleString()} {ing.unit})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Quantity In */}
                            <div className="w-full sm:w-36 flex items-center gap-1">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                required
                                placeholder="ระบุจำนวน"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                              />
                              <span className="text-[11px] text-slate-500 font-mono w-12 truncate text-right">
                                {selectedIng?.unit || 'หน่วย'}
                              </span>
                            </div>

                            {/* Cost Per Unit */}
                            <div className="w-full sm:w-28 flex items-center gap-1">
                              <span className="text-slate-400 text-[11px]">฿</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="ต้นทุน"
                                value={item.costPerUnit}
                                onChange={(e) => handleItemChange(idx, 'costPerUnit', e.target.value)}
                                className="w-full px-2 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono text-right focus:outline-none"
                              />
                            </div>

                            {/* Subtotal Preview */}
                            <div className="w-24 text-right font-mono font-bold text-slate-700 hidden sm:block">
                              ฿{rowSubtotal.toFixed(2)}
                            </div>

                            {/* Delete Row */}
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={formItems.length === 1}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30 cursor-pointer transition-colors"
                              title="ลบแถวนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Real-time Store Stock Calculation: [Store Current Stock] + [Quantity In] = [New Store Balance] */}
                          {selectedIng && (
                            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                                <span>คงเหลือเดิมในร้าน {targetStoreObj ? `(${targetStoreObj.name})` : ''}:</span>
                                <span className="font-mono font-bold text-slate-700">
                                  {storeStock.toLocaleString()} {selectedIng.unit}
                                </span>
                                {inboundQty > 0 && (
                                  <>
                                    <span className="text-emerald-600 font-black">+</span>
                                    <span>ซื้อเข้า:</span>
                                    <span className="font-mono font-bold text-emerald-700">
                                      {inboundQty.toLocaleString()} {selectedIng.unit}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800">
                                <span className="text-[10px] text-emerald-600 font-semibold">ยอดคงเหลือใหม่ในร้านหลังรับเข้า:</span>
                                <span className="font-mono font-black text-xs text-emerald-700">
                                  {newBalance.toLocaleString()} {selectedIng.unit}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grand Total Bar */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">ยอดเงินรวมทั้งสิ้น (Grand Total):</span>
                  <span className="font-mono font-black text-base text-emerald-800">
                    ฿{grandTotalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมายเหตุเพิ่มเติม
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น สต็อกสำรองช่วงเทศกาล, ได้รับส่วนลดพิเศษ..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Fixed Footer Actions pinned inside the modal card */}
              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{submitting ? 'กำลังบันทึก...' : '💾 ยืนยันบันทึกรับสินค้าเข้าสต็อกร้าน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

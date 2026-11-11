'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Pagination from '@/components/Pagination';
import {
  ArrowUpFromLine,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  FileText,
  Printer,
  Package,
  Store,
  Layers,
  ArrowRight,
  TrendingDown,
  Warehouse,
  Send,
  Trash2,
} from 'lucide-react';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  currentStock: string | number;
  costPerUnit: string | number;
}

interface StaffStore {
  id: number;
  username: string;
  name: string;
}

interface StockTransaction {
  id: number;
  transactionNumber: string;
  ingredientId: number;
  type: string;
  quantityIn: string | number;
  quantityOut: string | number;
  balanceAfter: string | number;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: string;
  ingredient?: Ingredient;
  createdBy?: {
    id: number;
    name: string;
    username: string;
    role?: string;
  };
}

interface OutboundItemForm {
  ingredientId: string;
  quantity: string;
}

interface RequisitionSlipGroup {
  slipNumber: string;
  createdAt: string;
  storeName: string;
  creatorName: string;
  note: string | null;
  items: StockTransaction[];
  totalItemsCount: number;
  totalQuantity: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminStockOutPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/stock-out', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 5000,
    dedupingInterval: 2000,
  });

  const transactions: StockTransaction[] = data?.transactions || [];
  const ingredients: Ingredient[] = data?.ingredients || [];
  const staffStores: StaffStore[] = data?.staffStores || [];

  // Filter States
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal 1: Create New Stock Out
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  const [requisitionNumber, setRequisitionNumber] = useState<string>('');
  const [note, setNote] = useState('');
  const [formItems, setFormItems] = useState<OutboundItemForm[]>([
    { ingredientId: '', quantity: '1' },
  ]);

  // Modal 2: View Detail
  const [selectedTx, setSelectedTx] = useState<StockTransaction | null>(null);

  // Modal 3: Print Slip
  const [printSlipOpen, setPrintSlipOpen] = useState(false);
  const [printGroupItems, setPrintGroupItems] = useState<StockTransaction[]>([]);
  const [printSlipMeta, setPrintSlipMeta] = useState<{
    refId: string;
    createdAt: string;
    storeName: string;
    note: string | null;
    creatorName: string;
  } | null>(null);

  // Modal 4: Print All Outbound Transactions in 1 Combined Report (พิมพ์ทีเดียวรวมทุกรายการ)
  const [printAllModalOpen, setPrintAllModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open modal with fresh auto-generated REQ number
  const openNewStockOutModal = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setRequisitionNumber(`REQ-${todayStr}-${randomSuffix}`);
    setTargetStoreId(staffStores[0]?.id ? String(staffStores[0].id) : '');
    setNote('');
    setFormItems([
      { ingredientId: ingredients[0]?.id ? String(ingredients[0].id) : '', quantity: '1' },
    ]);
    setFormError(null);
    setModalOpen(true);
  };

  // Dynamic form item handlers
  const handleItemChange = (index: number, field: keyof OutboundItemForm, value: string) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      { ingredientId: ingredients[0]?.id ? String(ingredients[0].id) : '', quantity: '1' },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit stock out to API
  const handleSubmitStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!targetStoreId) {
      setFormError('กรุณาเลือกร้านค้า / จุดขายที่มารับสินค้า');
      return;
    }

    const validItems = formItems.filter(
      (item) => item.ingredientId && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนที่ต้องการเบิกจ่ายอย่างน้อย 1 รายการ');
      return;
    }

    // Client-side stock availability validation
    for (const item of validItems) {
      const ing = ingredients.find((i) => i.id === Number(item.ingredientId));
      if (ing) {
        const available = Number(ing.currentStock);
        const reqQty = parseFloat(item.quantity);
        if (reqQty > available) {
          setFormError(
            `วัตถุดิบ "${ing.name}" คงเหลือในคลังเพียง ${available.toLocaleString()} ${ing.unit} ไม่พอสำหรับการเบิกจ่ายจำนวน ${reqQty.toLocaleString()} ${ing.unit}`
          );
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        targetStoreId: Number(targetStoreId),
        requisitionNumber: requisitionNumber.trim(),
        note: note.trim(),
        items: validItems.map((item) => ({
          ingredientId: Number(item.ingredientId),
          quantity: parseFloat(item.quantity),
        })),
      };

      const res = await fetch('/api/stock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'บันทึกเบิกจ่ายสินค้าไม่สำเร็จ');
      }

      showToast(data.message || 'บันทึกเบิกจ่ายสินค้าไปหน้าร้านเรียบร้อยแล้ว');
      await mutate();
      setModalOpen(false);

      // Auto-open Printable Requisition Slip for the newly created transaction
      const createdTxs: StockTransaction[] = data.transactions || [];
      const newSlipNumber = data.slipNumber || requisitionNumber.trim();
      const newStoreName = data.storeName || staffStores.find((s) => s.id === Number(targetStoreId))?.name || 'ร้านค้าหน้าร้าน';

      if (createdTxs.length > 0) {
        setPrintGroupItems(createdTxs);
        setPrintSlipMeta({
          refId: newSlipNumber,
          createdAt: new Date().toISOString(),
          storeName: newStoreName,
          note: note.trim() || null,
          creatorName: 'เจ้าหน้าที่คลัง',
        });
        setPrintSlipOpen(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Printable Voucher for an entire Requisition Slip
  const handleOpenPrintSlipByGroup = (slip: RequisitionSlipGroup) => {
    setPrintGroupItems(slip.items);
    setPrintSlipMeta({
      refId: slip.slipNumber,
      createdAt: slip.createdAt,
      storeName: slip.storeName,
      note: slip.note,
      creatorName: slip.creatorName,
    });
    setPrintSlipOpen(true);
  };

  // Open Printable Voucher for a Requisition from single item
  const handleOpenPrintSlip = (tx: StockTransaction) => {
    const slipRef = tx.refId || tx.transactionNumber;
    // Find all items belonging to the same requisition bill
    const relatedItems = transactions.filter(
      (t) => (t.refId || t.transactionNumber) === slipRef
    );

    // Extract store name from note or createdBy
    let extractedStoreName = 'ร้านค้าหน้าร้าน';
    if (tx.note && tx.note.includes('เบิกจ่ายให้ร้าน:')) {
      const match = tx.note.match(/เบิกจ่ายให้ร้าน:\s*([^\(@•]+)/);
      if (match && match[1]) {
        extractedStoreName = match[1].trim();
      }
    } else if (tx.createdBy?.name) {
      extractedStoreName = tx.createdBy.name;
    }

    setPrintGroupItems(relatedItems.length > 0 ? relatedItems : [tx]);
    setPrintSlipMeta({
      refId: slipRef,
      createdAt: tx.createdAt,
      storeName: extractedStoreName,
      note: tx.note,
      creatorName: tx.createdBy?.name || 'เจ้าหน้าที่คลัง',
    });
    setPrintSlipOpen(true);
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return transactions.filter((tx) => {
      // Store filter
      if (storeFilter !== 'ALL') {
        const staffId = Number(storeFilter);
        const selectedStore = staffStores.find((st) => st.id === staffId);
        const matchStore =
          tx.createdBy?.id === staffId ||
          (selectedStore && tx.note?.includes(selectedStore.name));
        if (!matchStore) return false;
      }

      // Search keyword
      const q = search.toLowerCase().trim();
      if (q) {
        const matchTx = tx.transactionNumber.toLowerCase().includes(q);
        const matchIng =
          tx.ingredient?.name.toLowerCase().includes(q) ||
          tx.ingredient?.code.toLowerCase().includes(q);
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
  }, [transactions, storeFilter, search, dateFilter, staffStores]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, storeFilter, dateFilter]);

  // Paginated transactions (10 items per page for screen view)
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Grouped by Requisition Slip
  const requisitionSlips = useMemo(() => {
    const map = new Map<string, RequisitionSlipGroup>();

    filteredTransactions.forEach((tx) => {
      const slipKey = tx.refId || tx.transactionNumber;

      let storeNameDisplay = tx.createdBy?.name || 'ร้านค้าหน้าร้าน';
      if (tx.note && tx.note.includes('เบิกจ่ายให้ร้าน:')) {
        const m = tx.note.match(/เบิกจ่ายให้ร้าน:\s*([^\(@•]+)/);
        if (m && m[1]) storeNameDisplay = m[1].trim();
      }

      if (!map.has(slipKey)) {
        map.set(slipKey, {
          slipNumber: slipKey,
          createdAt: tx.createdAt,
          storeName: storeNameDisplay,
          creatorName: tx.createdBy?.name || 'เจ้าหน้าที่คลัง',
          note: tx.note || null,
          items: [],
          totalItemsCount: 0,
          totalQuantity: 0,
        });
      }

      const grp = map.get(slipKey)!;
      grp.items.push(tx);
      grp.totalItemsCount += 1;
      grp.totalQuantity += Number(tx.quantityOut || 0);
    });

    return Array.from(map.values());
  }, [filteredTransactions]);

  // Items for batch report (all filtered transactions)
  const batchReportItems = filteredTransactions;

  // Executive Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter((t) => t.createdAt.startsWith(todayStr));
  const todayTotalQtyOut = todayTransactions.reduce(
    (sum, t) => sum + Number(t.quantityOut),
    0
  );

  const todaySlipsCount = useMemo(() => {
    const set = new Set<string>();
    todayTransactions.forEach((t) => set.add(t.refId || t.transactionNumber));
    return set.size;
  }, [todayTransactions]);

  const totalSlipsCount = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.refId || t.transactionNumber));
    return set.size;
  }, [transactions]);

  const totalDispatches = transactions.length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Normal Screen UI (Hidden during print so it occupies 0px and avoids blank/shifted pages) */}
      <div className="print:hidden space-y-6">
        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">
              เบิกจ่ายสินค้าจากคลังสินค้าส่วนกลางไปยังร้านค้าหน้าร้าน (Stock Out & Store Requisition) สต็อกคลังกลางจะถูกตัดลดทันที
            </p>
          </div>

          <div className="flex items-center gap-2.5 ml-auto shrink-0">
            <button
              onClick={() => mutate()}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            {/* Print All Outbound Transactions Report Button */}
            <button
              type="button"
              onClick={() => setPrintAllModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
              title="พิมพ์รายงานสรุปการเบิกจ่ายสินค้าทั้งหมดทีเดียว"
            >
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>พิมพ์รายงานเบิกจ่าย</span>
            </button>

            <button
              onClick={openNewStockOutModal}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>+ บันทึกเบิกจ่ายสินค้าไปหน้าร้าน</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today Dispatches */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                ใบเบิกจ่ายวันนี้
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
              {todaySlipsCount}{' '}
              <span className="text-xs font-semibold text-slate-500">ใบ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">รวม {todayTransactions.length} รายการวัตถุดิบ</p>
          </div>

          {/* Card 2: Today Units Out */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                จำนวนที่เบิกไปวันนี้
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
              {todayTotalQtyOut.toLocaleString()}{' '}
              <span className="text-xs font-semibold text-slate-500">หน่วย</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">ตัดออกจากคลังกลาง</p>
          </div>

          {/* Card 3: Stores Count */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                ร้านค้าประจำสาขา
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
              {staffStores.length}{' '}
              <span className="text-xs font-semibold text-slate-500">ร้านค้า</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">พร้อมรับการจัดสรรของ</p>
          </div>

          {/* Card 4: Total Slips History */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                ใบเบิกสะสมทั้งหมด
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
              {totalSlipsCount}{' '}
              <span className="text-xs font-semibold text-slate-500">ใบ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">รวม {totalDispatches} รายการตัดสต็อก</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-200 shadow-2xs">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ใบเบิก, วัตถุดิบ, หมายเหตุ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Store Destination Filter */}
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer flex-1 md:flex-initial"
            >
              <option value="ALL">🏪 ทุกร้านค้าปลายทาง</option>
              {staffStores.map((st) => (
                <option key={st.id} value={st.id}>
                  &nbsp;&nbsp;↳ 🏪 {st.name} (@{st.username})
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
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

        {/* Stock Out Transactions Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">กำลังโหลดประวัติการเบิกจ่ายสินค้า...</span>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <ArrowUpFromLine className="w-10 h-10 text-slate-300" />
              <span>ไม่พบรายการเบิกจ่ายสินค้าที่ตรงกับเงื่อนไข</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">เลขที่ใบเบิก / เลขที่รายการ</th>
                    <th className="py-3.5 px-4">วันที่ & เวลาเบิก</th>
                    <th className="py-3.5 px-4">ร้านค้าผู้เบิกรับ</th>
                    <th className="py-3.5 px-4">วัตถุดิบที่เบิก</th>
                    <th className="py-3.5 px-4 text-right">จำนวนที่เบิกจ่าย</th>
                    <th className="py-3.5 px-4 text-right">คลังกลางคงเหลือ</th>
                    <th className="py-3.5 px-4">หมายเหตุ</th>
                    <th className="py-3.5 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedTransactions.map((tx) => {
                    const qtyOut = Number(tx.quantityOut);
                    const balAfter = Number(tx.balanceAfter);

                    // Extract store name
                    let storeNameDisplay = tx.createdBy?.name || 'ร้านค้าหน้าร้าน';
                    if (tx.note && tx.note.includes('เบิกจ่ายให้ร้าน:')) {
                      const m = tx.note.match(/เบิกจ่ายให้ร้าน:\s*([^\(@•]+)/);
                      if (m && m[1]) storeNameDisplay = m[1].trim();
                    }

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Requisition Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                          <div className="group-hover:underline flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-700" />
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

                        {/* Store Destination Badge */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                            <Store className="w-3 h-3 text-emerald-700" />
                            <span>{storeNameDisplay}</span>
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

                        {/* Quantity Out */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-sm text-emerald-700">
                            -{qtyOut.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">
                            {tx.ingredient?.unit}
                          </span>
                        </td>

                        {/* Balance After in Central Warehouse */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-slate-800">
                            {balAfter.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">
                            {tx.ingredient?.unit}
                          </span>
                        </td>

                        {/* Note */}
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {tx.note || '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenPrintSlip(tx)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer border border-emerald-200 flex items-center gap-1"
                              title="พิมพ์ใบเบิกจ่ายสินค้าไปหน้าร้าน"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-700" />
                              <span>พิมพ์ใบเบิก</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedTx(tx)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                            >
                              ดูรายละเอียด
                            </button>
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
      </div>

      {/* Modal 1: Create New Stock Out (บันทึกเบิกจ่ายสินค้าไปหน้าร้าน) */}
      {modalOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ArrowUpFromLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    บันทึกเบิกจ่ายสินค้าไปหน้าร้าน (Stock Out to Store)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ตัดลดยอดวัตถุดิบออกจากคลังสินค้าส่วนกลาง และส่งมอบให้ร้านค้าหน้าร้าน
                  </p>
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

            <form onSubmit={handleSubmitStockOut} className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin">
                {/* Store Selection */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                    <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>เลือกร้านค้า / จุดขายหน้าร้านที่มารับของ:</span>
                    <span className="text-red-500">*</span>
                  </div>
                  <select
                    value={targetStoreId}
                    onChange={(e) => setTargetStoreId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {staffStores.map((st) => (
                      <option key={st.id} value={st.id}>
                        🏪 {st.name} (@{st.username})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-800">
                    💡 สต็อกจะถูกตัดลดออกจากคลังสินค้าส่วนกลางทันทีเมื่อกดยืนยันการเบิกจ่าย
                  </p>
                </div>

                {/* Slip Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เลขที่ใบเบิกสินค้า (Requisition No.) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={requisitionNumber}
                      onChange={(e) => setRequisitionNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      หมายเหตุการเบิกจ่าย
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น เบิกใช้ขายกะเช้า, เติมสต็อกวันหยุด..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Itemized Requisition Rows */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      รายการวัตถุดิบที่ต้องการเบิกจ่าย ({formItems.length} รายการ)
                    </label>
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-emerald-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มรายการวัตถุดิบ</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formItems.map((item, idx) => {
                      const selectedIng = ingredients.find((i) => i.id === Number(item.ingredientId));
                      const availableStock = selectedIng ? Number(selectedIng.currentStock) : 0;
                      const reqQty = parseFloat(item.quantity) || 0;
                      const balanceAfter = availableStock - reqQty;
                      const isOverStock = reqQty > availableStock;

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isOverStock
                              ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400/20 shadow-xs'
                              : 'bg-slate-50/80 border-slate-200/90 shadow-2xs hover:border-slate-300'
                          }`}
                        >
                          <div className="grid grid-cols-12 gap-2.5 items-center">
                            {/* Ingredient Dropdown */}
                            <div className="col-span-12 sm:col-span-7">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>รายการวัตถุดิบ #{idx + 1}</span>
                                </label>
                                {selectedIng && (
                                  <span className="text-[11px] font-medium text-slate-500">
                                    รหัส: <strong className="font-mono text-slate-700">{selectedIng.code}</strong>
                                  </span>
                                )}
                              </div>
                              <select
                                value={item.ingredientId}
                                onChange={(e) =>
                                  handleItemChange(idx, 'ingredientId', e.target.value)
                                }
                                required
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                              >
                                {ingredients.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.code}) — คงเหลือในคลัง: {Number(ing.currentStock).toLocaleString()} {ing.unit}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity Input */}
                            <div className="col-span-10 sm:col-span-4">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700">
                                  จำนวนที่เบิก ({selectedIng?.unit || 'หน่วย'})
                                </label>
                                {selectedIng && availableStock > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleItemChange(idx, 'quantity', String(availableStock))}
                                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                                    title="เบิกทั้งหมดที่คลังมี"
                                  >
                                    เบิกทั้งหมด
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                required
                                placeholder="0"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(idx, 'quantity', e.target.value)
                                }
                                className={`w-full px-3 py-2 text-xs rounded-xl border font-mono font-bold text-right focus:outline-none focus:ring-2 ${
                                  isOverStock
                                    ? 'border-red-400 bg-white text-red-700 focus:ring-red-500/20'
                                    : 'border-slate-200 bg-white text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600'
                                }`}
                              />
                            </div>

                            {/* Delete Row */}
                            <div className="col-span-2 sm:col-span-1 flex items-end justify-center pt-5 sm:pt-4">
                              <button
                                type="button"
                                disabled={formItems.length === 1}
                                onClick={() => removeItemRow(idx)}
                                className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-30 cursor-pointer transition-colors"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 3 Metric Calculation Cards: ยอดปัจจุบัน / จำนวนเบิก / ยอดคงเหลือ */}
                          {selectedIng && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 grid grid-cols-3 gap-2 text-center">
                              {/* 1. ยอดปัจจุบัน */}
                              <div className="p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                                <div className="text-[10px] font-bold text-slate-500">ยอดปัจจุบัน (ในคลัง)</div>
                                <div className="font-mono font-bold text-slate-800 text-xs sm:text-sm mt-0.5">
                                  {availableStock.toLocaleString()}{' '}
                                  <span className="text-[10px] font-normal text-slate-500">{selectedIng.unit}</span>
                                </div>
                              </div>

                              {/* 2. จำนวนเบิก */}
                              <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-amber-800">จำนวนที่เบิก</div>
                                <div className="font-mono font-bold text-amber-700 text-xs sm:text-sm mt-0.5">
                                  -{reqQty.toLocaleString()}{' '}
                                  <span className="text-[10px] font-normal text-amber-600">{selectedIng.unit}</span>
                                </div>
                              </div>

                              {/* 3. คงเหลือหลังเบิก */}
                              <div
                                className={`p-2 rounded-xl border shadow-2xs ${
                                  isOverStock
                                    ? 'bg-red-50 border-red-300'
                                    : 'bg-emerald-50/80 border-emerald-200'
                                }`}
                              >
                                <div
                                  className={`text-[10px] font-bold ${
                                    isOverStock ? 'text-red-700' : 'text-emerald-800'
                                  }`}
                                >
                                  {isOverStock ? 'สต็อกไม่พอ! (ขาด)' : 'คงเหลือหลังเบิก'}
                                </div>
                                <div
                                  className={`font-mono font-black text-xs sm:text-sm mt-0.5 ${
                                    isOverStock ? 'text-red-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {balanceAfter.toLocaleString()}{' '}
                                  <span className="text-[10px] font-normal">
                                    {selectedIng.unit}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Warning if requested exceeds available */}
                          {isOverStock && (
                            <div className="mt-2 text-[11px] font-bold text-red-600 flex items-center gap-1.5 bg-red-100/60 p-2 rounded-xl border border-red-200">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                              <span>
                                ยอดเบิกเกินจำนวนคงเหลือในคลัง (มีเพียง {availableStock.toLocaleString()} {selectedIng?.unit} ขาดอีก {Math.abs(balanceAfter).toLocaleString()} {selectedIng?.unit})
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary of entire withdrawal */}
                  {formItems.length > 0 && (
                    <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-700" />
                        <span className="font-bold text-slate-700">
                          สรุปการเบิกจ่าย: <strong>{formItems.length} รายการ</strong>
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-600">
                        รวมจำนวนเบิกทั้งหมด:{' '}
                        <strong className="text-emerald-800 text-sm font-black">
                          {formItems
                            .reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0)
                            .toLocaleString()}
                        </strong>{' '}
                        หน่วย
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50"
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  <span>
                    {submitting ? 'กำลังบันทึกตัดสต็อก...' : 'ยืนยันการเบิกจ่าย (ตัดลดสต็อกคลังกลาง)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: View Single Transaction Detail */}
      {selectedTx && !printSlipOpen && !printAllModalOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    ใบเบิกจ่ายสินค้า #{selectedTx.refId || selectedTx.transactionNumber}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedTx.transactionNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">วันที่ทำรายการ:</span>
                <span className="font-bold text-slate-700">
                  {new Date(selectedTx.createdAt).toLocaleString('th-TH')} น.
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ร้านค้าผู้เบิกรับ:</span>
                <span className="font-bold text-emerald-800">
                  {selectedTx.createdBy?.name || 'ร้านค้าหน้าร้าน'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">วัตถุดิบ:</span>
                <span className="font-bold text-slate-900">
                  {selectedTx.ingredient?.name} ({selectedTx.ingredient?.code})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ยอดคงเหลือก่อนเบิก:</span>
                <span className="font-mono font-bold text-slate-700">
                  {(Number(selectedTx.balanceAfter) + Number(selectedTx.quantityOut)).toLocaleString()} {selectedTx.ingredient?.unit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">จำนวนที่เบิกจ่าย:</span>
                <span className="font-mono font-bold text-sm text-amber-700">
                  -{Number(selectedTx.quantityOut).toLocaleString()} {selectedTx.ingredient?.unit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">คงเหลือในคลังกลางหลังเบิก:</span>
                <span className="font-mono font-bold text-slate-800">
                  {Number(selectedTx.balanceAfter).toLocaleString()} {selectedTx.ingredient?.unit}
                </span>
              </div>
              {selectedTx.note && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400">หมายเหตุ:</span>
                  <p className="font-medium text-slate-700 mt-0.5">{selectedTx.note}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleOpenPrintSlip(selectedTx)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/20 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบเบิกจ่ายสินค้า</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Official Printable Store Requisition Slip (Single Slip / Voucher) */}
      {printSlipOpen && printSlipMeta && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Toolbar (Hidden when printing) */}
          <div className="no-print w-full max-w-3xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างพิมพ์: ใบเบิกจ่ายสินค้าจากคลังไปหน้าร้าน (ขนาดพอดีเอกสาร)
                </h4>
                <p className="text-[11px] text-slate-500">
                  เลขที่เอกสาร: <span className="font-mono font-bold text-slate-800">{printSlipMeta.refId}</span> • จุดรับ: <span className="font-semibold text-slate-800">{printSlipMeta.storeName}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
                onClick={() => setPrintSlipOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Document Sheet (Compact Standard Voucher Style) */}
          <div
            id="official-stock-out-slip"
            className="w-full max-w-3xl mx-auto bg-white text-black p-6 sm:p-7 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none print:p-0 space-y-3.5"
          >
            {/* Top Right Reference Meta */}
            <div className="absolute top-4 right-6 text-right text-[10px] text-black font-mono leading-tight">
              <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
              <div>RTTR060ATHA.QRP</div>
            </div>

            {/* Document Header */}
            <div className="relative pb-1 mb-2 border-b border-black">
              {/* Company & Document Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight uppercase">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  ใบเบิกจ่ายสินค้าจากคลังไปหน้าร้าน (ใบขอเบิก-จ่ายวัตถุดิบและพัสดุ)
                </h3>
              </div>

              {/* Sub-Header: Meta Info Row */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-t border-black pt-1.5 text-black">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-bold">เลขที่เอกสาร: </span>
                    <span className="font-mono font-bold">{printSlipMeta.refId}</span>
                  </div>
                  <div>
                    <span className="font-bold">วันที่เบิกจ่าย: </span>
                    <span className="font-mono">
                      {new Date(printSlipMeta.createdAt).toLocaleDateString('th-TH')}{' '}
                      {new Date(printSlipMeta.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">จุดรับสินค้า: </span>
                    <span className="font-bold">{printSlipMeta.storeName}</span>
                  </div>
                  <div>
                    <span className="font-bold">คลังผู้จ่าย: </span>
                    <span>คลังส่วนกลาง JJ Mall</span>
                  </div>
                </div>
                <div>
                  <span className="font-bold">พิมพ์เมื่อ: </span>
                  <span className="font-mono">
                    {new Date().toLocaleDateString('th-TH')}{' '}
                    {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
              </div>

              {printSlipMeta.note && (
                <div className="border-t border-black pt-1 mt-1 text-[10.5px]">
                  <span className="font-bold">หมายเหตุการเบิกจ่าย: </span>
                  <span>{printSlipMeta.note}</span>
                </div>
              )}
            </div>

            {/* Requisition Items Table */}
            <div className="overflow-x-auto print:overflow-visible my-2">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-b border-black text-black font-bold bg-white text-center">
                    <th className="py-2 px-2 border-r border-black w-10 text-center">ลำดับ</th>
                    <th className="py-2 px-2.5 border-r border-black w-28">รหัสวัตถุดิบ</th>
                    <th className="py-2 px-3 border-r border-black text-left">ชื่อวัตถุดิบ</th>
                    <th className="py-2 px-2.5 border-r border-black text-right w-24">จำนวนที่เบิกจ่าย</th>
                    <th className="py-2 px-2 border-r border-black text-center w-16">หน่วยนับ</th>
                    <th className="py-2 px-3 text-right w-36">คงเหลือในคลังหลังเบิก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {printGroupItems.map((item, idx) => {
                    const qtyOut = Number(item.quantityOut);
                    const balAfter = Number(item.balanceAfter);

                    return (
                      <tr key={item.id} className="border-b border-black">
                        <td className="py-2 px-2 text-center border-r border-black font-sans text-black">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 border-r border-black font-bold text-black font-mono">
                          {item.ingredient?.code}
                        </td>
                        <td className="py-2 px-3 border-r border-black font-sans font-medium text-black text-left">
                          {item.ingredient?.name}
                        </td>
                        <td className="py-2 px-2.5 border-r border-black text-right font-bold text-black font-mono">
                          {qtyOut.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-center font-sans text-black border-r border-black">
                          {item.ingredient?.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-black">
                          {balAfter.toLocaleString()} {item.ingredient?.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black bg-white font-bold text-[10px] text-black">
                    <td colSpan={3} className="py-2 px-3 text-right font-sans border-r border-black">
                      รวมรายการวัตถุดิบที่เบิกจ่ายทั้งสิ้น:
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold border-r border-black">
                      {printGroupItems
                        .reduce((sum, it) => sum + Number(it.quantityOut || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td colSpan={2} className="py-2 px-3 text-left font-sans text-black">
                      <span className="font-mono font-bold">{printGroupItems.length}</span> รายการ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom 3 Signature Blocks */}
            <div className="print-signature-section mt-5 pt-3 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้เบิกสินค้า (เจ้าของร้าน / พนักงานหน้าร้าน)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้จ่ายสินค้า (เจ้าหน้าที่คลังสินค้าส่วนกลาง)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจสอบ / ผู้อนุมัติ (บัญชี / แอดมิน)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Official Multi-Item Outbound Report (พิมพ์ทีเดียวรวมทุกรายการ) */}
      {printAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Toolbar (Hidden when printing) */}
          {/* Top Control Toolbar (Hidden when printing) */}
          <div className="no-print w-full max-w-4xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างพิมพ์: รายงานสรุปการเบิกจ่ายสินค้าไปหน้าร้านทั้งหมด (ขนาดกระชับพอดี)
                </h4>
                <p className="text-[11px] text-slate-500">
                  รายงานสรุปการเบิกจ่ายวัตถุดิบและพัสดุตามเงื่อนไขตัวกรอง
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-600 font-medium bg-slate-100 px-3 py-1.5 rounded-xl">
                รวมทั้งหมด <span className="font-bold font-mono text-slate-900">{filteredTransactions.length}</span> รายการ
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
                onClick={() => setPrintAllModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Document Sheet (A4 Landscape Style, Standard Official Monochrome Black & White) */}
          <div
            id="official-stock-out-report"
            className="w-full max-w-4xl mx-auto bg-white text-black p-6 sm:p-7 shadow-2xl rounded-xl border border-black font-sans text-[10px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none print:p-0 space-y-3.5"
          >
            {/* Document Header */}
            <div className="relative pb-1 mb-2 border-b border-black">
              <div className="absolute top-4 right-6 text-right text-[10px] text-black font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>RTTR060ATHA.QRP</div>
              </div>

              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight uppercase">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  รายงานการเบิกจ่ายสินค้าไปหน้าร้าน (Stock Requisition & Outbound Ledger Report)
                </h3>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-t border-black pt-1.5 text-black">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-bold">ร้านค้าปลายทาง: </span>
                    <span className="font-bold">
                      {storeFilter === 'ALL'
                        ? 'ทุกร้านค้าปลายทาง'
                        : staffStores.find((s) => String(s.id) === storeFilter)?.name || storeFilter}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">ช่วงเวลา: </span>
                    <span className="font-bold">
                      {dateFilter === 'ALL'
                        ? 'ทั้งหมด'
                        : dateFilter === 'TODAY'
                        ? 'วันนี้'
                        : dateFilter === 'WEEK'
                        ? '7 วันล่าสุด'
                        : '30 วันล่าสุด'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">คลังสินค้า: </span>
                    <span>คลังส่วนกลาง JJ Mall</span>
                  </div>
                </div>
                <div>
                  <span className="font-bold">พิมพ์เมื่อ: </span>
                  <span className="font-mono">
                    {new Date().toLocaleDateString('th-TH')}{' '}
                    {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
              </div>
            </div>

            {/* Requisition Items Table */}
            <div className="overflow-x-auto print:overflow-visible my-2">
              <table className="w-full text-left border-collapse text-[9px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-b border-black text-black font-bold bg-white text-center">
                    <th className="py-1 px-1 border-r border-black w-8 text-center">ลำดับ</th>
                    <th className="py-1 px-2 border-r border-black w-24">เลขที่ใบเบิก</th>
                    <th className="py-1 px-2 border-r border-black w-20">วันที่เบิก</th>
                    <th className="py-1 px-2 border-r border-black w-24 text-left">ร้านค้าผู้เบิกรับ</th>
                    <th className="py-1 px-2 border-r border-black w-20">รหัสวัตถุดิบ</th>
                    <th className="py-1 px-2 border-r border-black text-left">ชื่อวัตถุดิบ</th>
                    <th className="py-1 px-2 border-r border-black text-right w-20">จำนวนที่เบิก</th>
                    <th className="py-1 px-1 border-r border-black text-center w-14">หน่วย</th>
                    <th className="py-1 px-2 border-r border-black text-right w-24">คลังกลางคงเหลือ</th>
                    <th className="py-1 px-2 text-left">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9px] text-black">
                  {batchReportItems.map((item, idx) => {
                    const qtyOut = Number(item.quantityOut);
                    const balAfter = Number(item.balanceAfter);

                    let stName = item.createdBy?.name || 'ร้านค้า';
                    if (item.note && item.note.includes('เบิกจ่ายให้ร้าน:')) {
                      const m = item.note.match(/เบิกจ่ายให้ร้าน:\s*([^\(@•]+)/);
                      if (m && m[1]) stName = m[1].trim();
                    }

                    return (
                      <tr key={item.id} className="border-b border-black">
                        <td className="py-1 px-1 text-center border-r border-black font-sans">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2 border-r border-black font-bold font-mono">
                          {item.refId || item.transactionNumber}
                        </td>
                        <td className="py-1 px-2 border-r border-black text-center font-sans">
                          {new Date(item.createdAt).toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-1 px-2 border-r border-black font-sans font-medium text-left truncate max-w-[100px]">
                          {stName}
                        </td>
                        <td className="py-1 px-2 border-r border-black font-bold font-mono">
                          {item.ingredient?.code}
                        </td>
                        <td className="py-1 px-2 border-r border-black font-sans font-medium text-left truncate max-w-[130px]">
                          {item.ingredient?.name}
                        </td>
                        <td className="py-1 px-2 border-r border-black text-right font-bold font-mono">
                          {qtyOut.toLocaleString()}
                        </td>
                        <td className="py-1 px-1 text-center font-sans border-r border-black">
                          {item.ingredient?.unit}
                        </td>
                        <td className="py-1 px-2 text-right font-mono font-bold border-r border-black">
                          {balAfter.toLocaleString()}
                        </td>
                        <td className="py-1 px-2 font-sans truncate max-w-[120px]">
                          {item.note || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black bg-white font-bold text-[9.5px] text-black">
                    <td colSpan={6} className="py-1.5 px-2 text-right font-sans border-r border-black">
                      รวมรายการเบิกจ่ายทั้งสิ้น ({batchReportItems.length} รายการ):
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold border-r border-black">
                      {batchReportItems
                        .reduce((sum, it) => sum + Number(it.quantityOut || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td colSpan={3} className="py-1.5 px-2 text-left font-sans text-black">
                      หน่วยนับ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom 3 Signature Blocks */}
            <div className="print-signature-section mt-5 pt-3 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้เบิกสินค้า (เจ้าของร้าน / พนักงานหน้าร้าน)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้จ่ายสินค้า (เจ้าหน้าที่คลังสินค้าส่วนกลาง)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจสอบ / ผู้อนุมัติ (บัญชี / แอดมิน)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

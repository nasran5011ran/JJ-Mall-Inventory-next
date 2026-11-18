'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  ArrowDownToLine,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  X,
  FileText,
  Trash2,
  Printer,
  Store,
  Warehouse,
  AlertCircle,
  Check,
  ChevronRight,
  ChevronDown,
  Package,
  AlertTriangle,
  Info,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  warehouseStock: number;
  storeStock: number | null;
  minStock: number;
  costPerUnit?: number;
}

interface StoreIngredientBalance {
  ingredientId: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  costPerUnit: number;
  warehouseStock: number;
  openingQuantity: number;
  inboundQuantity: number;
  salesQuantity: number;
  expectedStock: number;
  minStock: number;
  hasStockHistory: boolean;
}

interface RequisitionItem {
  id: number;
  ingredientId: number;
  requestedQty: number;
  approvedQty: number | null;
  ingredient: {
    id: number;
    code: string;
    name: string;
    unit: string;
    category?: string | null;
    currentStock?: number;
  };
}

interface RequisitionRecord {
  id: number;
  requisitionNumber: string;
  reason: string | null;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  store: {
    id: number;
    name: string;
    username: string;
  };
  approvedBy: {
    id: number;
    name: string;
    username: string;
  } | null;
  items: RequisitionItem[];
}

export default function StaffStockRequestsPage() {
  const { user } = useAuth();

  // Active Main Tab: 'STORE_STOCK' | 'REQUISITIONS'
  const [activeMainTab, setActiveMainTab] = useState<'STORE_STOCK' | 'REQUISITIONS'>('STORE_STOCK');

  // SWR: Realtime auto-refreshing data
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-requests', {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const requisitions: RequisitionRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.requisitions) ? swrData.requisitions : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const storeBalances: StoreIngredientBalance[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.storeBalances) ? swrData.storeBalances : [];
  }, [swrData]);

  const metrics = swrData?.metrics || {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
    storeLowItemsCount: 0,
  };

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- TAB 1: STORE STOCK FILTERS & STATE ---
  const [stockSearch, setStockSearch] = useState('');
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

      return matchSearch && matchCategory;
    });
  }, [storeBalances, stockSearch, stockCategoryFilter]);

  const paginatedStoreBalances = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStoreBalances.slice(start, start + stockPageSize);
  }, [filteredStoreBalances, stockPage, stockPageSize]);

  // --- TAB 2: REQUISITIONS STATE ---
  const [reqSearch, setReqSearch] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [reqPage, setReqPage] = useState(1);
  const reqPageSize = 10;

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchStatus = reqStatusFilter === 'ALL' || req.status === reqStatusFilter;
      const q = reqSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        req.requisitionNumber.toLowerCase().includes(q) ||
        (req.reason && req.reason.toLowerCase().includes(q)) ||
        req.items.some((it) => it.ingredient.name.toLowerCase().includes(q) || it.ingredient.code.toLowerCase().includes(q));

      return matchStatus && matchSearch;
    });
  }, [requisitions, reqStatusFilter, reqSearch]);

  const paginatedRequisitions = useMemo(() => {
    const start = (reqPage - 1) * reqPageSize;
    return filteredRequisitions.slice(start, start + reqPageSize);
  }, [filteredRequisitions, reqPage, reqPageSize]);

  // --- MODALS STATE ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Request Form State (Admin-style design)
  const [formReason, setFormReason] = useState('ขอเบิกวัตถุดิบเข้าหน้าร้าน');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<
    Array<{ ingredientId: number; requestedQty: string }>
  >([{ ingredientId: 0, requestedQty: '' }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeRowSearchIdx, setActiveRowSearchIdx] = useState<number | null>(null);
  const [rowSearchTexts, setRowSearchTexts] = useState<Record<number, string>>({});

  // Helper to filter ingredients for each row independently (like Admin)
  const getRowFilteredIngredients = (idx: number) => {
    const q = (rowSearchTexts[idx] || '').toLowerCase().trim();
    if (!q) return ingredients;
    return ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(q) ||
        ing.code.toLowerCase().includes(q) ||
        (ing.category && ing.category.toLowerCase().includes(q))
    );
  };

  // Lock body scroll and remove right scrollbar when modal is open
  useEffect(() => {
    if (isCreateModalOpen || isDetailModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCreateModalOpen, isDetailModalOpen]);

  // Open Create Modal (Standard)
  const handleOpenCreateModal = () => {
    setFormReason('ขอเบิกวัตถุดิบเข้าหน้าร้าน');
    setFormNote('');
    setFormItems([{ ingredientId: 0, requestedQty: '' }]);
    setActiveRowSearchIdx(null);
    setRowSearchTexts({});
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Quick Request from Store Stock Row
  const handleQuickRequestItem = (ingId: number) => {
    setFormReason('ขอเบิกวัตถุดิบเติมสต็อก');
    setFormNote('');
    setFormItems([{ ingredientId: ingId, requestedQty: '' }]);
    setActiveRowSearchIdx(null);
    setRowSearchTexts({});
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Form Row Handlers
  const handleAddItemRow = () => {
    setFormItems((prev) => [...prev, { ingredientId: 0, requestedQty: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
    setActiveRowSearchIdx(null);
  };

  // Estimated budget requested
  const totalEstimatedCost = useMemo(() => {
    return formItems.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === Number(item.ingredientId));
      const qty = parseFloat(item.requestedQty) || 0;
      const cost = Number(ing?.costPerUnit || 0);
      return sum + qty * cost;
    }, 0);
  }, [formItems, ingredients]);

  const handleItemChange = (index: number, field: 'ingredientId' | 'requestedQty', value: any) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit Requisition
  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const valid = formItems.filter(
      (it) => it.ingredientId > 0 && !isNaN(parseFloat(it.requestedQty)) && parseFloat(it.requestedQty) > 0
    );

    if (valid.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนที่ต้องการขอเบิกอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/stock-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: formReason,
          note: formNote,
          items: valid,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'เกิดข้อผิดพลาดในการส่งใบขอเบิก');
      }

      showToast(json.message || 'ส่งใบขอเบิกเรียบร้อยแล้ว รอแอดมินอนุมัติ');
      setIsCreateModalOpen(false);
      mutate();
      // Switch to Requisitions Tab so user sees their new request
      setActiveMainTab('REQUISITIONS');
    } catch (err: any) {
      setFormError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Pending Request
  const handleCancelRequisition = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบขอเบิกสต็อกนี้?')) return;
    try {
      const res = await fetch(`/api/stock-requests/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'ยกเลิกไม่สำเร็จ');
      showToast('ยกเลิกใบขอเบิกสต็อกเรียบร้อยแล้ว');
      mutate();
    } catch (e: any) {
      alert(e.message || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="space-y-6 w-full">
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
            <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-700">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">อนุมัติเบิกซื้อวัตถุดิบ</h1>
              <p className="text-xs text-slate-500">
                ตรวจสอบสต็อกในร้าน <strong>{user?.name}</strong> (@{user?.username}) และส่งใบขอเบิกเงินซื้อวัตถุดิบ (รอแอดมินอนุมัติ)
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
            onClick={handleOpenCreateModal}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-sky-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ สร้างใบขอเบิกซื้อใหม่</span>
          </button>
        </div>
      </div>

      {/* 2 Main Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-fit">
        <button
          onClick={() => setActiveMainTab('STORE_STOCK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'STORE_STOCK'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 text-sky-600" />
          <span>สต็อกคงเหลือในร้านของคุณ</span>
        </button>

        <button
          onClick={() => setActiveMainTab('REQUISITIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'REQUISITIONS'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>ประวัติใบขอเบิกสต็อก</span>
          {metrics.pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-2xs">
              {metrics.pendingCount} รออนุมัติ
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STORE STOCK VIEW */}
      {/* ========================================================================= */}
      {activeMainTab === 'STORE_STOCK' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Summary KPI Cards for Store Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">วัตถุดิบทั้งหมดในร้าน</span>
                <Layers className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {storeBalances.length} <span className="text-xs font-semibold text-slate-500">รายการ</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ใบขอเบิกทั้งหมด</span>
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {metrics.totalCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
              </div>
            </div>

            <div className="p-4 rounded-3xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">รอแอดมินอนุมัติ</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {metrics.pendingCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
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
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={stockCategoryFilter}
                onChange={(e) => {
                  setStockCategoryFilter(e.target.value);
                  setStockPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
              >
                <option value="ALL">📁 ทุกหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
                <p className="text-[11px] text-slate-400">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองหมวดหมู่</p>
              </div>
            ) : (
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full text-left text-xs table-auto">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-2 text-center w-8 text-slate-400">#</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="py-2.5 px-3 min-w-[130px]">ชื่อวัตถุดิบ</th>
                      <th className="py-2.5 px-2">หมวดหมู่</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">ยอดยกมา</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">รับเข้า (+)</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">ขาย POS (-)</th>
                      <th className="py-2.5 px-2.5 text-right font-black text-slate-900 bg-slate-50/60 whitespace-nowrap">คงเหลือในร้าน</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">หน่วยนับ</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedStoreBalances.map((item, idx) => {
                      const rowNumber = (stockPage - 1) * stockPageSize + idx + 1;

                      return (
                        <tr
                          key={item.ingredientId}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px] font-bold">
                            {rowNumber}
                          </td>
                          <td className="py-2 px-2 font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900 text-xs">
                            {item.name}
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {item.category || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600 text-xs whitespace-nowrap">
                            {Number(item.openingQuantity).toLocaleString()}{' '}
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-700 font-bold text-xs whitespace-nowrap">
                            {Number(item.inboundQuantity) > 0 ? `+${Number(item.inboundQuantity).toLocaleString()}` : '0'}{' '}
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-red-700 font-bold text-xs whitespace-nowrap">
                            {Number(item.salesQuantity) > 0 ? `-${Number(item.salesQuantity).toLocaleString()}` : '0'}{' '}
                            <span className="text-[10px] text-slate-400">{item.unit}</span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-sm bg-slate-50/60 text-slate-900 whitespace-nowrap">
                            {Number(item.expectedStock).toLocaleString()}{' '}
                            <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                          </td>
                          <td className="py-2 px-2 text-center text-slate-600 font-sans text-xs whitespace-nowrap">
                            {item.unit}
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleQuickRequestItem(item.ingredientId)}
                              className="px-2.5 py-1 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 shadow-2xs cursor-pointer mx-auto"
                              title={`ขอเบิก ${item.name}`}
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                              <span>+ ขอเบิก</span>
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
      {/* TAB 2: REQUISITION SLIPS HISTORY */}
      {/* ========================================================================= */}
      {activeMainTab === 'REQUISITIONS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 Summary KPI Cards for Requests */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div
              onClick={() => {
                setReqStatusFilter('ALL');
                setReqPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                reqStatusFilter === 'ALL'
                  ? 'border-sky-500 ring-2 ring-sky-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ใบขอเบิกทั้งหมด</span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {metrics.totalCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
              </div>
            </div>

            <div
              onClick={() => {
                setReqStatusFilter('PENDING');
                setReqPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                reqStatusFilter === 'PENDING'
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">รอแอดมินอนุมัติ</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {metrics.pendingCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
              </div>
            </div>

            <div
              onClick={() => {
                setReqStatusFilter('APPROVED');
                setReqPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                reqStatusFilter === 'APPROVED'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">อนุมัติแล้ว (โอนของแล้ว)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {metrics.approvedCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
              </div>
            </div>

            <div
              onClick={() => {
                setReqStatusFilter('REJECTED');
                setReqPage(1);
              }}
              className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
                reqStatusFilter === 'REJECTED'
                  ? 'border-rose-500 ring-2 ring-rose-500/20'
                  : 'border-slate-200 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">ไม่อนุมัติ</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {metrics.rejectedCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่ใบขอเบิก, ชื่อวัตถุดิบ..."
                value={reqSearch}
                onChange={(e) => {
                  setReqSearch(e.target.value);
                  setReqPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
                const labels = {
                  ALL: 'ทั้งหมด',
                  PENDING: 'รออนุมัติ',
                  APPROVED: 'อนุมัติแล้ว',
                  REJECTED: 'ไม่อนุมัติ',
                };
                return (
                  <button
                    key={st}
                    onClick={() => {
                      setReqStatusFilter(st);
                      setReqPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      reqStatusFilter === st
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

          {/* Requisitions Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            {isLoading && requisitions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">กำลังโหลดข้อมูลประวัติใบขอเบิก...</div>
            ) : paginatedRequisitions.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">ไม่พบรายการใบขอเบิกสต็อก</p>
                <p className="text-[11px] text-slate-400">คุณสามารถกดปุ่ม "+ สร้างใบขอเบิกใหม่" เพื่อส่งคำขอเบิกของเข้าหน้าร้านได้ทันที</p>
              </div>
            ) : (
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                      <th className="py-3 px-4">เลขที่ใบขอเบิก</th>
                      <th className="py-3 px-3">วันที่ขอเบิก</th>
                      <th className="py-3 px-3">เหตุผล / วัตถุประสงค์</th>
                      <th className="py-3 px-3 text-center">รายการที่ขอ</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3">ผู้อนุมัติ</th>
                      <th className="py-3 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedRequisitions.map((req, idx) => {
                      const rowNumber = (reqPage - 1) * reqPageSize + idx + 1;
                      return (
                        <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-4">
                          <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100">
                            {req.requisitionNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {new Date(req.createdAt).toLocaleString('th-TH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })} น.
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{req.reason || 'ขอเบิกวัตถุดิบ'}</div>
                          {req.note && <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{req.note}</div>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-700">{req.items.length}</span>{' '}
                          <span className="text-[11px] text-slate-400">รายการ</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {req.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              รออนุมัติ
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              อนุมัติแล้ว
                            </span>
                          )}
                          {req.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              ไม่อนุมัติ
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {req.approvedBy ? (
                            <div>
                              <div className="font-bold text-slate-800">{req.approvedBy.name}</div>
                              {req.approvedAt && (
                                <div className="text-[10px] text-slate-400">
                                  {new Date(req.approvedAt).toLocaleDateString('th-TH')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedRequisition(req);
                                setIsDetailModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              ดูรายละเอียด
                            </button>

                            {req.status === 'PENDING' && (
                              <button
                                onClick={() => handleCancelRequisition(req.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                                title="ยกเลิกคำขอเบิกนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {filteredRequisitions.length > reqPageSize && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  แสดงหน้า {reqPage} จาก {Math.ceil(filteredRequisitions.length / reqPageSize)}
                </span>
                <Pagination
                  currentPage={reqPage}
                  totalItems={filteredRequisitions.length}
                  pageSize={reqPageSize}
                  onPageChange={setReqPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE MODAL: Create New Stock Request (Designed exactly like Admin) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl lg:max-w-5xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">📥 ขอเบิกซื้อวัตถุดิบเข้าหน้าร้าน</h3>
                  <p className="text-xs text-slate-500">
                    ขอเบิกเงินซื้อวัตถุดิบเข้าสู่ร้าน <strong>{user?.name}</strong> (รอแอดมินอนุมัติ)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRequisition} className="mt-2.5 flex flex-col">
              {/* Top Compact Settings: Reason & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 shrink-0 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-sky-950 mb-1">
                    เหตุผล / วัตถุประสงค์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="เช่น ขอเบิกซื้อวัตถุดิบเติมสต็อกประจำวัน"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-sky-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-sky-950 mb-1">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="ระบุเพิ่มเติม เช่น ขอด่วนก่อนเที่ยง, ซื้อที่แม็คโคร"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-sky-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {/* Items List Section Header */}
              <div className="flex items-center justify-between pb-1.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    รายการวัตถุดิบ ({formItems.length})
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    (ค้นหาแยกอิสระต่อกันแต่ละแถว)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center gap-1 cursor-pointer border border-sky-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มแถว</span>
                </button>
              </div>

              {/* Desktop Column Header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 text-[11px] font-bold text-slate-500 bg-slate-100/90 rounded-xl shrink-0 mb-1.5">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-6">วัตถุดิบ (คลิกเพื่อค้นหาและเลือก)</div>
                <div className="col-span-3 text-right">จำนวนที่ขอเบิก</div>
                <div className="col-span-2 text-right">ต้นทุนประมาณ (฿)</div>
              </div>

              {/* Backdrop Overlay when row search popover is open */}
              {activeRowSearchIdx !== null && (
                <div
                  className="fixed inset-0 z-[55] bg-transparent"
                  onClick={() => setActiveRowSearchIdx(null)}
                />
              )}

              {/* Scrollable Items Container (Exact Admin Design) */}
              <div className="space-y-2">
                {formItems.map((item, idx) => {
                  const selectedIng = ingredients.find((i) => i.id === Number(item.ingredientId));
                  const storeBal = storeBalances.find((b) => b.ingredientId === Number(item.ingredientId));
                  const storeStock = storeBal ? Number(storeBal.expectedStock) : Number(selectedIng?.storeStock || 0);
                  const reqQty = parseFloat(item.requestedQty) || 0;
                  const newBalance = storeStock + reqQty;
                  const isSearchingThisRow = activeRowSearchIdx === idx;
                  const filteredRowIngs = getRowFilteredIngredients(idx);
                  const rowCost = reqQty * Number(selectedIng?.costPerUnit || 0);

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 sm:p-3 rounded-2xl bg-slate-50 border text-xs space-y-1.5 transition-all ${
                        isSearchingThisRow
                          ? 'border-sky-400 ring-2 ring-sky-500/20 shadow-md relative z-[60] bg-white'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-2 min-w-0">
                        {/* Sequence number */}
                        <div className="hidden sm:flex w-6 h-6 rounded-lg bg-slate-200/80 text-slate-700 font-mono font-bold text-xs items-center justify-center shrink-0">
                          {idx + 1}
                        </div>

                        {/* Searchable Combobox Button/Input */}
                        <div className="flex-1 w-full min-w-0 relative">
                          {isSearchingThisRow ? (
                            <div className="relative">
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="พิมพ์ค้นหาชื่อ หรือรหัสแถวนี้..."
                                  value={rowSearchTexts[idx] || ''}
                                  onChange={(e) =>
                                    setRowSearchTexts((prev) => ({ ...prev, [idx]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setActiveRowSearchIdx(null);
                                  }}
                                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border-2 border-sky-500 bg-white font-medium focus:outline-none shadow-sm placeholder:text-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => setActiveRowSearchIdx(null)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  title="ปิดการค้นหา"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Search Dropdown Popover */}
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] max-h-56 overflow-y-auto divide-y divide-slate-100">
                                {filteredRowIngs.length === 0 ? (
                                  <div className="p-3.5 text-center text-xs text-slate-400">
                                    ไม่พบวัตถุดิบที่ตรงกับ &ldquo;{rowSearchTexts[idx]}&rdquo;
                                  </div>
                                ) : (
                                  filteredRowIngs.map((ing) => {
                                    const ingBal = storeBalances.find((b) => b.ingredientId === ing.id);
                                    const inStoreStock = ingBal ? Number(ingBal.expectedStock) : Number(ing.storeStock || 0);

                                    return (
                                      <button
                                        key={ing.id}
                                        type="button"
                                        onClick={() => {
                                          handleItemChange(idx, 'ingredientId', ing.id);
                                          setActiveRowSearchIdx(null);
                                          setRowSearchTexts((prev) => ({ ...prev, [idx]: '' }));
                                        }}
                                        className={`w-full text-left p-2.5 hover:bg-sky-50 transition-colors flex items-center justify-between gap-2 group cursor-pointer ${
                                          ing.id === Number(item.ingredientId) ? 'bg-sky-50/70 font-bold' : ''
                                        }`}
                                      >
                                        <div className="min-w-0">
                                          <div className="font-bold text-xs text-slate-800 group-hover:text-sky-700 flex items-center gap-1.5 truncate">
                                            <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 shrink-0" />
                                            <span className="truncate">{ing.name}</span>
                                            <span className="font-mono text-[10px] text-slate-400 shrink-0">({ing.code})</span>
                                          </div>
                                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                            หมวด: {ing.category || 'ทั่วไป'} • ต้นทุน ฿{Number(ing.costPerUnit || 0).toFixed(2)}/{ing.unit}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-800">
                                            ในร้านเหลือ: {Number(inStoreStock).toLocaleString()} {ing.unit}
                                          </span>
                                          <div className="text-[10px] text-sky-600 font-bold mt-0.5">+ เลือกแถวนี้</div>
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowSearchIdx(idx);
                                setRowSearchTexts((prev) => ({ ...prev, [idx]: '' }));
                              }}
                              className={`w-full px-2.5 py-1.5 text-xs rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                selectedIng
                                  ? 'bg-white border-slate-300 text-slate-800 hover:border-sky-500 hover:shadow-xs'
                                  : 'bg-amber-50/80 border-amber-300 text-amber-800 hover:bg-amber-100/70'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate min-w-0">
                                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {selectedIng ? (
                                  <span className="font-bold text-slate-800 truncate">
                                    {selectedIng.name}{' '}
                                    <span className="font-mono font-normal text-slate-400 text-[10px]">({selectedIng.code})</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-800 font-semibold truncate">🔍 คลิกเพื่อค้นหาวัตถุดิบแถวนี้...</span>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5">
                                {selectedIng && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium hidden md:inline-block">
                                    เหลือ: {Number(storeStock).toLocaleString()} {selectedIng.unit}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                                  ค้นหา/เปลี่ยน
                                </span>
                              </div>
                            </button>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="w-full sm:w-36 flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            required
                            placeholder="จำนวน"
                            value={item.requestedQty}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => handleItemChange(idx, 'requestedQty', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono text-right focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[11px] text-slate-500 font-mono w-10 truncate text-right">
                            {selectedIng?.unit || 'หน่วย'}
                          </span>
                        </div>

                        {/* Estimated Cost Preview per row */}
                        <div className="hidden sm:block w-24 text-right font-mono font-bold text-slate-700 shrink-0 px-1">
                          ฿{rowCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        {/* Delete Row Button */}
                        <div className="w-full sm:w-8 flex justify-end shrink-0">
                          {formItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              title="ลบแถวนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Real-time Store Stock Calculation Preview */}
                      {selectedIng && (
                        <div className="pt-1.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                          <div className="flex flex-wrap items-center gap-1 text-slate-500">
                            <span>คงเหลือเดิมในร้าน:</span>
                            <span className="font-mono font-bold text-slate-700">
                              {Number(storeStock).toLocaleString()} {selectedIng.unit}
                            </span>
                            {reqQty > 0 && (
                              <>
                                <span className="text-sky-600 font-black">+</span>
                                <span>ขอเบิก:</span>
                                <span className="font-mono font-bold text-sky-700">
                                  {reqQty.toLocaleString()} {selectedIng.unit}
                                </span>
                              </>
                            )}
                          </div>

                          {reqQty > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-sky-600 font-semibold">ยอดคงเหลือใหม่:</span>
                              <span className="font-mono font-black text-xs text-sky-700">
                                {newBalance.toLocaleString()} {selectedIng.unit}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Estimated Cost */}
              <div className="mt-3 p-3 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-sky-900">ยอดเงินประมาณการที่ขอเบิกซื้อ:</span>
                <span className="font-mono font-black text-base text-sky-800">
                  ฿{totalEstimatedCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Modal Actions */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่งคำขอ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>ส่งใบขอเบิกซื้อวัตถุดิบ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono font-bold text-sky-700 text-xs bg-sky-50 px-2 py-0.5 rounded-md">
                  {selectedRequisition.requisitionNumber}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">รายละเอียดใบขอเบิกสต็อก</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-semibold">ร้านค้าที่ขอเบิก:</span>
                <p className="font-bold text-slate-800">{selectedRequisition.store.name}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">วันที่ส่งคำขอ:</span>
                <p className="font-bold text-slate-800">
                  {new Date(selectedRequisition.createdAt).toLocaleString('th-TH')}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">วัตถุประสงค์:</span>
                <p className="font-bold text-slate-800">{selectedRequisition.reason || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">สถานะคำขอ:</span>
                <div className="mt-0.5">
                  {selectedRequisition.status === 'PENDING' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      รอแอดมินอนุมัติ
                    </span>
                  )}
                  {selectedRequisition.status === 'APPROVED' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      อนุมัติและโอนของแล้ว
                    </span>
                  )}
                  {selectedRequisition.status === 'REJECTED' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      ไม่อนุมัติ
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedRequisition.rejectReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
                <span className="font-bold">เหตุผลที่ไม่อนุมัติ:</span> {selectedRequisition.rejectReason}
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">รายการวัตถุดิบ ({selectedRequisition.items.length} รายการ)</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10 text-slate-400">#</th>
                      <th className="py-2.5 px-3">รหัส/ชื่อวัตถุดิบ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่ขอ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่อนุมัติ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequisition.items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800">{item.ingredient.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 ml-1.5">({item.ingredient.code})</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {Number(item.requestedQty).toLocaleString()} {item.ingredient.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {item.approvedQty !== null ? (
                            <span className="text-emerald-700">
                              {Number(item.approvedQty).toLocaleString()} {item.ingredient.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
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

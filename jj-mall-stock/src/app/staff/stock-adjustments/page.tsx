'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  FileEdit,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  Calendar,
  X,
  FileText,
  User,
  ShieldCheck,
  Check,
  Trash2,
  Printer,
  Store,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  currentStock: number;
  costPerUnit: number;
}

interface AdjustmentItem {
  id: number;
  adjustmentId: number;
  ingredientId: number;
  systemQuantity: number;
  actualQuantity: number;
  diffQuantity: number;
  ingredient: {
    id: number;
    code: string;
    name: string;
    unit: string;
    category: string | null;
    costPerUnit: number;
    currentStock?: number;
  };
}

interface AdjustmentRecord {
  id: number;
  adjustmentNumber: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  requestedBy: {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  approvedBy: {
    id: number;
    name: string;
    username: string;
    role: string;
  } | null;
  items: AdjustmentItem[];
}

interface NewItemForm {
  ingredientId: string;
  inputMode: 'ACTUAL' | 'WASTE'; // ACTUAL = ระบุยอดจริงที่เหลือ, WASTE = ระบุจำนวนที่เสียหาย/หักออก
  inputValue: string;
}

const PRESET_REASONS = [
  'วัตถุดิบเสียหาย / หก / บรรจุภัณฑ์แตกชำรุด',
  'วัตถุดิบหมดอายุ / เสื่อมสภาพ',
  'ผลต่างจากการตรวจนับสต็อกหน้าร้าน',
  'วัตถุดิบผิดสเปก / ส่งคืนคลัง',
  'อื่นๆ (ระบุเหตุผลเอง)',
];

export default function StaffStockAdjustmentsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [search, setSearch] = useState('');

  // Fetch adjustments and active ingredients via SWR
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-adjustments');

  const adjustments: AdjustmentRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.adjustments) ? swrData.adjustments : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const metrics = swrData?.metrics || {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
  };

  const loading = isLoading && adjustments.length === 0;

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<AdjustmentRecord | null>(null);
  const [printVoucherOpen, setPrintVoucherOpen] = useState(false);

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formPresetReason, setFormPresetReason] = useState(PRESET_REASONS[0]);
  const [formCustomReason, setFormCustomReason] = useState('');
  const [formItems, setFormItems] = useState<NewItemForm[]>([
    { ingredientId: '', inputMode: 'WASTE', inputValue: '1' },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to open create modal
  const openCreateModal = () => {
    const firstIng = ingredients[0];
    setFormPresetReason(PRESET_REASONS[0]);
    setFormCustomReason('');
    setFormItems([
      {
        ingredientId: firstIng ? String(firstIng.id) : '',
        inputMode: 'WASTE',
        inputValue: '1',
      },
    ]);
    setFormError(null);
    setCreateModalOpen(true);
  };

  // Add Item Row
  const handleAddItemRow = () => {
    const firstIng = ingredients[0];
    setFormItems((prev) => [
      ...prev,
      {
        ingredientId: firstIng ? String(firstIng.id) : '',
        inputMode: 'WASTE',
        inputValue: '1',
      },
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Update Item Row
  const handleItemChange = (idx: number, field: keyof NewItemForm, value: string) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Calculate actual quantity to send to API based on input mode
  const resolveActualQuantity = (item: NewItemForm): { actualQty: number; diff: number; sysQty: number } => {
    const ing = ingredients.find((i) => i.id === Number(item.ingredientId));
    const sysQty = ing ? Number(ing.currentStock) : 0;
    const val = parseFloat(item.inputValue);

    if (isNaN(val)) return { actualQty: sysQty, diff: 0, sysQty };

    if (item.inputMode === 'WASTE') {
      // Waste Mode: actualQty = max(0, sysQty - val)
      const waste = Math.max(0, val);
      const actualQty = Math.max(0, sysQty - waste);
      return { actualQty, diff: actualQty - sysQty, sysQty };
    } else {
      // Actual Stock Mode: val is actual quantity
      const actualQty = Math.max(0, val);
      return { actualQty, diff: actualQty - sysQty, sysQty };
    }
  };

  // Submit Request
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Final reason
    const finalReason =
      formPresetReason === 'อื่นๆ (ระบุเหตุผลเอง)'
        ? formCustomReason.trim()
        : formCustomReason.trim()
        ? `${formPresetReason}: ${formCustomReason.trim()}`
        : formPresetReason;

    if (!finalReason) {
      setFormError('กรุณาระบุเหตุผลในการขอปรับสต็อก');
      return;
    }

    const payloadItems = formItems
      .filter((item) => item.ingredientId && item.inputValue !== '' && !isNaN(parseFloat(item.inputValue)))
      .map((item) => {
        const { actualQty } = resolveActualQuantity(item);
        return {
          ingredientId: Number(item.ingredientId),
          actualQuantity: actualQty,
        };
      });

    if (payloadItems.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: finalReason,
          autoApprove: false, // Staff must be approved by Admin
          items: payloadItems,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'เกิดข้อผิดพลาดในการส่งคำขอ');
      }

      showToast(`ส่งใบขอปรับสต็อก #${data.adjustment.adjustmentNumber} เรียบร้อยแล้ว (รอ Admin อนุมัติ)`);
      setCreateModalOpen(false);
      mutate();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      // Tab filter
      if (activeTab !== 'ALL' && adj.status !== activeTab) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNumber = adj.adjustmentNumber.toLowerCase().includes(q);
        const matchReason = adj.reason.toLowerCase().includes(q);
        const matchItems = adj.items.some(
          (it) =>
            it.ingredient.name.toLowerCase().includes(q) ||
            it.ingredient.code.toLowerCase().includes(q)
        );
        return matchNumber || matchReason || matchItems;
      }

      return true;
    });
  }, [adjustments, activeTab, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  const paginatedAdjustments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAdjustments.slice(start, start + pageSize);
  }, [filteredAdjustments, currentPage, pageSize]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Top Banner / Store Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-sky-200">
              <Store className="w-3.5 h-3.5 text-sky-600" />
              สาขา: {user?.name || 'พนักงานหน้าร้าน'}
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-medium border border-amber-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              ต้องผ่านการอนุมัติจาก Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5 mt-2">
            <FileEdit className="w-7 h-7 text-sky-600" />
            สร้างใบขอปรับสต็อก / แจ้งของเสีย
          </h1>
          <p className="text-sm text-slate-600">
            ยื่นคำขอปรับสต็อก กรณีสินค้าชำรุด ขวดแตก นมหก หรือหมดอายุ เพื่อส่งให้ Admin พิจารณาอนุมัติ
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-5 h-5 ${isValidating ? 'animate-spin text-sky-600' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-sm active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            สร้างใบขอปรับสต็อกใหม่
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">คำขอทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.totalCount}</p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">รอ Admin อนุมัติ</p>
            <p className="text-2xl font-bold text-amber-900">{metrics.pendingCount}</p>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">อนุมัติแล้ว</p>
            <p className="text-2xl font-bold text-emerald-900">{metrics.approvedCount}</p>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">ไม่อนุมัติ / ปฏิเสธ</p>
            <p className="text-2xl font-bold text-rose-900">{metrics.rejectedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด ({metrics.totalCount})
          </button>
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'PENDING'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-100/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            รอการอนุมัติ ({metrics.pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-100/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            อนุมัติแล้ว ({metrics.approvedCount})
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 hover:bg-rose-100/60'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            ไม่อนุมัติ ({metrics.rejectedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่เอกสาร, เหตุผล, วัตถุดิบ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-600" />
            <p className="text-sm">กำลังโหลดข้อมูลคำขอปรับสต็อก...</p>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FileEdit className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-base font-semibold text-slate-700">ไม่พบรายการใบขอปรับสต็อก</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search
                ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองตรวจสอบคำค้นหาอีกครั้ง'
                : 'ยังไม่มีประวัติการขอปรับสต็อก สามารถกดปุ่ม "สร้างใบขอปรับสต็อกใหม่" ด้านบนเพื่อเริ่มยื่นคำขอ'}
            </p>
            {!search && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all mt-2"
              >
                <Plus className="w-4 h-4" />
                สร้างใบขอปรับสต็อกแรก
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">เลขที่เอกสาร</th>
                  <th className="py-3.5 px-4">วันเวลาที่ยื่น</th>
                  <th className="py-3.5 px-4">เหตุผลในการขอปรับ</th>
                  <th className="py-3.5 px-4">รายการวัตถุดิบ</th>
                  <th className="py-3.5 px-4 text-center">สถานะ</th>
                  <th className="py-3.5 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {paginatedAdjustments.map((adj) => {
                  const isPending = adj.status === 'PENDING';
                  const isApproved = adj.status === 'APPROVED';
                  const isRejected = adj.status === 'REJECTED';

                  const netDiffQty = adj.items.reduce((acc, it) => acc + Number(it.diffQuantity), 0);

                  return (
                    <tr
                      key={adj.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedAdjustment(adj)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-sky-600 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          #{adj.adjustmentNumber}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(adj.createdAt).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="max-w-xs sm:max-w-md truncate font-medium text-slate-800">
                          {adj.reason}
                        </div>
                        {isRejected && adj.rejectReason && (
                          <div className="text-[11px] text-rose-600 font-medium truncate mt-0.5">
                            เหตุผลที่ไม่อนุมัติ: {adj.rejectReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-200">
                            {adj.items.length} รายการ
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                              netDiffQty < 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : netDiffQty > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {netDiffQty < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : netDiffQty > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : null}
                            {netDiffQty > 0 ? `+${netDiffQty}` : netDiffQty}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            รอ Admin อนุมัติ
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            อนุมัติแล้ว
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            ไม่อนุมัติ
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedAdjustment(adj)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-sky-50 hover:text-sky-600 text-slate-700 rounded-lg text-xs font-medium transition-all"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-sky-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">สร้างใบขอปรับสต็อก / แจ้งของเสีย</h2>
                  <p className="text-xs text-slate-500">
                    สาขา: <span className="font-semibold text-slate-700">{user?.name}</span> (ส่งให้ Admin พิจารณาอนุมัติ)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitCreate} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Error Alert */}
              {formError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="font-medium">{formError}</p>
                </div>
              )}

              {/* Preset Reason Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  เหตุผลในการขอปรับสต็อก / ตัดของเสีย <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setFormPresetReason(reason)}
                      className={`text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                        formPresetReason === reason
                          ? 'border-sky-500 bg-sky-50/70 text-sky-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{reason}</span>
                      {formPresetReason === reason && <Check className="w-4 h-4 text-sky-600 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>

                {/* Additional / Custom Detail */}
                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="ระบุรายละเอียดเพิ่มเติม (เช่น แก้วชาไทยหก 2 แก้ว, ขวดไซรัปแตกตอนจัดร้าน, นมหมดอายุวันที่...)"
                    value={formCustomReason}
                    onChange={(e) => setFormCustomReason(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" />
                    รายการวัตถุดิบที่ขอปรับ ({formItems.length} รายการ)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มวัตถุดิบ
                  </button>
                </div>

                <div className="space-y-3">
                  {formItems.map((item, idx) => {
                    const selectedIng = ingredients.find((i) => i.id === Number(item.ingredientId));
                    const sysStock = selectedIng ? Number(selectedIng.currentStock) : 0;
                    const { actualQty, diff } = resolveActualQuantity(item);

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-3 hover:border-sky-200 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500">ลำดับที่ {idx + 1}</span>
                          <div className="flex items-center gap-1.5">
                            {/* Mode Toggle Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleItemChange(
                                  idx,
                                  'inputMode',
                                  item.inputMode === 'WASTE' ? 'ACTUAL' : 'WASTE'
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                item.inputMode === 'WASTE'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-sky-50 border-sky-200 text-sky-700'
                              }`}
                            >
                              โหมด: {item.inputMode === 'WASTE' ? '🔥 หักของเสีย/ชำรุด' : '⚖️ ระบุสต็อกคงเหลือจริง'}
                            </button>

                            {formItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          {/* Ingredient Select */}
                          <div className="sm:col-span-6">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              เลือกวัตถุดิบ
                            </label>
                            <select
                              value={item.ingredientId}
                              onChange={(e) => handleItemChange(idx, 'ingredientId', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="" disabled>
                                -- กรุณาเลือกวัตถุดิบ --
                              </option>
                              {ingredients.map((ing) => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name} ({ing.code}) [{ing.unit}]
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Current System Stock */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              สต็อกเดิม
                            </label>
                            <div className="px-3 py-2 bg-slate-200/70 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 text-center">
                              {sysStock} {selectedIng?.unit || ''}
                            </div>
                          </div>

                          {/* Input Value */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              {item.inputMode === 'WASTE' ? 'จำนวนที่เสีย' : 'ยอดนับจริง'}
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.inputValue}
                              onChange={(e) => handleItemChange(idx, 'inputValue', e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>

                          {/* Calculated Diff */}
                          <div className="sm:col-span-2 text-center">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              ผลต่างสต็อก
                            </label>
                            <div
                              className={`px-2 py-2 rounded-xl text-xs font-bold ${
                                diff < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : diff > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff} {selectedIng?.unit || ''}
                            </div>
                          </div>
                        </div>

                        {/* Calculated Target Preview */}
                        {selectedIng && (
                          <div className="text-[11px] text-slate-500 flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                            <span>
                              สต็อกปัจจุบัน: <strong className="text-slate-700">{sysStock}</strong> → ยอดใหม่หลังอนุมัติ:{' '}
                              <strong className="text-sky-700">{actualQty}</strong> {selectedIng.unit}
                            </span>
                            <span className="font-medium text-slate-600">
                              มูลค่ากระทบ: {(diff * Number(selectedIng.costPerUnit || 0)).toLocaleString()} ฿
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Approval Notice Banner */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-bold">ขั้นตอนการอนุมัติ:</p>
                  <p>
                    เมื่อกดยื่นคำขอ เอกสารจะถูกส่งไปที่ <strong>Admin</strong> เพื่อตรวจสอบและอนุมัติ โดยสต็อกของระบบจะยังไม่ถูกตัดจนกว่าผู้ดูแลระบบจะกดอนุมัติเรียบร้อยแล้ว
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังส่งคำขอ...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      ส่งใบขอปรับสต็อก
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-200">
                    #{selectedAdjustment.adjustmentNumber}
                  </span>
                  {selectedAdjustment.status === 'PENDING' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      รอการอนุมัติ (Pending)
                    </span>
                  )}
                  {selectedAdjustment.status === 'APPROVED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      อนุมัติแล้ว (Approved)
                    </span>
                  )}
                  {selectedAdjustment.status === 'REJECTED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      ไม่อนุมัติ (Rejected)
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900">รายละเอียดใบขอปรับสต็อก</h2>
              </div>
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Reject Banner */}
              {selectedAdjustment.status === 'REJECTED' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-rose-900">
                    <p className="font-bold">ใบขอนี้ถูกปฏิเสธโดยผู้ดูแลระบบ</p>
                    <p className="mt-0.5">เหตุผล: {selectedAdjustment.rejectReason || 'ไม่ได้ระบุเหตุผล'}</p>
                  </div>
                </div>
              )}

              {/* Meta Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <p className="text-slate-500 font-medium">ผู้ยื่นคำขอ (สาขา)</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedAdjustment.requestedBy?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">วันที่ยื่น</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {new Date(selectedAdjustment.createdAt).toLocaleString('th-TH')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">ผู้อนุมัติ</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selectedAdjustment.approvedBy?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">วันเวลาที่อนุมัติ</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selectedAdjustment.approvedAt
                      ? new Date(selectedAdjustment.approvedAt).toLocaleString('th-TH')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  เหตุผลในการขอปรับปรุง / บันทึก
                </label>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800">
                  {selectedAdjustment.reason}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  รายการวัตถุดิบ ({selectedAdjustment.items.length} รายการ)
                </label>
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                        <th className="py-2.5 px-3">รหัส/ชื่อวัตถุดิบ</th>
                        <th className="py-2.5 px-3 text-right">ยอดในระบบ</th>
                        <th className="py-2.5 px-3 text-right">ยอดขอปรับ</th>
                        <th className="py-2.5 px-3 text-right">ผลต่าง</th>
                        <th className="py-2.5 px-3 text-right">หน่วย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedAdjustment.items.map((item) => {
                        const diff = Number(item.diffQuantity);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">{item.ingredient.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{item.ingredient.code}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                              {Number(item.systemQuantity)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                              {Number(item.actualQuantity)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold font-mono">
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs ${
                                  diff < 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : diff > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 font-medium">
                              {item.ingredient.unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setPrintVoucherOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                พิมพ์ใบขอปรับสต็อก
              </button>

              <button
                onClick={() => setSelectedAdjustment(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT VOUCHER MODAL */}
      {printVoucherOpen && selectedAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 border border-slate-200 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">พิมพ์เอกสารขอปรับสต็อก / แจ้งของเสีย</h3>
                <p className="text-xs text-slate-500">เอกสารสำหรับตรวจสอบและเก็บบันทึก</p>
              </div>
              <button
                onClick={() => setPrintVoucherOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Content */}
            <div id="printable-voucher" className="p-6 border border-slate-300 rounded-xl space-y-4 text-xs font-sans">
              <div className="text-center pb-4 border-b space-y-1">
                <h2 className="text-lg font-bold text-slate-900">ใบขอปรับปรุงสต็อก / แจ้งของเสีย (Stock Adjustment)</h2>
                <p className="text-xs text-slate-600">JJ MALL INVENTORY MANAGEMENT</p>
                <p className="text-[11px] font-mono text-slate-500">เลขที่เอกสาร: #{selectedAdjustment.adjustmentNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <strong>สาขา/ผู้ยื่น:</strong> {selectedAdjustment.requestedBy?.name}
                </div>
                <div>
                  <strong>วันที่ยื่น:</strong> {new Date(selectedAdjustment.createdAt).toLocaleString('th-TH')}
                </div>
                <div>
                  <strong>สถานะ:</strong> {selectedAdjustment.status}
                </div>
                <div>
                  <strong>ผู้อนุมัติ:</strong> {selectedAdjustment.approvedBy?.name || 'รอการอนุมัติ'}
                </div>
              </div>

              <div className="border-t pt-2">
                <strong>เหตุผล:</strong> {selectedAdjustment.reason}
              </div>

              <table className="w-full border-collapse border border-slate-300 text-left mt-2">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[11px]">
                    <th className="p-2 border-r border-slate-300">รหัส</th>
                    <th className="p-2 border-r border-slate-300">วัตถุดิบ</th>
                    <th className="p-2 border-r border-slate-300 text-right">ยอดในระบบ</th>
                    <th className="p-2 border-r border-slate-300 text-right">ยอดขอปรับ</th>
                    <th className="p-2 border-r border-slate-300 text-right">ผลต่าง</th>
                    <th className="p-2 text-right">หน่วย</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAdjustment.items.map((it) => (
                    <tr key={it.id} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 font-mono">{it.ingredient.code}</td>
                      <td className="p-2 border-r border-slate-200 font-semibold">{it.ingredient.name}</td>
                      <td className="p-2 border-r border-slate-200 text-right">{Number(it.systemQuantity)}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-bold">{Number(it.actualQuantity)}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-bold">
                        {Number(it.diffQuantity) > 0 ? `+${it.diffQuantity}` : it.diffQuantity}
                      </td>
                      <td className="p-2 text-right text-slate-600">{it.ingredient.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-8"></div>
                  <p className="mt-2 text-slate-700">ลงชื่อผู้ยื่นคำขอ (พนักงานสาขา)</p>
                  <p className="text-[10px] text-slate-400">วันที่: ......./......./...........</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-8"></div>
                  <p className="mt-2 text-slate-700">ลงชื่อผู้อนุมัติ (ผู้ดูแลระบบ/Admin)</p>
                  <p className="text-[10px] text-slate-400">วันที่: ......./......./...........</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPrintVoucherOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                ปิด
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                <Printer className="w-4 h-4" />
                สั่งพิมพ์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
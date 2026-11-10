'use client';

import React, { useState, useMemo } from 'react';
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
  Sparkles,
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
  actualQuantity: string;
}

export default function AdminStockAdjustmentsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [search, setSearch] = useState('');

  // Instant SWR Cache
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

  // New Adjustment Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formReason, setFormReason] = useState('วัตถุดิบเสียหาย / ชำรุด');
  const [formCustomReason, setFormCustomReason] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [formItems, setFormItems] = useState<NewItemForm[]>([
    { ingredientId: '', actualQuantity: '' },
  ]);

  // Reject Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedAdjForReject, setSelectedAdjForReject] = useState<AdjustmentRecord | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Detail Modal
  const [selectedAdjustment, setSelectedAdjustment] = useState<AdjustmentRecord | null>(null);

  // Print Modals
  const [printListModalOpen, setPrintListModalOpen] = useState(false);
  const [printVoucherOpen, setPrintVoucherOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Create Modal
  const openCreateModal = () => {
    const firstIng = ingredients[0];
    setFormReason('วัตถุดิบเสียหาย / ชำรุด');
    setFormCustomReason('');
    setAutoApprove(true);
    setFormItems([
      {
        ingredientId: firstIng ? String(firstIng.id) : '',
        actualQuantity: firstIng ? String(Number(firstIng.currentStock)) : '0',
      },
    ]);
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleAddItemRow = () => {
    const firstIng = ingredients[0];
    setFormItems((prev) => [
      ...prev,
      {
        ingredientId: firstIng ? String(firstIng.id) : '',
        actualQuantity: firstIng ? String(Number(firstIng.currentStock)) : '0',
      },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof NewItemForm, value: string) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      if (field === 'ingredientId') {
        const found = ingredients.find((i) => i.id === Number(value));
        if (found) {
          updated[idx].actualQuantity = String(Number(found.currentStock));
        }
      }
      return updated;
    });
  };

  // Submit New Adjustment
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validItems = formItems.filter(
      (item) => item.ingredientId && item.actualQuantity !== '' && !isNaN(parseFloat(item.actualQuantity))
    );

    if (validItems.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนที่ต้องการปรับปรุงอย่างน้อย 1 รายการ');
      return;
    }

    const finalReason = formReason === 'อื่นๆ' ? formCustomReason.trim() : formReason;
    if (!finalReason) {
      setFormError('กรุณาระบุเหตุผลในการปรับปรุงสต็อก');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: finalReason,
          autoApprove,
          items: validItems.map((item) => ({
            ingredientId: Number(item.ingredientId),
            actualQuantity: parseFloat(item.actualQuantity),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'สร้างใบปรับปรุงสต็อกไม่สำเร็จ');
      }

      showToast(data.message);
      await mutate();
      setCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Action
  const handleApprove = async (adj: AdjustmentRecord) => {
    if (!confirm(`ยืนยันการอนุมัติใบปรับปรุงสต็อก #${adj.adjustmentNumber} ใช่หรือไม่?\nระบบจะทำการอัปเดตยอดคงเหลือจริงในคลังทันที`)) {
      return;
    }

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: adj.id,
          action: 'APPROVE',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'อนุมัติไม่สำเร็จ');
      }

      showToast(data.message);
      await mutate();
      if (selectedAdjustment?.id === adj.id) {
        setSelectedAdjustment(data.adjustment);
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // Reject Action
  const handleOpenRejectModal = (adj: AdjustmentRecord) => {
    setSelectedAdjForReject(adj);
    setRejectReasonInput('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedAdjForReject) return;
    setRejecting(true);

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAdjForReject.id,
          action: 'REJECT',
          rejectReason: rejectReasonInput.trim() || 'ไม่อนุมัติโดยผู้ดูแลระบบ',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ดำเนินการไม่สำเร็จ');
      }

      showToast(data.message);
      await mutate();
      setRejectModalOpen(false);
      setSelectedAdjForReject(null);
      if (selectedAdjustment?.id === selectedAdjForReject.id) {
        setSelectedAdjustment(data.adjustment);
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRejecting(false);
    }
  };

  // Filtered List
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      // Tab filter
      if (activeTab !== 'ALL' && adj.status !== activeTab) return false;

      // Search keyword
      const q = search.toLowerCase().trim();
      if (q) {
        const matchNum = adj.adjustmentNumber.toLowerCase().includes(q);
        const matchReason = adj.reason.toLowerCase().includes(q);
        const matchReq = adj.requestedBy?.name.toLowerCase().includes(q);
        const matchIng = adj.items.some((i) =>
          i.ingredient?.name.toLowerCase().includes(q) || i.ingredient?.code.toLowerCase().includes(q)
        );
        if (!matchNum && !matchReason && !matchReq && !matchIng) return false;
      }
      return true;
    });
  }, [adjustments, activeTab, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  // Paginated adjustments (10 items per page for screen view)
  const paginatedAdjustments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAdjustments.slice(start, start + pageSize);
  }, [filteredAdjustments, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Normal Screen UI (Hidden during print) */}
      <div className="print:hidden space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            ระบบอนุมัติใบปรับปรุงสต็อก (Stock Adjustments & Approval) จัดการปรับยอดวัตถุดิบเสียหาย ชำรุด หรือสูญหาย
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
            <span>พิมพ์ตารางคำขอ</span>
          </button>

          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ สร้างใบขอปรับปรุงสต็อกใหม่</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending (Highlighted) */}
        <div
          onClick={() => setActiveTab('PENDING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              รอการอนุมัติ (Pending)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
            {metrics.pendingCount} <span className="text-xs font-semibold text-slate-500">ใบคำขอ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">รอผู้ดูแลระบบตรวจสอบ</p>
        </div>

        {/* Card 2: Approved */}
        <div
          onClick={() => setActiveTab('APPROVED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              อนุมัติแล้ว (Approved)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {metrics.approvedCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ปรับยอดคงเหลือจริงแล้ว</p>
        </div>

        {/* Card 3: Rejected */}
        <div
          onClick={() => setActiveTab('REJECTED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'REJECTED'
              ? 'bg-red-500/10 border-red-500 ring-2 ring-red-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
              ไม่อนุมัติ (Rejected)
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 mt-1 font-mono">
            {metrics.rejectedCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ถูกปฏิเสธคำขอ</p>
        </div>

        {/* Card 4: Total */}
        <div
          onClick={() => setActiveTab('ALL')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30'
              : 'bg-white border-slate-200 shadow-2xs hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              คำขอทั้งหมด (Total)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
            {metrics.totalCount} <span className="text-xs font-semibold text-slate-500">ใบคำขอ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">ประวัติการปรับปรุงสต็อก</p>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({metrics.totalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeTab === 'PENDING'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>รอการอนุมัติ</span>
            {metrics.pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black">
                {metrics.pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'APPROVED'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            อนุมัติแล้ว ({metrics.approvedCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REJECTED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'REJECTED'
                ? 'bg-red-700 text-white shadow-2xs'
                : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
            }`}
          >
            ไม่อนุมัติ ({metrics.rejectedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่คำขอ, เหตุผล, หรือชื่อผู้ขอ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดรายการใบขอปรับปรุงสต็อก...</span>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <FileEdit className="w-12 h-12 text-slate-300" />
            <div className="font-bold text-slate-600 text-sm">ไม่พบรายการใบขอปรับปรุงสต็อกที่ตรงกับเงื่อนไข</div>
            <p className="max-w-md text-slate-400">
              กดปุ่ม <span className="text-emerald-700 font-bold">&quot;+ สร้างใบขอปรับปรุงสต็อกใหม่&quot;</span> ด้านบน เพื่อสร้างใบขอปรับปรุง
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">เลขที่คำขอ</th>
                  <th className="py-3.5 px-4">วันที่ทำรายการ</th>
                  <th className="py-3.5 px-4">ผู้ขอปรับปรุง</th>
                  <th className="py-3.5 px-4">เหตุผลในการปรับปรุง</th>
                  <th className="py-3.5 px-4">รายการวัตถุดิบ & ผลต่าง</th>
                  <th className="py-3.5 px-4 text-center">สถานะ</th>
                  <th className="py-3.5 px-4 text-right">การอนุมัติ / จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedAdjustments.map((adj) => {
                  const isPending = adj.status === 'PENDING';
                  const isApproved = adj.status === 'APPROVED';
                  const isRejected = adj.status === 'REJECTED';

                  return (
                    <tr
                      key={adj.id}
                      onClick={() => setSelectedAdjustment(adj)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Adjustment Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        <div className="flex items-center gap-1.5 group-hover:underline">
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{adj.adjustmentNumber}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-bold text-slate-700">
                          {new Date(adj.createdAt).toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(adj.createdAt).toLocaleTimeString('th-TH')} น.
                        </div>
                      </td>

                      {/* Requested By */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{adj.requestedBy?.name || 'User'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          @{adj.requestedBy?.username} ({adj.requestedBy?.role})
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-800 truncate">{adj.reason}</div>
                        {isRejected && adj.rejectReason && (
                          <div className="text-[10px] text-red-500 font-semibold truncate mt-0.5">
                            เหตุผลปฏิเสธ: {adj.rejectReason}
                          </div>
                        )}
                      </td>

                      {/* Items Preview */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {adj.items.slice(0, 2).map((item) => {
                            const diff = Number(item.diffQuantity);
                            return (
                              <div key={item.id} className="text-[11px] flex items-center gap-1.5">
                                <span className="font-medium text-slate-700">{item.ingredient?.name}</span>
                                <span
                                  className={`font-mono font-bold ${
                                    diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}` : diff} {item.ingredient?.unit}
                                </span>
                              </div>
                            );
                          })}
                          {adj.items.length > 2 && (
                            <div className="text-[10px] text-slate-400 font-semibold">
                              + อีก {adj.items.length - 2} รายการ
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>รออนุมัติ</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>อนุมัติแล้ว</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-300">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>ไม่อนุมัติ</span>
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(adj)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="อนุมัติและปรับปรุงยอดสต็อกจริง"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>อนุมัติ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRejectModal(adj)}
                                className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                title="ปฏิเสธคำขอนี้"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>ปฏิเสธ</span>
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedAdjustment(adj)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
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
              totalItems={filteredAdjustments.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
      </div>

      {/* Modal 1: Create New Stock Adjustment */}
      {createModalOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    สร้างใบขอปรับปรุงสต็อก (New Stock Adjustment)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ระบุวัตถุดิบและยอดที่ต้องการปรับปรุง พร้อมเหตุผลประกอบ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCreate} className="mt-5 space-y-4">
              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เหตุผลในการปรับปรุงสต็อก <span className="text-red-500">*</span>
                </label>
                <select
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="วัตถุดิบเสียหาย / ชำรุด">🔴 วัตถุดิบเสียหาย / ชำรุด (Damaged)</option>
                  <option value="วัตถุดิบหมดอายุ / เสื่อมสภาพ">⚠️ วัตถุดิบหมดอายุ / เสื่อมสภาพ (Expired)</option>
                  <option value="นำไปใช้ทดลองสูตร / ฝึกอบรม">🧪 นำไปใช้ทดลองสูตร / ฝึกอบรมพนักงาน (R&D / Training)</option>
                  <option value="ปรับปรุงจากการตรวจนับสต็อกจริง">📋 ปรับปรุงจากการตรวจนับสต็อกจริง (Physical Count Diff)</option>
                  <option value="ได้รับแถมจากซัพพลายเออร์">🎁 ได้รับแถมจากซัพพลายเออร์ (Free Bonus)</option>
                  <option value="สินค้าสูญหายไม่ทราบสาเหตุ">❓ วัตถุดิบสูญหายไม่ทราบสาเหตุ (Missing)</option>
                  <option value="อื่นๆ">✏️ อื่นๆ (ระบุเอง)</option>
                </select>

                {formReason === 'อื่นๆ' && (
                  <input
                    type="text"
                    required
                    value={formCustomReason}
                    onChange={(e) => setFormCustomReason(e.target.value)}
                    placeholder="กรุณาระบุเหตุผลอย่างละเอียด..."
                    className="mt-2 w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                )}
              </div>

              {/* Dynamic Items Rows */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    รายการวัตถุดิบที่ต้องการปรับ ({formItems.length} รายการ) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มแถววัตถุดิบ</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formItems.map((item, idx) => {
                    const selectedIng = ingredients.find((i) => i.id === Number(item.ingredientId));
                    const systemQty = selectedIng ? Number(selectedIng.currentStock) : 0;
                    const actualQty = parseFloat(item.actualQuantity);
                    const diff = !isNaN(actualQty) ? actualQty - systemQty : 0;

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-2 text-xs"
                      >
                        {/* Ingredient Select */}
                        <div className="flex-1 w-full">
                          <select
                            value={item.ingredientId}
                            onChange={(e) => handleItemChange(idx, 'ingredientId', e.target.value)}
                            required
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none"
                          >
                            <option value="">-- เลือกวัตถุดิบ --</option>
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} (ในระบบ: {Number(ing.currentStock)} {ing.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* System Stock preview */}
                        <div className="w-24 text-right font-mono text-slate-500 hidden sm:block">
                          ระบบ: {systemQty.toLocaleString()}
                        </div>

                        {/* Actual Input */}
                        <div className="w-full sm:w-36 flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">ปรับเป็น:</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={item.actualQuantity}
                            onChange={(e) => handleItemChange(idx, 'actualQuantity', e.target.value)}
                            placeholder="ยอดใหม่"
                            className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold text-right focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 w-8 truncate">
                            {selectedIng?.unit || 'หน่วย'}
                          </span>
                        </div>

                        {/* Diff Preview */}
                        <div className="w-24 text-right font-mono font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">0</span>
                          ) : diff > 0 ? (
                            <span className="text-blue-600">+{diff}</span>
                          ) : (
                            <span className="text-red-600">{diff}</span>
                          )}
                        </div>

                        {/* Delete Row */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={formItems.length === 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Approve Checkbox (Admin) */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-emerald-900">
                    อนุมัติและปรับปรุงยอดคงเหลือทันที (Admin Auto-Approve)
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    ระบบจะตัดยอดในคลังและบันทึกประวัติความเคลื่อนไหวให้ทันทีโดยไม่ต้องรออนุมัติซ้ำ
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FileEdit className="w-4 h-4" />
                  <span>{submitting ? 'กำลังบันทึก...' : '💾 บันทึกใบปรับปรุงสต็อก'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reject Reason Prompt */}
      {rejectModalOpen && selectedAdjForReject && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-600 pb-3 border-b border-slate-100">
              <XCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-800">ปฏิเสธใบขอปรับปรุงสต็อก</h3>
            </div>

            <div className="mt-4 text-xs space-y-3">
              <p className="text-slate-600">
                คุณกำลังปฏิเสธคำขอเลขที่ <span className="font-mono font-bold text-slate-800">#{selectedAdjForReject.adjustmentNumber}</span>
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ระบุเหตุผลที่ไม่อนุมัติคำขอนี้
                </label>
                <textarea
                  rows={3}
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="เช่น ตรวจสอบแล้วยอดจริงไม่ตรงกับที่ระบุ, ไม่ได้รับอนุญาต..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={rejecting}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {rejecting ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธคำขอ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View Adjustment Detail */}
      {selectedAdjustment && !printVoucherOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    ใบปรับปรุงสต็อก #{selectedAdjustment.adjustmentNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    วันที่ {new Date(selectedAdjustment.createdAt).toLocaleString('th-TH')} น.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta Grid */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">ผู้ขอปรับปรุง:</span>
                <div className="font-bold text-slate-800">
                  {selectedAdjustment.requestedBy?.name} (@{selectedAdjustment.requestedBy?.username})
                </div>
              </div>

              <div>
                <span className="text-slate-400">สถานะคำขอ:</span>
                <div>
                  {selectedAdjustment.status === 'PENDING' && (
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      ⏳ รอการอนุมัติ (Pending)
                    </span>
                  )}
                  {selectedAdjustment.status === 'APPROVED' && (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      ✅ อนุมัติแล้ว (Approved)
                    </span>
                  )}
                  {selectedAdjustment.status === 'REJECTED' && (
                    <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      ❌ ไม่อนุมัติ (Rejected)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400">เหตุผล:</span>
                <div className="font-bold text-slate-800">{selectedAdjustment.reason}</div>
              </div>

              {selectedAdjustment.approvedBy && (
                <div>
                  <span className="text-slate-400">
                    {selectedAdjustment.status === 'APPROVED' ? 'ผู้อนุมัติ:' : 'ผู้ปฏิเสธ:'}
                  </span>
                  <div className="font-bold text-slate-800">
                    {selectedAdjustment.approvedBy.name} (
                    {new Date(selectedAdjustment.approvedAt || '').toLocaleString('th-TH')})
                  </div>
                </div>
              )}

              {selectedAdjustment.rejectReason && (
                <div className="sm:col-span-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  <span className="font-bold">เหตุผลที่ปฏิเสธ: </span>
                  <span>{selectedAdjustment.rejectReason}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">รหัส / ชื่อวัตถุดิบ</th>
                    <th className="py-2.5 px-3 text-right">ยอดในระบบเดิม</th>
                    <th className="py-2.5 px-3 text-right">ยอดที่ปรับใหม่</th>
                    <th className="py-2.5 px-3 text-right">ผลต่าง (Diff)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedAdjustment.items.map((item) => {
                    const diff = Number(item.diffQuantity);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{item.ingredient?.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.ingredient?.code}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {Number(item.systemQuantity).toLocaleString()} {item.ingredient?.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {Number(item.actualQuantity).toLocaleString()} {item.ingredient?.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">0</span>
                          ) : diff > 0 ? (
                            <span className="text-blue-600">+{diff.toLocaleString()} {item.ingredient?.unit}</span>
                          ) : (
                            <span className="text-red-600">{diff.toLocaleString()} {item.ingredient?.unit}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPrintVoucherOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบปรับปรุง</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedAdjustment.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedAdjustment)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      ✅ อนุมัติคำขอนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(selectedAdjustment)}
                      className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs cursor-pointer"
                    >
                      ❌ ปฏิเสธคำขอ
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAdjustment(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Stock Adjustment Voucher Print Preview Modal */}
      {printVoucherOpen && selectedAdjustment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6 print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print w-full max-w-5xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ตัวอย่างพิมพ์ใบขออนุมัติปรับปรุงยอดสต็อกสินค้า (A4 แนวนอน)
                </h3>
                <p className="text-[11px] text-slate-500">
                  เลขที่: {selectedAdjustment.adjustmentNumber} • ตรวจสอบความถูกต้องก่อนสั่งพิมพ์หรือบันทึกเป็น PDF
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
                onClick={() => setPrintVoucherOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Voucher Sheet (A4 Landscape Style) */}
          <div
            id="official-stock-adjustment-voucher"
            className="w-full max-w-5xl bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-2 mb-2 border-b border-black">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-base font-bold tracking-tight text-black uppercase">
                    บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                  </h1>
                  <h2 className="text-sm font-bold text-black mt-0.5">
                    ใบขออนุมัติปรับปรุงยอดสต็อกสินค้า (Stock Adjustment Request & Approval Voucher)
                  </h2>
                </div>
                <div className="text-right text-[10px] text-black font-mono leading-tight">
                  <div className="font-bold text-black">ฝ่ายควบคุมสต็อกและคลังสินค้า</div>
                  <div>เลขที่คำขอ: {selectedAdjustment.adjustmentNumber}</div>
                  <div>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</div>
                </div>
              </div>

              {/* Sub-Header: Meta Grid */}
              <div className="mt-3 p-2.5 rounded border border-black bg-white grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-black">
                <div>
                  <span className="font-bold text-black">วันที่ยื่นคำขอ: </span>
                  <span className="font-mono">{new Date(selectedAdjustment.createdAt).toLocaleDateString('th-TH')} {new Date(selectedAdjustment.createdAt).toLocaleTimeString('th-TH')} น.</span>
                </div>
                <div>
                  <span className="font-bold text-black">ผู้ยื่นคำขอ: </span>
                  <span>{selectedAdjustment.requestedBy?.name} (@{selectedAdjustment.requestedBy?.username})</span>
                </div>
                <div>
                  <span className="font-bold text-black">สถานะคำขอ: </span>
                  <span className="font-bold">
                    {selectedAdjustment.status === 'PENDING' && 'รอการอนุมัติ (Pending)'}
                    {selectedAdjustment.status === 'APPROVED' && 'อนุมัติแล้ว (Approved)'}
                    {selectedAdjustment.status === 'REJECTED' && 'ไม่อนุมัติ (Rejected)'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-black">ผู้อนุมัติ/จัดการ: </span>
                  <span>{selectedAdjustment.approvedBy ? `${selectedAdjustment.approvedBy.name}` : '-'}</span>
                </div>
                <div className="sm:col-span-4 border-t border-black pt-1.5 mt-0.5">
                  <span className="font-bold text-black">เหตุผลในการปรับปรุง: </span>
                  <span>{selectedAdjustment.reason}</span>
                  {selectedAdjustment.rejectReason && (
                    <span className="ml-3 text-black font-bold">(เหตุผลปฏิเสธ: {selectedAdjustment.rejectReason})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Adjustment Items Table */}
            <div className="overflow-x-auto my-2.5">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-b border-black text-black font-bold bg-white text-center">
                    <th className="py-1.5 px-2 border-r border-black w-10">ลำดับ</th>
                    <th className="py-1.5 px-3 border-r border-black w-28">รหัสวัตถุดิบ</th>
                    <th className="py-1.5 px-3 border-r border-black text-left">ชื่อวัตถุดิบ</th>
                    <th className="py-1.5 px-3 border-r border-black text-right w-28">ยอดเดิมในระบบ</th>
                    <th className="py-1.5 px-3 border-r border-black text-right w-28">ยอดที่ปรับใหม่</th>
                    <th className="py-1.5 px-3 border-r border-black text-right w-28">ผลต่าง (Diff)</th>
                    <th className="py-1.5 px-2 text-center w-20">หน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {selectedAdjustment.items.map((item, idx) => {
                    const diff = Number(item.diffQuantity);
                    return (
                      <tr key={item.id} className="border-b border-black">
                        <td className="py-1.5 px-2 text-center border-r border-black font-sans text-black">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black font-bold text-black">
                          {item.ingredient?.code}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black font-sans font-bold text-black text-left">
                          {item.ingredient?.name}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black text-right text-black">
                          {Number(item.systemQuantity).toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black text-right font-bold text-black">
                          {Number(item.actualQuantity).toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black text-right font-bold text-black">
                          {diff === 0 ? (
                            <span>0</span>
                          ) : diff > 0 ? (
                            <span>+{diff.toLocaleString()}</span>
                          ) : (
                            <span>{diff.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center font-sans text-black">
                          {item.ingredient?.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black bg-white font-bold text-[10px] text-black">
                    <td colSpan={3} className="py-2 px-3 text-right font-sans border-r border-black">
                      รวมรายการที่ขอปรับปรุงทั้งสิ้น:
                    </td>
                    <td colSpan={4} className="py-2 px-3 text-left font-sans text-black">
                      <span className="font-mono font-bold">{selectedAdjustment.items.length}</span> รายการวัตถุดิบ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signature Section */}
            <div className="print-signature-section pt-5 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ขอปรับปรุงสต็อก (Staff / ผู้ยื่น)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจสอบ (ผู้จัดการสาขา)</div>
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

      {/* Official Stock Adjustments Summary Report Print Preview Modal */}
      {printListModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6 print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print w-full max-w-5xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ตัวอย่างพิมพ์รายงานสรุปรายการขอปรับปรุงสต็อก (A4 แนวนอน)
                </h3>
                <p className="text-[11px] text-slate-500">
                  ตรวจสอบความถูกต้องก่อนสั่งพิมพ์ หรือบันทึกเป็น PDF
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
                onClick={() => setPrintListModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          {/* Printable Report Sheet (A4 Landscape Style) */}
          <div
            id="official-stock-adjustments-report"
            className="w-full max-w-5xl bg-white text-black p-6 sm:p-8 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-2 mb-2 border-b border-black">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-base font-bold tracking-tight text-black uppercase">
                    บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                  </h1>
                  <h2 className="text-sm font-bold text-black mt-0.5">
                    รายงานสรุปรายการขอปรับปรุงสต็อกสินค้า (Stock Adjustments Summary Report)
                  </h2>
                </div>
                <div className="text-right text-[10px] text-black font-mono leading-tight">
                  <div className="font-bold text-black">ฝ่ายควบคุมสต็อกและคลังสินค้า</div>
                  <div>เลขที่เอกสาร: ADJ-REP-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}</div>
                  <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</div>
                </div>
              </div>

              {/* Sub-Header: Filter Info */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-black font-medium">
                <div>
                  <span className="font-bold text-black">สถานะที่เลือก: </span>
                  <span>
                    {activeTab === 'ALL'
                      ? 'คำขอทั้งหมด'
                      : activeTab === 'PENDING'
                      ? 'รอการอนุมัติ (Pending)'
                      : activeTab === 'APPROVED'
                      ? 'อนุมัติแล้ว (Approved)'
                      : 'ไม่อนุมัติ (Rejected)'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-black">จำนวนคำขอที่แสดง: </span>
                  <span className="font-bold font-mono">{filteredAdjustments.length}</span> ฉบับ
                </div>
              </div>
            </div>

            {/* 4 Primary KPI Summary Cards Strip */}
            <div className="print-avoid-break grid grid-cols-4 gap-2 text-center my-2.5">
              <div className="p-2 rounded border border-black bg-white">
                <div className="text-[9.5px] font-bold text-black">รอการอนุมัติ (Pending)</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-black mt-0.5">
                  {metrics.pendingCount} <span className="text-[9.5px] font-normal">ใบ</span>
                </div>
              </div>

              <div className="p-2 rounded border border-black bg-white">
                <div className="text-[9.5px] font-bold text-black">อนุมัติแล้ว (Approved)</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-black mt-0.5">
                  {metrics.approvedCount} <span className="text-[9.5px] font-normal">ใบ</span>
                </div>
              </div>

              <div className="p-2 rounded border border-black bg-white">
                <div className="text-[9.5px] font-bold text-black">ไม่อนุมัติ (Rejected)</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-black mt-0.5">
                  {metrics.rejectedCount} <span className="text-[9.5px] font-normal">ใบ</span>
                </div>
              </div>

              <div className="p-2 rounded border border-black bg-white">
                <div className="text-[9.5px] font-bold text-black">รวมคำขอทั้งหมด</div>
                <div className="text-xs sm:text-sm font-bold font-mono text-black mt-0.5">
                  {metrics.totalCount} <span className="text-[9.5px] font-normal">ใบ</span>
                </div>
              </div>
            </div>

            {/* Adjustments Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-b border-black text-black font-bold bg-white text-center">
                    <th className="py-1 px-1 border-r border-black w-8">ลำดับ</th>
                    <th className="py-1 px-2 border-r border-black w-28">เลขที่คำขอ</th>
                    <th className="py-1 px-2 border-r border-black w-24">วันที่ยื่น</th>
                    <th className="py-1 px-2 border-r border-black w-24 text-left">ผู้ขอปรับปรุง</th>
                    <th className="py-1 px-2 border-r border-black text-left">เหตุผล</th>
                    <th className="py-1 px-2 border-r border-black text-left w-44">รายการวัตถุดิบ & ผลต่าง</th>
                    <th className="py-1 px-2 border-r border-black text-center w-20">สถานะ</th>
                    <th className="py-1 px-2 text-left w-24">ผู้อนุมัติ/จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {filteredAdjustments.map((adj, idx) => (
                    <tr key={adj.id} className="border-b border-black">
                      <td className="py-1 px-1 text-center border-r border-black font-sans text-black">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-2 border-r border-black font-bold text-black">
                        {adj.adjustmentNumber}
                      </td>
                      <td className="py-1 px-2 border-r border-black font-sans text-black text-center">
                        {new Date(adj.createdAt).toLocaleDateString('th-TH')}
                      </td>
                      <td className="py-1 px-2 border-r border-black font-sans text-black text-left font-bold">
                        {adj.requestedBy?.name}
                      </td>
                      <td className="py-1 px-2 border-r border-black font-sans text-black text-left">
                        {adj.reason}
                      </td>
                      <td className="py-1 px-2 border-r border-black font-sans text-left text-black">
                        {adj.items.map((i) => {
                          const diff = Number(i.diffQuantity);
                          return (
                            <div key={i.id} className="text-[9px] leading-tight text-black">
                              • {i.ingredient?.name}:{' '}
                              <span className="text-black font-bold">
                                {diff > 0 ? `+${diff}` : diff} {i.ingredient?.unit}
                              </span>
                            </div>
                          );
                        })}
                      </td>
                      <td className="py-1 px-2 border-r border-black text-center font-sans font-bold text-black">
                        {adj.status === 'PENDING' && <span>รออนุมัติ</span>}
                        {adj.status === 'APPROVED' && <span>อนุมัติแล้ว</span>}
                        {adj.status === 'REJECTED' && <span>ไม่อนุมัติ</span>}
                      </td>
                      <td className="py-1 px-2 font-sans text-black text-left text-[9px]">
                        {adj.approvedBy?.name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black bg-white font-bold text-[10px] text-black">
                    <td colSpan={5} className="py-1.5 px-3 text-right font-sans border-r border-black">
                      รวมคำขอทั้งหมดในรายงานนี้:
                    </td>
                    <td colSpan={3} className="py-1.5 px-3 text-left font-sans text-black">
                      <span className="font-mono font-bold">{filteredAdjustments.length}</span> ใบคำขอ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signature Section */}
            <div className="print-signature-section pt-4 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้จัดทำรายงาน (เจ้าหน้าที่สต็อก / แคชเชียร์)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจสอบ (ผู้จัดการสาขา)</div>
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

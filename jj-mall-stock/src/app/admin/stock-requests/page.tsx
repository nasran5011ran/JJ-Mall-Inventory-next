'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ArrowUpFromLine,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  X,
  FileText,
  Store,
  Warehouse,
  AlertCircle,
  Check,
  Eye,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';
import { showSuccessAlert, showErrorAlert, confirmActionAlert } from '@/lib/sweetalert';

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
    currentStock: number;
    costPerUnit?: number;
    storeId?: number | null;
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

interface StaffStore {
  id: number;
  name: string;
  username: string;
}

export default function AdminStockRequestsPage() {
  const { user } = useAuth();

  // SWR for realtime requests
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-requests', {
    refreshInterval: 4000,
    revalidateOnFocus: true,
  });

  const requisitions: RequisitionRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.requisitions) ? swrData.requisitions : [];
  }, [swrData]);

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  const storeBalancesByStore: Record<number, any[]> = useMemo(() => {
    return swrData?.success && swrData.storeBalancesByStore ? swrData.storeBalancesByStore : {};
  }, [swrData]);

  // Helper to look up in-store stock before purchase
  const getStoreStock = (storeId: number, ingredientId: number): number => {
    const list = storeBalancesByStore[storeId] || [];
    const item = list.find((b: any) => b.ingredientId === ingredientId);
    return item ? Number(item.expectedStock || 0) : 0;
  };

  // Helper to compute total requisition cost (฿)
  const computeRequisitionTotal = (req: RequisitionRecord): number => {
    return req.items.reduce((sum, it) => {
      const qty = Number(it.approvedQty !== null && req.status === 'APPROVED' ? it.approvedQty : it.requestedQty || 0);
      const cost = Number(it.ingredient.costPerUnit || 0);
      return sum + qty * cost;
    }, 0);
  };

  const metrics = swrData?.metrics || {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
  };

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Action Modals State
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionRecord | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  

  // Filtered list
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchStore = storeFilter === 'ALL' || String(req.store.id) === storeFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        req.requisitionNumber.toLowerCase().includes(q) ||
        req.store.name.toLowerCase().includes(q) ||
        (req.reason && req.reason.toLowerCase().includes(q)) ||
        req.items.some((it) => it.ingredient.name.toLowerCase().includes(q) || it.ingredient.code.toLowerCase().includes(q));

      return matchStatus && matchStore && matchSearch;
    });
  }, [requisitions, statusFilter, storeFilter, searchTerm]);

  // Paginated list
  const totalPages = Math.ceil(filteredRequisitions.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequisitions.slice(start, start + pageSize);
  }, [filteredRequisitions, currentPage, pageSize]);

  // Open Approve Modal
  const handleOpenApproveModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setActionError(null);
    setIsApproveModalOpen(true);
  };

  // Open Reject Modal
  const handleOpenRejectModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setRejectReasonInput('');
    setActionError(null);
    setIsRejectModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetailModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setIsDetailModalOpen(true);
  };

  // Confirm Approval (Approve store purchase & add stock)
  const handleConfirmApproval = async () => {
    if (!selectedRequisition) return;

    const isConfirmed = await confirmActionAlert({
      title: 'ยืนยันอนุมัติการซื้อวัตถุดิบ?',
      text: `ต้องการอนุมัติใบขอซื้อเลขที่ ${selectedRequisition.requisitionNumber} และบันทึกรับเข้าสต็อกสาขาใช่หรือไม่?`,
      icon: 'question',
      confirmButtonText: 'ตกลง',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10b981',
    });
    if (!isConfirmed) return;

    setActionError(null);

    try {
      setIsProcessing(true);
      const res = await fetch('/api/stock-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          action: 'APPROVE',
          items: selectedRequisition.items.map((it) => ({
            id: it.id,
            approvedQty: it.requestedQty,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'อนุมัติการซื้อไม่สำเร็จ');
      }

      setIsApproveModalOpen(false);
      mutate();
      await showSuccessAlert(
        'อนุมัติการซื้อสำเร็จ',
        `อนุมัติใบขอซื้อ ${selectedRequisition.requisitionNumber} และบันทึกเพิ่มสต็อกเข้าหน้าร้านเรียบร้อยแล้ว`
      );
    } catch (e: any) {
      setActionError(e.message || 'เกิดข้อผิดพลาด');
      await showErrorAlert('อนุมัติการซื้อไม่สำเร็จ', e.message || 'เกิดข้อผิดพลาดในการอนุมัติ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Rejection
  const handleConfirmRejection = async () => {
    if (!selectedRequisition) return;

    const isConfirmed = await confirmActionAlert({
      title: 'ยืนยันปฏิเสธคำขอซื้อ?',
      text: `ต้องการปฏิเสธใบขอซื้อเลขที่ ${selectedRequisition.requisitionNumber} ใช่หรือไม่?`,
      icon: 'warning',
      confirmButtonText: 'ตกลง',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
    });
    if (!isConfirmed) return;

    setActionError(null);

    try {
      setIsProcessing(true);
      const res = await fetch('/api/stock-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          action: 'REJECT',
          rejectReason: rejectReasonInput,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'ปฏิเสธไม่สำเร็จ');
      }

      setIsRejectModalOpen(false);
      mutate();
      await showSuccessAlert(
        'ปฏิเสธใบขอซื้อเรียบร้อย',
        `ใบขอซื้อ ${selectedRequisition.requisitionNumber} ได้รับการบันทึกสถานะไม่อนุมัติแล้ว`
      );
    } catch (e: any) {
      setActionError(e.message || 'เกิดข้อผิดพลาด');
      await showErrorAlert('ปฏิเสธไม่สำเร็จ', e.message || 'เกิดข้อผิดพลาดในการปฏิเสธ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculation for approve modal total amount
  const approveModalTotal = useMemo(() => {
    if (!selectedRequisition) return 0;
    return selectedRequisition.items.reduce((sum, item) => {
      const qty = Number(item.requestedQty || 0);
      const cost = Number(item.ingredient.costPerUnit || 0);
      return sum + qty * cost;
    }, 0);
  }, [selectedRequisition]);

  return (
    <div className="space-y-6">


      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">อนุมัติการซื้อวัตถุดิบหน้าร้าน</h1>
              <p className="text-xs text-slate-500">
                ตรวจสอบและอนุมัติรายการที่หน้าร้านสาขาซื้อมา เพื่อบันทึกรับเข้าสต็อกของแต่ละสาขา
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'ALL' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">คำขอซื้อทั้งหมด</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {metrics.totalCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">รออนุมัติการซื้อ (ต้องดำเนินการ)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {metrics.pendingCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">อนุมัติการซื้อแล้ว</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {metrics.approvedCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'REJECTED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">ปฏิเสธแล้ว</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {metrics.rejectedCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
          </div>
        </div>
      </div>

      {/* Store Selection Tabs */}
      <div className="flex">
        <div className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto border border-slate-200">
          <div className="px-3 py-1.5 text-xs font-bold text-slate-500 flex items-center shrink-0">
            <span>เลือกร้านค้า:</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setStoreFilter('ALL');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              storeFilter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            ทุกร้านค้า ({requisitions.length})
          </button>

          {staffStores.map((st) => {
            const count = requisitions.filter((r) => r.store.id === st.id).length;
            const pendingCountForStore = requisitions.filter((r) => r.store.id === st.id && r.status === 'PENDING').length;
            const isSelected = storeFilter === String(st.id);
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStoreFilter(String(st.id));
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>{st.name} ({count})</span>
                {pendingCountForStore > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative flex-1 md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่บิล, ชื่อร้าน, ชื่อวัตถุดิบ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Store Filter Dropdown */}
          <select
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">🏪 ทุกร้านค้า ({requisitions.length})</option>
            {staffStores.map((st) => (
              <option key={st.id} value={String(st.id)}>
                🏪 {st.name} (@{st.username})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
            const labels = {
              ALL: 'ทั้งหมด',
              PENDING: 'รออนุมัติการซื้อ',
              APPROVED: 'อนุมัติแล้ว',
              REJECTED: 'ไม่อนุมัติ',
            };
            return (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading && requisitions.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>กำลังโหลดรายการขอซื้อวัตถุดิบ...</span>
          </div>
        ) : paginatedList.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">ไม่พบใบขอซื้อวัตถุดิบ</p>
            <p className="text-[11px] text-slate-400">ยังไม่มีรายการขอซื้อที่ตรงกับเงื่อนไขการค้นหา</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-3 text-center w-10 text-slate-400">#</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">เลขที่ใบขอซื้อ</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">ร้านค้าที่ซื้อ</th>
                  <th className="py-3.5 px-3">รายการวัตถุดิบที่ซื้อ (พรีวิว)</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">ยอดเงินรวม (฿)</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">วันที่ส่งคำขอ</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">สถานะ</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedList.map((req, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const totalCost = computeRequisitionTotal(req);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Sequence Row Number */}
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                        {rowNumber}
                      </td>

                      {/* Requisition Number & Note */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 text-[11px]">
                          {req.requisitionNumber}
                        </span>
                        {req.reason && (
                          <div className="text-[11px] text-slate-500 mt-1 font-normal line-clamp-1">
                            {req.reason}
                          </div>
                        )}
                      </td>

                      {/* Store */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span>{req.store.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          @{req.store.username}
                        </div>
                      </td>

                      {/* Purchased Items Preview (Wide Column, Full Names & Numbered 1, 2) */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {req.items.slice(0, 2).map((it, itemIdx) => {
                            const qty = Number(req.status === 'APPROVED' && it.approvedQty !== null ? it.approvedQty : it.requestedQty);
                            return (
                              <span
                                key={it.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-800 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                                title={`${it.ingredient.name} (${qty.toLocaleString()} ${it.ingredient.unit})`}
                              >
                                <span className="w-4 h-4 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px] font-black inline-flex items-center justify-center shrink-0">
                                  {itemIdx + 1}
                                </span>
                                <span className="font-semibold text-slate-900">{it.ingredient.name}</span>
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                                  {qty.toLocaleString()} {it.ingredient.unit}
                                </span>
                              </span>
                            );
                          })}

                          {req.items.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(req)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              title="คลิกเพื่อดูรายการวัตถุดิบทั้งหมด"
                            >
                              <span>+{req.items.length - 2} รายการ</span>
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Total Cost */}
                      <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 text-xs whitespace-nowrap">
                        ฿{totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleString('th-TH', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} น.
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {req.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            รออนุมัติการซื้อ
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

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          {req.status === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenDetailModal(req)}
                                className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                                title="ดูรายละเอียดใบขอซื้อทั้งหมด"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenApproveModal(req)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer transition-all"
                                title="ตรวจสอบและอนุมัติการซื้อ"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>อนุมัติการซื้อ</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenRejectModal(req)}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                                title="ปฏิเสธคำขอซื้อ"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>ปฏิเสธ</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(req)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>ดูรายละเอียด</span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              แสดงหน้า {currentPage} จาก {totalPages} (ทั้งหมด {filteredRequisitions.length} รายการ)
            </span>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRequisitions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* APPROVE PURCHASE MODAL */}
      {isApproveModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      ตรวจสอบและอนุมัติการซื้อวัตถุดิบ
                    </h3>
                    <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      {selectedRequisition.requisitionNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ร้านค้าผู้ซื้อ: <strong className="text-slate-800">{selectedRequisition.store.name}</strong> (@{selectedRequisition.store.username})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Info Notice */}
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                เมื่อกดยืนยันอนุมัติ ระบบจะบันทึกยอดวัตถุดิบรับเข้าสต็อกของร้าน <strong>{selectedRequisition.store.name}</strong> ทันที เพื่อนำไปใช้ตัดขายผ่านระบบ POS
              </span>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>รายการวัตถุดิบที่ร้านซื้อมา ({selectedRequisition.items.length} รายการ)</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  ตรวจสอบจำนวนที่ซื้อเข้าและยอดสต็อกหลังอนุมัติ
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">วัตถุดิบ</th>
                      <th className="py-2.5 px-3 text-right">สต็อกเดิมที่ร้านมี</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่ซื้อเข้า</th>
                      <th className="py-2.5 px-3 text-right">สต็อกหลังอนุมัติ</th>
                      <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                      <th className="py-2.5 px-3 text-right">รวมเงิน (฿)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequisition.items.map((item) => {
                      const costPerUnit = Number(item.ingredient.costPerUnit || 0);
                      const purchasedQty = Number(item.requestedQty || 0);
                      const storeStockBefore = getStoreStock(selectedRequisition.store.id, item.ingredientId);
                      const storeStockAfter = storeStockBefore + purchasedQty;
                      const lineTotal = purchasedQty * costPerUnit;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          {/* Ingredient Name & Code */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.ingredient.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{item.ingredient.code}</span>
                              {item.ingredient.category && (
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px]">
                                  {item.ingredient.category}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* In-Store Stock Before Purchase */}
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            <span className="font-bold">{storeStockBefore.toLocaleString()}</span>{' '}
                            <span className="text-[10px] text-slate-400">{item.ingredient.unit}</span>
                          </td>

                          {/* Purchased Quantity (Fixed / Non-editable) */}
                          <td className="py-3 px-3 text-right">
                            <span className="inline-flex items-center gap-1 font-mono font-black text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <span>+{purchasedQty.toLocaleString()}</span>
                              <span className="text-[10px] font-medium text-emerald-600">{item.ingredient.unit}</span>
                            </span>
                          </td>

                          {/* Stock After Approval */}
                          <td className="py-3 px-3 text-right font-mono text-emerald-700 bg-emerald-50/30">
                            <span className="font-black text-xs">
                              {storeStockAfter.toLocaleString()}
                            </span>{' '}
                            <span className="text-[10px] text-slate-400">{item.ingredient.unit}</span>
                          </td>

                          {/* Cost Per Unit */}
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            ฿{costPerUnit.toFixed(2)}
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ฿{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Footer with Total ฿ */}
                  <tfoot className="bg-slate-50/90 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-right font-bold text-slate-700">
                        รวมยอดเงินขอเบิกซื้อทั้งสิ้น:
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 text-sm">
                        ฿{approveModalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังดำเนินการ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ยืนยันอนุมัติการซื้อ (เพิ่มเข้าสต็อกร้าน)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-black text-slate-900">ปฏิเสธใบขอซื้อวัตถุดิบ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">
                {actionError}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
              <div>
                <span className="text-slate-400">เลขที่ใบขอซื้อ:</span>{' '}
                <strong className="text-slate-800 font-mono">{selectedRequisition.requisitionNumber}</strong>
              </div>
              <div>
                <span className="text-slate-400">ร้านค้า:</span>{' '}
                <strong className="text-slate-800">{selectedRequisition.store.name}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                เหตุผลที่ไม่อนุมัติการซื้อ <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="ระบุเหตุผล เช่น ใบเสร็จไม่ชัดเจน, ซื้อซ้ำซ้อน, เกินงบที่กำหนด"
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isProcessing || !rejectReasonInput.trim()}
                className="px-5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Available for all statuses) */}
      {isDetailModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {selectedRequisition.requisitionNumber}
                  </span>
                  <h3 className="text-base font-black text-slate-900">รายละเอียดใบขอซื้อวัตถุดิบ</h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ร้านค้า: {selectedRequisition.store.name} (@{selectedRequisition.store.username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-semibold text-[11px]">ร้านค้า:</span>
                <p className="font-bold text-slate-800">{selectedRequisition.store.name}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold text-[11px]">วันที่ส่งคำขอ:</span>
                <p className="font-bold text-slate-800">
                  {new Date(selectedRequisition.createdAt).toLocaleString('th-TH', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })} น.
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold text-[11px]">ผู้อนุมัติ:</span>
                <p className="font-bold text-slate-800">{selectedRequisition.approvedBy?.name || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold text-[11px]">สถานะ:</span>
                <div className="mt-0.5">
                  {selectedRequisition.status === 'PENDING' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      รออนุมัติการซื้อ
                    </span>
                  )}
                  {selectedRequisition.status === 'APPROVED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      อนุมัติแล้ว
                    </span>
                  )}
                  {selectedRequisition.status === 'REJECTED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      ไม่อนุมัติ
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Reason / Note */}
            {selectedRequisition.reason && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">วัตถุประสงค์:</span>{' '}
                <span className="text-slate-800">{selectedRequisition.reason}</span>
                {selectedRequisition.note && (
                  <div className="mt-1 text-slate-500 text-[11px]">
                    <span className="font-semibold">หมายเหตุ:</span> {selectedRequisition.note}
                  </div>
                )}
              </div>
            )}

            {/* Reject Reason (if any) */}
            {selectedRequisition.rejectReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span className="font-bold">เหตุผลที่ไม่อนุมัติ:</span> {selectedRequisition.rejectReason}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">รายการวัตถุดิบ ({selectedRequisition.items.length} รายการ)</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">รหัส/ชื่อวัตถุดิบ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่ขอซื้อ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่อนุมัติ</th>
                      <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                      <th className="py-2.5 px-3 text-right">รวมเงิน (฿)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequisition.items.map((item) => {
                      const cost = Number(item.ingredient.costPerUnit || 0);
                      const finalQty = Number(selectedRequisition.status === 'APPROVED' && item.approvedQty !== null ? item.approvedQty : item.requestedQty);
                      const lineTotal = finalQty * cost;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
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
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ฿{cost.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ฿{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50/90 border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right font-bold text-slate-700">
                        ยอดเงินรวมทั้งสิ้น:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800 text-xs">
                        ฿{computeRequisitionTotal(selectedRequisition).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {selectedRequisition.status === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenApproveModal(selectedRequisition);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ไปที่หน้าอนุมัติการซื้อ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenRejectModal(selectedRequisition);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
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

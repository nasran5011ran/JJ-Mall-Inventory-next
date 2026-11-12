'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  X,
  FileText,
  Printer,
  Store,
  Warehouse,
  AlertCircle,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';

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
  const [approvalItems, setApprovalItems] = useState<Array<{ id: number; approvedQty: string }>>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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

  // Pagination
  const totalPages = Math.ceil(filteredRequisitions.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequisitions.slice(start, start + pageSize);
  }, [filteredRequisitions, currentPage, pageSize]);

  // Open Approve Modal
  const handleOpenApproveModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setApprovalItems(
      req.items.map((it) => ({
        id: it.id,
        approvedQty: String(it.requestedQty),
      }))
    );
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

  // Confirm Approval (Fulfill & Transfer)
  const handleConfirmApproval = async () => {
    if (!selectedRequisition) return;
    setActionError(null);

    try {
      setIsProcessing(true);
      const res = await fetch('/api/stock-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          action: 'APPROVE',
          items: approvalItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'อนุมัติไม่สำเร็จ');
      }

      showToast(json.message || 'อนุมัติและโอนวัตถุดิบเข้าหน้าร้านเรียบร้อยแล้ว');
      setIsApproveModalOpen(false);
      mutate();
    } catch (e: any) {
      setActionError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Rejection
  const handleConfirmRejection = async () => {
    if (!selectedRequisition) return;
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

      showToast(json.message || 'ปฏิเสธใบขอเบิกสต็อกเรียบร้อยแล้ว');
      setIsRejectModalOpen(false);
      mutate();
    } catch (e: any) {
      setActionError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
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
              <ArrowUpFromLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">อนุมัติเบิกซื้อวัตถุดิบ</h1>
              <p className="text-xs text-slate-500">
                ตรวจสอบคำขอเบิกเงินซื้อวัตถุดิบของร้านค้าสาขา (อนุมัติแล้วยอดสต็อกจะเพิ่มเข้าร้านค้าทันที)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
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
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">คำขอทั้งหมด</span>
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
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">รออนุมัติ (ต้องดำเนินการ)</span>
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
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">อนุมัติและโอนแล้ว</span>
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

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่, ชื่อร้าน, วัตถุดิบ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Store Filter */}
          <select
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">🏪 ทุกร้านค้า / จุดขาย</option>
            {staffStores.map((st) => (
              <option key={st.id} value={String(st.id)}>
                🏪 {st.name} (@{st.username})
              </option>
            ))}
          </select>
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
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === st
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

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading && requisitions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
        ) : paginatedList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">ไม่พบใบขอเบิกสต็อก</p>
            <p className="text-[11px] text-slate-400">ยังไม่มีคำขอเบิกสต็อกที่ตรงกับเงื่อนไขการค้นหา</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                  <th className="py-3 px-4">เลขที่ใบขอเบิก</th>
                  <th className="py-3 px-3">ร้านค้าที่ขอเบิก</th>
                  <th className="py-3 px-3">วันที่ส่งคำขอ</th>
                  <th className="py-3 px-3">วัตถุประสงค์</th>
                  <th className="py-3 px-3 text-center">รายการ</th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-center">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedList.map((req, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Sequence Row Number */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                        {rowNumber}
                      </td>
                      <td className="py-3 px-4">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        {req.requisitionNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{req.store.name}</div>
                      <div className="text-[10px] text-slate-400">@{req.store.username}</div>
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
                      <div className="font-bold text-slate-800">{req.reason || '-'}</div>
                      {req.note && <div className="text-[10px] text-slate-400 truncate max-w-xs">{req.note}</div>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-800">{req.items.length}</span>{' '}
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
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {req.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => handleOpenApproveModal(req)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>อนุมัติ & โอนของ</span>
                            </button>
                            <button
                              onClick={() => handleOpenRejectModal(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer"
                            >
                              ปฏิเสธ
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedRequisition(req);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                          >
                            ดูรายละเอียด
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

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              แสดงหน้า {currentPage} จาก {totalPages}
            </span>
            <Pagination currentPage={currentPage} totalItems={filteredRequisitions.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      {/* APPROVE & FULFILL MODAL */}
      {isApproveModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded-md">
                  {selectedRequisition.requisitionNumber}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">อนุมัติเบิกซื้อวัตถุดิบ</h3>
                <p className="text-[11px] text-slate-500">
                  อนุมัติซื้อให้ร้าน: <strong>{selectedRequisition.store.name}</strong> (@{selectedRequisition.store.username})
                </p>
              </div>
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                เมื่อกดยืนยัน ระบบจะอนุมัติงบเบิกซื้อและเพิ่มยอดสต็อกวัตถุดิบให้กับหน้าร้านนี้ทันที พร้อมขายผ่าน POS
              </span>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">ตรวจสอบรายการและจำนวนที่อนุมัติซื้อ</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">วัตถุดิบ</th>
                      <th className="py-2.5 px-3 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-2.5 px-3 text-right">ร้านขอซื้อ</th>
                      <th className="py-2.5 px-3 text-right w-36">จำนวนที่อนุมัติซื้อ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequisition.items.map((item, idx) => {
                      const costPerUnit = Number(item.ingredient.costPerUnit || 0);
                      const currentApproved = approvalItems.find((it) => it.id === item.id)?.approvedQty || '0';

                      return (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{item.ingredient.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.ingredient.code}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ฿{costPerUnit.toFixed(2)}/{item.ingredient.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {Number(item.requestedQty).toLocaleString()} {item.ingredient.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={currentApproved}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setApprovalItems((prev) =>
                                    prev.map((it) => (it.id === item.id ? { ...it, approvedQty: val } : it))
                                  );
                                }}
                                className="w-24 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white text-right text-xs font-bold"
                              />
                              <span className="text-[11px] font-semibold text-slate-500 w-8 text-left">
                                {item.ingredient.unit}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังดำเนินการ...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ยืนยันอนุมัติเบิกซื้อ & เพิ่มสต็อก</span>
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
              <h3 className="text-base font-black text-slate-900">ปฏิเสธใบขอเบิกสต็อก</h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เหตุผลที่ไม่อนุมัติ</label>
              <textarea
                rows={3}
                required
                placeholder="ระบุเหตุผล เช่น ของในคลังกลางขาดแคลน, ขอให้สั่งซื้อใหม่"
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded-md">
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
                <span className="text-slate-400 font-semibold">ผู้อนุมัติ:</span>
                <p className="font-bold text-slate-800">{selectedRequisition.approvedBy?.name || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">สถานะ:</span>
                <div className="mt-0.5">
                  {selectedRequisition.status === 'PENDING' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      รออนุมัติ
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
              <h4 className="text-xs font-bold text-slate-700 mb-2">รายการวัตถุดิบ</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">รหัส/ชื่อวัตถุดิบ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่ขอ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนที่อนุมัติ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRequisition.items.map((item) => (
                      <tr key={item.id}>
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
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
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

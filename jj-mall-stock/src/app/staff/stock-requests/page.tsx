'use client';

import React, { useState, useMemo } from 'react';
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

  const metrics = swrData?.metrics || {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
  };

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Request Form State
  const [formReason, setFormReason] = useState('ขอเบิกวัตถุดิบเข้าหน้าร้าน');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<Array<{ ingredientId: number; requestedQty: string }>>([
    { ingredientId: 0, requestedQty: '' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered List
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        req.requisitionNumber.toLowerCase().includes(q) ||
        (req.reason && req.reason.toLowerCase().includes(q)) ||
        req.items.some((it) => it.ingredient.name.toLowerCase().includes(q) || it.ingredient.code.toLowerCase().includes(q));

      return matchStatus && matchSearch;
    });
  }, [requisitions, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRequisitions.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequisitions.slice(start, start + pageSize);
  }, [filteredRequisitions, currentPage, pageSize]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormReason('ขอเบิกวัตถุดิบเข้าหน้าร้าน');
    setFormNote('');
    setFormItems([{ ingredientId: ingredients[0]?.id || 0, requestedQty: '' }]);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Form Row Handlers
  const handleAddItemRow = () => {
    setFormItems((prev) => [...prev, { ingredientId: ingredients[0]?.id || 0, requestedQty: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

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

    // Validate
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
            <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-700">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">ใบขอเบิกสต็อกวัตถุดิบ</h1>
              <p className="text-xs text-slate-500">
                ส่งคำขอเบิกวัตถุดิบจากคลังสินค้าส่วนกลางเข้าสู่หน้าร้านของคุณ ({user?.name})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-sky-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ สร้างใบขอเบิกใหม่</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'ALL' ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200 hover:border-slate-300'
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
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-amber-300'
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
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300'
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
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
            statusFilter === 'REJECTED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 hover:border-rose-300'
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
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
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

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading && requisitions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">กำลังโหลดข้อมูล...</div>
        ) : paginatedList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">ไม่พบรายการใบขอเบิกสต็อก</p>
            <p className="text-[11px] text-slate-400">คุณสามารถกดปุ่ม "+ สร้างใบขอเบิกใหม่" เพื่อขอสต็อกวัตถุดิบเข้าหน้าร้านได้ทันที</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
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
                {paginatedList.map((req) => {
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
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
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                          >
                            ดูรายละเอียด
                          </button>

                          {req.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelRequisition(req.id)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
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
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              แสดงหน้า {currentPage} จาก {totalPages}
            </span>
            <Pagination currentPage={currentPage} totalItems={filteredRequisitions.length} pageSize={pageSize} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      {/* CREATE MODAL: Create New Stock Request */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">สร้างใบขอเบิกสต็อกใหม่</h3>
                  <p className="text-[11px] text-slate-500">ขอเบิกวัตถุดิบจากคลังสินค้าส่วนกลางเข้าสู่หน้าร้าน</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRequisition} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เหตุผล / วัตถุประสงค์</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ขอเบิกสต็อกเปิดร้านใหม่, เติมสต็อกประจำสัปดาห์"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="ระบุเพิ่มเติม เช่น ขอด่วนก่อนเที่ยง"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">รายการวัตถุดิบที่ต้องการขอเบิก</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มรายการ</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formItems.map((item, idx) => {
                    const selectedIng = ingredients.find((i) => i.id === Number(item.ingredientId));
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2.5"
                      >
                        <div className="flex-1 w-full sm:w-auto">
                          <select
                            value={item.ingredientId}
                            onChange={(e) => handleItemChange(idx, 'ingredientId', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          >
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.code} - {ing.name} (ในคลังกลางมี: {ing.warehouseStock.toLocaleString()} {ing.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-48">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            required
                            placeholder="จำนวน"
                            value={item.requestedQty}
                            onChange={(e) => handleItemChange(idx, 'requestedQty', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                          <span className="text-xs font-semibold text-slate-500 shrink-0 w-12 text-left">
                            {selectedIng?.unit || 'หน่วย'}
                          </span>

                          {formItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่งคำขอ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>ส่งใบขอเบิกสต็อก</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & PRINT MODAL */}
      {isDetailModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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

            {/* Info Grid */}
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

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">รายการวัตถุดิบ ({selectedRequisition.items.length} รายการ)</h4>
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

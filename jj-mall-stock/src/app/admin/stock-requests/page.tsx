'use client';

import React, { useState, useMemo, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  X,
  FileText,
  Store,
  AlertCircle,
  Check,
  Eye,
  ShoppingCart,
  AlertTriangle,
  Printer,
  PackageCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';
import { showSuccessAlert, showErrorAlert, confirmRejectAlert } from '@/lib/sweetalert';

interface IngredientMaster {
  id: number;
  code: string;
  name: string;
  unit: string;
  category?: string | null;
  costPerUnit?: number;
  warehouseStock?: number;
}

interface RequisitionItem {
  id: number;
  ingredientId: number;
  requestedQty: number;
  approvedQty: number | null;
  receivedQty?: number | null;
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
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  rejectReason: string | null;
  receiveNote?: string | null;
  createdAt: string;
  approvedAt: string | null;
  receivedAt?: string | null;
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

interface ReceiveFormItem {
  id?: number;
  ingredientId: number;
  requestedQty: number;
  approvedQty: number;
  receivedQty: string;
}

export default function AdminStockRequestsPage() {
  const { user } = useAuth();
  const { mutate: globalMutate } = useSWRConfig();

  // SWR for realtime requests
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-requests', {
    refreshInterval: 4000,
    revalidateOnFocus: true,
  });

  const requisitions: RequisitionRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.requisitions) ? swrData.requisitions : [];
  }, [swrData]);

  const allIngredients: IngredientMaster[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
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

  // Helper to get effective quantity for a requisition item depending on status
  const getItemEffectiveQty = (req: RequisitionRecord, it: RequisitionItem): number => {
    if (req.status === 'COMPLETED' && it.receivedQty !== null && it.receivedQty !== undefined) {
      return Number(it.receivedQty);
    }
    if ((req.status === 'APPROVED' || req.status === 'COMPLETED') && it.approvedQty !== null) {
      return Number(it.approvedQty);
    }
    return Number(it.requestedQty || 0);
  };

  // Helper to compute total requisition cost (฿)
  const computeRequisitionTotal = (req: RequisitionRecord): number => {
    return req.items.reduce((sum, it) => {
      const qty = getItemEffectiveQty(req, it);
      const cost = Number(it.ingredient?.costPerUnit || 0);
      return sum + qty * cost;
    }, 0);
  };

  const metrics = swrData?.metrics || {
    pendingCount: 0,
    approvedCount: 0,
    completedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
  };

  // Filter & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals State
  const [selectedRequisition, setSelectedRequisition] = useState<RequisitionRecord | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveItems, setApproveItems] = useState<Array<{ id: number; approvedQty: string }>>([]);

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<ReceiveFormItem[]>([]);
  const [receiveNote, setReceiveNote] = useState('');

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Print Modals State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printRecord, setPrintRecord] = useState<RequisitionRecord | null>(null);
  const [printListModalOpen, setPrintListModalOpen] = useState(false);
  const [printListStatus, setPrintListStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'>('ALL');

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

  const printRequisitions = useMemo(() => {
    return filteredRequisitions.filter((req) => printListStatus === 'ALL' || req.status === printListStatus);
  }, [filteredRequisitions, printListStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, storeFilter, searchTerm]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequisitions.slice(start, start + pageSize);
  }, [filteredRequisitions, currentPage, pageSize]);

  // STEP 1: Open Approve Modal (Approve to buy, before recording into stock)
  const handleOpenApproveModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setApproveItems(
      req.items.map((it) => ({
        id: it.id,
        approvedQty: String(Number(it.approvedQty ?? it.requestedQty)),
      }))
    );
    setActionError(null);
    setIsApproveModalOpen(true);
  };

  // STEP 1 Confirm: Approve Requisition (No stock added yet)
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
          items: approveItems.map((it) => ({
            id: it.id,
            approvedQty: parseFloat(it.approvedQty) || 0,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'อนุมัติคำขอซื้อไม่สำเร็จ');
      }

      setIsApproveModalOpen(false);
      await mutate();
      globalMutate('/api/notifications');
      await showSuccessAlert(
        'อนุมัติคำขอซื้อสำเร็จ',
        `อนุมัติใบขอเบิกซื้อ ${selectedRequisition.requisitionNumber} แล้ว (เมื่อร้านค้าซื้อของเสร็จ กรุณากดปุ่ม "บันทึกเข้าสต็อก")`
      );
    } catch (e: any) {
      setActionError(e.message || 'เกิดข้อผิดพลาด');
      await showErrorAlert('อนุมัติไม่สำเร็จ', e.message || 'เกิดข้อผิดพลาดในการอนุมัติ');
    } finally {
      setIsProcessing(false);
    }
  };

  // STEP 2: Open Receive & Record into Stock Modal (Edit actual purchased items & quantities before recording!)
  const handleOpenReceiveModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setReceiveItems(
      req.items.map((it) => {
        const defaultQty = Number(it.approvedQty ?? it.requestedQty);
        return {
          id: it.id,
          ingredientId: it.ingredientId,
          requestedQty: Number(it.requestedQty),
          approvedQty: defaultQty,
          receivedQty: String(defaultQty),
        };
      })
    );
    setReceiveNote('');
    setActionError(null);
    setIsReceiveModalOpen(true);
  };

  const handleAddReceiveItemRow = () => {
    const unusedIng =
      allIngredients.find((ing) => !receiveItems.some((ri) => ri.ingredientId === ing.id)) || allIngredients[0];
    if (!unusedIng) return;
    setReceiveItems((prev) => [
      ...prev,
      {
        ingredientId: unusedIng.id,
        requestedQty: 0,
        approvedQty: 0,
        receivedQty: '1',
      },
    ]);
  };

  const handleRemoveReceiveItemRow = (index: number) => {
    if (receiveItems.length <= 1) {
      // Instead of removing the last row, set its quantity to 0
      setReceiveItems((prev) => prev.map((it, i) => (i === index ? { ...it, receivedQty: '0' } : it)));
      return;
    }
    setReceiveItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateReceiveItem = (index: number, field: 'ingredientId' | 'receivedQty', value: any) => {
    setReceiveItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // STEP 2 Confirm: Record actual purchased items into store stock
  const handleConfirmReceiveStock = async () => {
    if (!selectedRequisition) return;
    setActionError(null);

    const hasPositiveItem = receiveItems.some((it) => (parseFloat(it.receivedQty) || 0) > 0);
    if (!hasPositiveItem) {
      setActionError('กรุณาระบุจำนวนที่ซื้อจริงอย่างน้อย 1 รายการ (ต้องมากกว่า 0)');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await fetch('/api/stock-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId: selectedRequisition.id,
          action: 'RECEIVE',
          receiveNote,
          items: receiveItems.map((it) => ({
            id: it.id,
            ingredientId: Number(it.ingredientId),
            receivedQty: Math.max(0, parseFloat(it.receivedQty) || 0),
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'บันทึกวัตถุดิบเข้าสต็อกไม่สำเร็จ');
      }

      setIsReceiveModalOpen(false);
      await mutate();
      globalMutate('/api/ingredients');
      globalMutate('/api/products');
      globalMutate('/api/notifications');
      await showSuccessAlert(
        'บันทึกเข้าสต็อกสำเร็จ',
        `บันทึกยอดวัตถุดิบที่ซื้อจริงจากใบขอ ${selectedRequisition.requisitionNumber} เข้าสต็อกร้าน "${selectedRequisition.store.name}" เรียบร้อยแล้ว`
      );
    } catch (e: any) {
      setActionError(e.message || 'เกิดข้อผิดพลาด');
      await showErrorAlert('บันทึกเข้าสต็อกไม่สำเร็จ', e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject Requisition
  const handleRejectRequisition = async (req: RequisitionRecord) => {
    const { isConfirmed, reason } = await confirmRejectAlert({
      requisitionNumber: req.requisitionNumber,
      storeName: req.store.name,
    });
    if (!isConfirmed) return;

    try {
      setIsProcessing(true);
      const res = await fetch('/api/stock-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requisitionId: req.id,
          action: 'REJECT',
          rejectReason: reason || 'ไม่อนุมัติ',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'ปฏิเสธไม่สำเร็จ');
      }

      mutate();
      globalMutate('/api/notifications');
      await showSuccessAlert(
        'ปฏิเสธข้อมูลสำเร็จ',
        `ปฏิเสธใบขอซื้อ "${req.requisitionNumber}" เรียบร้อยแล้ว`
      );
    } catch (err: any) {
      await showErrorAlert('เกิดข้อผิดพลาดในการปฏิเสธ', err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDetailModal = (req: RequisitionRecord) => {
    setSelectedRequisition(req);
    setIsDetailModalOpen(true);
  };

  const handleOpenPrintSingle = (req: RequisitionRecord) => {
    setPrintRecord(req);
    setPrintModalOpen(true);
  };

  // Calculation for approve modal total amount
  const approveModalTotal = useMemo(() => {
    if (!selectedRequisition) return 0;
    return selectedRequisition.items.reduce((sum, item) => {
      const appObj = approveItems.find((a) => a.id === item.id);
      const qty = appObj ? parseFloat(appObj.approvedQty) || 0 : Number(item.requestedQty || 0);
      const cost = Number(item.ingredient?.costPerUnit || 0);
      return sum + qty * cost;
    }, 0);
  }, [selectedRequisition, approveItems]);

  // Calculation for receive modal total amount
  const receiveModalTotal = useMemo(() => {
    return receiveItems.reduce((sum, item) => {
      const ing = allIngredients.find((i) => i.id === Number(item.ingredientId));
      const qty = Math.max(0, parseFloat(item.receivedQty) || 0);
      const cost = Number(ing?.costPerUnit || 0);
      return sum + qty * cost;
    }, 0);
  }, [receiveItems, allIngredients]);

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            ขั้นตอนที่ 1: อนุมัติคำขอให้ร้านไปซื้อ • ขั้นตอนที่ 2: ตรวจสอบ/แก้ไขของที่ซื้อจริงแล้วกดบันทึกเข้าสต็อก
          </p>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={() => {
                setPrintListStatus(statusFilter);
                setPrintListModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="พิมพ์รายงานสรุปใบขอเบิกทั้งหมด"
            >
              <Printer className="w-4 h-4 text-sky-600" />
              <span>พิมพ์สรุปใบขอทั้งหมด</span>
            </button>

            <button
              onClick={() => mutate()}
              disabled={isValidating}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>

        {/* 5 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
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
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">1. รออนุมัติคำขอ</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {metrics.pendingCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('APPROVED')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
              statusFilter === 'APPROVED' ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200 hover:border-sky-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">2. อนุมัติแล้ว (รอบันทึกสต็อก)</span>
              <ShoppingCart className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-sky-700 mt-1">
              {metrics.approvedCount} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('COMPLETED')}
            className={`p-4 rounded-3xl border transition-all cursor-pointer bg-white shadow-2xs ${
              statusFilter === 'COMPLETED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">3. บันทึกเข้าสต็อกแล้ว</span>
              <PackageCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {metrics.completedCount || 0} <span className="text-xs font-semibold text-slate-500">ฉบับ</span>
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
              const pendingCountForStore = requisitions.filter(
                (r) => r.store.id === st.id && (r.status === 'PENDING' || r.status === 'APPROVED')
              ).length;
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
            {(['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'] as const).map((st) => {
              const labels = {
                ALL: 'ทั้งหมด',
                PENDING: '1. รออนุมัติคำขอ',
                APPROVED: '2. รอบันทึกเข้าสต็อก',
                COMPLETED: '3. บันทึกเข้าสต็อกแล้ว',
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
                    <th className="py-3.5 px-3 whitespace-nowrap">ร้านค้าที่ขอ</th>
                    <th className="py-3.5 px-3">รายการวัตถุดิบ</th>
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
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                          {rowNumber}
                        </td>

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

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            <span>{req.store.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            @{req.store.username}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {req.items.slice(0, 2).map((it, itemIdx) => {
                              const qty = getItemEffectiveQty(req, it);
                              const isShort =
                                req.status === 'COMPLETED' &&
                                it.receivedQty !== null &&
                                it.receivedQty !== undefined &&
                                Number(it.receivedQty) < Number(it.approvedQty ?? it.requestedQty);
                              return (
                                <span
                                  key={it.id}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border text-xs shadow-2xs transition-colors ${
                                    isShort ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/90 text-slate-800'
                                  }`}
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
                              >
                                <span>+{req.items.length - 2} รายการ</span>
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 text-xs whitespace-nowrap">
                          ฿{totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-3.5 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleString('th-TH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })} น.
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {req.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              รออนุมัติคำขอ
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              <ShoppingCart className="w-3 h-3 text-sky-600" />
                              อนุมัติแล้ว (รอบันทึกสต็อก)
                            </span>
                          )}
                          {req.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <PackageCheck className="w-3 h-3 text-emerald-600" />
                              บันทึกเข้าสต็อกแล้ว
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
                            {/* Print Request Button (Always available!) */}
                            <button
                              type="button"
                              onClick={() => handleOpenPrintSingle(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="พิมพ์ใบขอเบิกซื้อวัตถุดิบ"
                            >
                              <Printer className="w-3.5 h-3.5 text-sky-600" />
                              <span>พิมพ์ใบขอ</span>
                            </button>

                            {req.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenApproveModal(req)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                                  title="ขั้นตอนที่ 1: อนุมัติให้ร้านไปซื้อ (ยังไม่บันทึกเข้าสต็อก)"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>อนุมัติให้ไปซื้อ</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRejectRequisition(req)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                                  title="ปฏิเสธคำขอซื้อ"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  <span>ปฏิเสธ</span>
                                </button>
                              </>
                            )}

                            {req.status === 'APPROVED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(req)}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
                                title="ขั้นตอนที่ 2: แก้ไขจำนวนที่ซื้อได้จริง แล้วกดยืนยันบันทึกเข้าสต็อก"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>📦 บันทึกเข้าสต็อก</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(req)}
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center justify-center cursor-pointer"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredRequisitions.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRequisitions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL 1: STEP 1 - APPROVE REQUISITION TO BUY (Not added to stock yet!)    */}
        {/* ========================================================================= */}
        {isApproveModalOpen && selectedRequisition && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        ขั้นตอนที่ 1: อนุมัติคำขอให้ร้านไปซื้อวัตถุดิบ
                      </h3>
                      <span className="font-mono font-bold text-amber-800 text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {selectedRequisition.requisitionNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ร้านค้าผู้ขอ: <strong className="text-slate-800">{selectedRequisition.store.name}</strong> (@{selectedRequisition.store.username})
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

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">หมายเหตุ: การอนุมัติในขั้นตอนนี้จะยังไม่บวกวัตถุดิบเข้าสต็อกทันที</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    เมื่อร้านค้าไปซื้อของกลับมาแล้ว แอดมินสามารถกดปุ่ม <strong>&ldquo;📦 บันทึกเข้าสต็อก&rdquo;</strong> เพื่อตรวจสอบและแก้ไขจำนวนที่ซื้อได้จริงก่อนยืนยันเข้าสต็อก
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>รายการวัตถุดิบที่ขออนุมัติซื้อ ({selectedRequisition.items.length} รายการ)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">สามารถปรับจำนวนที่อนุมัติให้ซื้อได้</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10 text-slate-400">#</th>
                        <th className="py-2.5 px-3">วัตถุดิบ</th>
                        <th className="py-2.5 px-3 text-right">สต็อกเดิมที่ร้าน</th>
                        <th className="py-2.5 px-3 text-right">จำนวนที่ขอซื้อ</th>
                        <th className="py-2.5 px-3 text-right w-36">จำนวนที่อนุมัติให้ซื้อ</th>
                        <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                        <th className="py-2.5 px-3 text-right">รวมเงิน (฿)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRequisition.items.map((item, idx) => {
                        const costPerUnit = Number(item.ingredient.costPerUnit || 0);
                        const reqQty = Number(item.requestedQty || 0);
                        const appObj = approveItems.find((a) => a.id === item.id);
                        const appQtyStr = appObj ? appObj.approvedQty : String(reqQty);
                        const appQty = parseFloat(appQtyStr) || 0;
                        const storeStockBefore = getStoreStock(selectedRequisition.store.id, item.ingredientId);
                        const lineTotal = appQty * costPerUnit;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{item.ingredient.name}</div>
                              <div className="text-[10px] font-mono text-slate-400">{item.ingredient.code}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">
                              {storeStockBefore.toLocaleString()} {item.ingredient.unit}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                              {reqQty.toLocaleString()} {item.ingredient.unit}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={appQtyStr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setApproveItems((prev) =>
                                      prev.map((p) => (p.id === item.id ? { ...p, approvedQty: val } : p))
                                    );
                                  }}
                                  className="w-20 px-2 py-1 text-right font-mono font-bold text-xs rounded-lg border border-amber-300 bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                />
                                <span className="text-[10px] text-slate-500">{item.ingredient.unit}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">
                              ฿{costPerUnit.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ฿{lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200">
                      <tr>
                        <td colSpan={6} className="py-3 px-3 text-right font-bold text-slate-700">
                          รวมวงเงินที่อนุมัติให้ไปซื้อ:
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-amber-800 text-sm">
                          ฿{approveModalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleOpenPrintSingle(selectedRequisition)}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-sky-600" />
                  <span>พิมพ์ใบขอเบิก</span>
                </button>

                <div className="flex items-center gap-2.5">
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
                    className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังอนุมัติ...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>ยืนยันอนุมัติให้ไปซื้อ (ยังไม่เข้าสต็อก)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: STEP 2 - RECEIVE & RECORD ACTUAL PURCHASED ITEMS INTO STOCK      */}
        {/* ========================================================================= */}
        {isReceiveModalOpen && selectedRequisition && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        ขั้นตอนที่ 2: ตรวจรับและบันทึกวัตถุดิบที่ซื้อจริงเข้าสต็อก
                      </h3>
                      <span className="font-mono font-bold text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {selectedRequisition.requisitionNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ร้านค้า: <strong className="text-slate-800">{selectedRequisition.store.name}</strong> (@{selectedRequisition.store.username})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Helpful Guide Banner */}
              <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">สามารถแก้ไขรายการวัตถุดิบและจำนวนที่ซื้อได้จริงก่อนกดยืนยันบันทึกเข้าสต็อก</span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    • กรณีซื้อวัตถุดิบไม่ครบตามที่ขอ สามารถปรับลดตัวเลขในช่อง <strong>&ldquo;จำนวนที่ซื้อจริง&rdquo;</strong> ได้ทันที (หรือใส่ 0 / ลบแถวหากไม่ได้ซื้อ)<br />
                    • กรณีซื้อวัตถุดิบตัวอื่นแทนหรือซื้อเพิ่ม สามารถเปลี่ยนวัตถุดิบในแถว หรือกดปุ่ม <strong>&ldquo;+ เพิ่มวัตถุดิบที่ซื้อเพิ่ม&rdquo;</strong> ได้เลย
                  </p>
                </div>
              </div>

              {/* Editable Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>รายการวัตถุดิบที่จะบันทึกเข้าสต็อก ({receiveItems.length} รายการ)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddReceiveItemRow}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มวัตถุดิบที่ซื้อเพิ่ม</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-2.5 text-center w-9 text-slate-400">#</th>
                        <th className="py-2.5 px-2.5">เลือก/แก้ไขวัตถุดิบ</th>
                        <th className="py-2.5 px-2.5 text-right">สต็อกเดิมที่ร้าน</th>
                        <th className="py-2.5 px-2.5 text-right">ยอดที่ขอ/อนุมัติ</th>
                        <th className="py-2.5 px-2.5 text-right w-40">จำนวนที่ซื้อจริง (แก้ไขได้)</th>
                        <th className="py-2.5 px-2.5 text-right">สต็อกหลังบันทึก</th>
                        <th className="py-2.5 px-2.5 text-right">รวมเงินจริง (฿)</th>
                        <th className="py-2.5 px-2 text-center w-10">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receiveItems.map((item, idx) => {
                        const selectedIng = allIngredients.find((i) => i.id === Number(item.ingredientId));
                        const unit = selectedIng?.unit || 'หน่วย';
                        const costPerUnit = Number(selectedIng?.costPerUnit || 0);
                        const storeStockBefore = getStoreStock(selectedRequisition.store.id, Number(item.ingredientId));
                        const receivedNum = Math.max(0, parseFloat(item.receivedQty) || 0);
                        const storeStockAfter = storeStockBefore + receivedNum;
                        const lineTotal = receivedNum * costPerUnit;
                        const isDiffFromApproved = item.approvedQty > 0 && receivedNum !== item.approvedQty;

                        return (
                          <tr key={idx} className={isDiffFromApproved ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}>
                            <td className="py-2.5 px-2.5 text-center text-slate-400 font-mono text-[11px] font-bold">
                              {idx + 1}
                            </td>

                            {/* Editable Ingredient Select */}
                            <td className="py-2.5 px-2.5">
                              <select
                                value={item.ingredientId}
                                onChange={(e) => handleUpdateReceiveItem(idx, 'ingredientId', Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                              >
                                {allIngredients.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.code}) — ฿{Number(ing.costPerUnit || 0).toFixed(2)}/{ing.unit}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Store Stock Before */}
                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-600 whitespace-nowrap">
                              {storeStockBefore.toLocaleString()} <span className="text-[10px] text-slate-400">{unit}</span>
                            </td>

                            {/* Requested / Approved Qty */}
                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                              {item.approvedQty > 0 ? (
                                <span>{item.approvedQty.toLocaleString()} {unit}</span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-sans font-bold">ซื้อเพิ่มใหม่</span>
                              )}
                            </td>

                            {/* Actual Received Quantity Input */}
                            <td className="py-2.5 px-2.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.receivedQty}
                                  onChange={(e) => handleUpdateReceiveItem(idx, 'receivedQty', e.target.value)}
                                  className={`w-24 px-2.5 py-1.5 text-right font-mono font-black text-xs rounded-xl border-2 focus:outline-none focus:ring-2 ${
                                    isDiffFromApproved
                                      ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500/20'
                                      : 'border-emerald-500 bg-emerald-50/40 text-emerald-900 focus:ring-emerald-500/20'
                                  }`}
                                />
                                <span className="text-[11px] font-semibold text-slate-600">{unit}</span>
                              </div>
                              {isDiffFromApproved && (
                                <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                                  {receivedNum < item.approvedQty
                                    ? `ซื้อขาด ${(item.approvedQty - receivedNum).toLocaleString()} ${unit}`
                                    : `ซื้อเกิน +${(receivedNum - item.approvedQty).toLocaleString()} ${unit}`}
                                </div>
                              )}
                            </td>

                            {/* Store Stock After */}
                            <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700 bg-emerald-50/30 whitespace-nowrap">
                              <span className="font-black text-xs">{storeStockAfter.toLocaleString()}</span>{' '}
                              <span className="text-[10px] text-slate-400">{unit}</span>
                            </td>

                            {/* Line Total */}
                            <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              ฿{lineTotal.toFixed(2)}
                            </td>

                            {/* Delete Row */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveReceiveItemRow(idx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ลบรายการที่ไม่ได้ซื้อออก"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200">
                      <tr>
                        <td colSpan={6} className="py-3 px-3 text-right font-bold text-slate-700">
                          รวมยอดเงินที่ซื้อจริงทั้งสิ้น:
                        </td>
                        <td colSpan={2} className="py-3 px-3 text-right font-mono font-black text-emerald-800 text-sm">
                          ฿{receiveModalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Receive Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุการรับของเข้าสต็อก (ถ้ามี เช่น ซื้อของไม่ครบเพราะสินค้าหมด)
                </label>
                <input
                  type="text"
                  value={receiveNote}
                  onChange={(e) => setReceiveNote(e.target.value)}
                  placeholder="ระบุหมายเหตุการตรวจรับสินค้า..."
                  className="w-full px-3.5 py-2 text-xs rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleOpenPrintSingle(selectedRequisition)}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-sky-600" />
                  <span>พิมพ์ใบขอเบิก</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReceiveStock}
                    disabled={isProcessing}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังบันทึกเข้าสต็อก...</span>
                      </>
                    ) : (
                      <>
                        <PackageCheck className="w-4 h-4" />
                        <span>ยืนยันบันทึกวัตถุดิบเข้าสต็อกร้าน</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: DETAIL MODAL                                                     */}
        {/* ========================================================================= */}
        {isDetailModalOpen && selectedRequisition && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
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
                        รออนุมัติคำขอ
                      </span>
                    )}
                    {selectedRequisition.status === 'APPROVED' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                        อนุมัติแล้ว (รอบันทึกสต็อก)
                      </span>
                    )}
                    {selectedRequisition.status === 'COMPLETED' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        บันทึกเข้าสต็อกแล้ว
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

              {(selectedRequisition.reason || selectedRequisition.note || selectedRequisition.receiveNote) && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  {selectedRequisition.reason && (
                    <div>
                      <span className="font-bold text-slate-700">วัตถุประสงค์:</span>{' '}
                      <span className="text-slate-800">{selectedRequisition.reason}</span>
                    </div>
                  )}
                  {selectedRequisition.note && (
                    <div className="text-slate-500 text-[11px]">
                      <span className="font-semibold">หมายเหตุจากร้านค้า:</span> {selectedRequisition.note}
                    </div>
                  )}
                  {selectedRequisition.receiveNote && (
                    <div className="text-emerald-800 text-[11px] font-semibold">
                      <span>หมายเหตุการรับของเข้าสต็อก:</span> {selectedRequisition.receiveNote}
                    </div>
                  )}
                </div>
              )}

              {selectedRequisition.rejectReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold">เหตุผลที่ไม่อนุมัติ:</span> {selectedRequisition.rejectReason}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">รายการวัตถุดิบ ({selectedRequisition.items.length} รายการ)</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10 text-slate-400">#</th>
                        <th className="py-2.5 px-3">รหัส/ชื่อวัตถุดิบ</th>
                        <th className="py-2.5 px-3 text-right">จำนวนที่ขอซื้อ</th>
                        <th className="py-2.5 px-3 text-right">จำนวนที่อนุมัติ</th>
                        <th className="py-2.5 px-3 text-right">ซื้อจริง (เข้าสต็อก)</th>
                        <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                        <th className="py-2.5 px-3 text-right">รวมเงิน (฿)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRequisition.items.map((item, idx) => {
                        const cost = Number(item.ingredient.costPerUnit || 0);
                        const finalQty = getItemEffectiveQty(selectedRequisition, item);
                        const lineTotal = finalQty * cost;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
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
                                <span className="text-sky-700">
                                  {Number(item.approvedQty).toLocaleString()} {item.ingredient.unit}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {selectedRequisition.status === 'COMPLETED' && item.receivedQty !== null && item.receivedQty !== undefined ? (
                                <span className="text-emerald-700">
                                  {Number(item.receivedQty).toLocaleString()} {item.ingredient.unit}
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
                        <td colSpan={6} className="py-2.5 px-3 text-right font-bold text-slate-700">
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

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPrintSingle(selectedRequisition)}
                    className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-600" />
                    <span>พิมพ์ใบขอเบิกนี้</span>
                  </button>

                  {selectedRequisition.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          handleOpenApproveModal(selectedRequisition);
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>อนุมัติให้ไปซื้อ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          handleRejectRequisition(selectedRequisition);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                      >
                        ปฏิเสธ
                      </button>
                    </>
                  )}

                  {selectedRequisition.status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenReceiveModal(selectedRequisition);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>📦 บันทึกวัตถุดิบเข้าสต็อก</span>
                    </button>
                  )}
                </div>

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

      {/* ========================================================================= */}
      {/* OFFICIAL PRINT VOUCHER MODAL (A4 Landscape - Single Requisition)          */}
      {/* ========================================================================= */}
      {printModalOpen && printRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          <div className="no-print w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20 print:hidden">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-sky-700" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างก่อนพิมพ์: ใบขอเบิกซื้อและตรวจรับวัตถุดิบเข้าหน้าร้าน
                </h4>
                <p className="text-[11px] text-slate-500">
                  จัดหน้ากระดาษ A4 แนวนอน (Landscape) อัตโนมัติ • พร้อมพิมพ์หรือบันทึกเป็น PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-sky-700/20 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ สั่งพิมพ์เอกสาร</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>

          <div
            id="official-stock-requisition-voucher"
            className="w-full max-w-5xl bg-white text-black p-4 sm:p-6 print:p-0 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            <div className="relative pb-1 mb-2">
              <div className="absolute top-0 right-0 text-right text-[10px] text-black font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>RTTR090ATHA.QRP</div>
              </div>

              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  ใบขอเบิกซื้อและตรวจรับวัตถุดิบเข้าหน้าร้าน (Store Stock Requisition & Receipt Voucher)
                </h3>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-b border-black pb-1 text-black">
                <div>
                  <span className="font-bold">เลขที่เอกสาร </span>
                  <span className="font-mono font-bold ml-1">#{printRecord.requisitionNumber}</span>
                  <span className="ml-3">
                    (<span className="font-bold">ร้านค้า/จุดขอเบิก: </span>{printRecord.store?.name})
                  </span>
                </div>
                <div>
                  <span className="font-bold">วันที่ยื่นคำขอ </span>
                  <span className="font-mono ml-1">
                    {new Date(printRecord.createdAt).toLocaleDateString('th-TH')} {new Date(printRecord.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                  <span className="font-bold ml-4">
                    สถานะ:{' '}
                    {printRecord.status === 'PENDING'
                      ? 'รออนุมัติคำขอ'
                      : printRecord.status === 'APPROVED'
                      ? 'อนุมัติให้ไปซื้อแล้ว (รอบันทึกเข้าสต็อก)'
                      : printRecord.status === 'COMPLETED'
                      ? 'ตรวจรับและบันทึกเข้าสต็อกแล้ว'
                      : 'ไม่อนุมัติ'}
                  </span>
                </div>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-black">
                <div>
                  <span className="font-bold">ผู้ขอเบิก: </span>
                  <span className="font-semibold">{printRecord.store?.name} (@{printRecord.store?.username})</span>
                  {printRecord.approvedBy && (
                    <span className="ml-4">
                      <span className="font-bold">ผู้อนุมัติ: </span>
                      <span className="font-semibold">{printRecord.approvedBy.name}</span>
                      {printRecord.approvedAt && (
                        <span className="font-mono ml-1">
                          ({new Date(printRecord.approvedAt).toLocaleDateString('th-TH')})
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold">เหตุผล: </span>
                  <span className="font-semibold">{printRecord.reason || 'ขอเบิกวัตถุดิบเข้าหน้าร้าน'}</span>
                  {printRecord.note && (
                    <span className="ml-2 font-normal text-slate-700">| หมายเหตุ: {printRecord.note}</span>
                  )}
                  {printRecord.receiveNote && (
                    <span className="ml-2 font-bold text-black">| หมายเหตุรับของ: {printRecord.receiveNote}</span>
                  )}
                  {printRecord.rejectReason && (
                    <span className="ml-2 text-red-600 font-bold">(เหตุผลไม่อนุมัติ: {printRecord.rejectReason})</span>
                  )}
                </div>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
              <thead>
                <tr className="border-t border-b border-black text-black font-bold text-center bg-white">
                  <th className="py-1 px-1.5 border-r border-black w-8 text-center bg-white">ลำดับ</th>
                  <th className="py-1 px-2 border-r border-black w-24 text-center bg-white">รหัสวัตถุดิบ</th>
                  <th className="py-1 px-2.5 border-r border-black text-left bg-white">ชื่อวัตถุดิบ</th>
                  <th className="py-1 px-2 border-r border-black w-24 text-center bg-white">หมวดหมู่</th>
                  <th className="py-1 px-2 border-r border-black w-20 text-right bg-white">จำนวนที่ขอ</th>
                  <th className="py-1 px-2 border-r border-black w-20 text-right bg-white">ที่อนุมัติ</th>
                  <th className="py-1 px-2 border-r border-black w-24 text-right bg-white">ซื้อจริง/รับเข้า</th>
                  <th className="py-1 px-2 border-r border-black w-14 text-center bg-white">หน่วย</th>
                  <th className="py-1 px-2 border-r border-black w-20 text-right bg-white">ต้นทุน/หน่วย</th>
                  <th className="py-1 px-2 text-right w-24 bg-white">ยอดเงินรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                {printRecord.items.map((item, idx) => {
                  const cost = Number(item.ingredient?.costPerUnit ?? 0);
                  const reqQty = Number(item.requestedQty || 0);
                  const appQty = item.approvedQty !== null ? Number(item.approvedQty) : null;
                  const recQty =
                    printRecord.status === 'COMPLETED' && item.receivedQty !== null && item.receivedQty !== undefined
                      ? Number(item.receivedQty)
                      : null;
                  const effectiveQty = getItemEffectiveQty(printRecord, item);
                  const lineCost = effectiveQty * cost;

                  return (
                    <tr key={item.id} className="border-b border-black">
                      <td className="py-0.5 px-1.5 text-center border-r border-black font-sans text-black">
                        {idx + 1}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black text-center font-mono font-bold text-black">
                        {item.ingredient.code}
                      </td>
                      <td className="py-0.5 px-2.5 border-r border-black font-sans font-bold text-black text-left">
                        {item.ingredient.name}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black font-sans text-center text-black">
                        {item.ingredient.category || '-'}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black text-right font-mono font-bold text-black">
                        {reqQty.toLocaleString()}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black text-right font-mono font-bold text-black">
                        {appQty !== null ? appQty.toLocaleString() : '-'}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black text-right font-mono font-bold text-black">
                        {recQty !== null ? recQty.toLocaleString() : '........'}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black text-center font-sans text-black">
                        {item.ingredient.unit}
                      </td>
                      <td className="py-0.5 px-2 border-r border-black text-right font-mono text-black">
                        ฿{cost.toFixed(2)}
                      </td>
                      <td className="py-0.5 px-2 text-right font-mono font-bold text-black">
                        ฿{lineCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-black font-bold text-black bg-slate-50 text-[10px]">
                  <td colSpan={4} className="py-1 px-2 border-r border-black text-right font-sans">
                    รวมรายการทั้งหมด ({printRecord.items.length} รายการ):
                  </td>
                  <td className="py-1 px-2 border-r border-black text-right font-mono">
                    {printRecord.items.reduce((s, it) => s + Number(it.requestedQty || 0), 0).toLocaleString()}
                  </td>
                  <td className="py-1 px-2 border-r border-black text-right font-mono">
                    {printRecord.items.some((it) => it.approvedQty !== null)
                      ? printRecord.items.reduce((s, it) => s + Number(it.approvedQty || 0), 0).toLocaleString()
                      : '-'}
                  </td>
                  <td className="py-1 px-2 border-r border-black text-right font-mono">
                    {printRecord.status === 'COMPLETED'
                      ? printRecord.items.reduce((s, it) => s + Number(it.receivedQty || 0), 0).toLocaleString()
                      : '-'}
                  </td>
                  <td colSpan={2} className="py-1 px-2 border-r border-black text-right font-sans">
                    รวมยอดเงินสุทธิ:
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    ฿{computeRequisitionTotal(printRecord).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="print-signature-section mt-6 pt-2 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ขออนุมัติเบิก / ผู้จัดซื้อ (ร้านค้า)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้อนุมัติให้จัดซื้อ (Admin)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจรับเข้าสต็อก (Admin / บัญชี)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICIAL REQUISITIONS SUMMARY REPORT (A4 Landscape - Print All/Filtered)  */}
      {/* ========================================================================= */}
      {printListModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          <div className="no-print w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 mb-4 sticky top-2 z-20 print:hidden">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-sky-700 shrink-0" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างพิมพ์รายงานสรุปรายการขอเบิกซื้อวัตถุดิบทั้งหมด (A4 แนวนอน)
                </h4>
                <p className="text-[11px] text-slate-500">
                  จัดหน้ากระดาษ A4 แนวนอน (Landscape) อัตโนมัติ • เลือกกรองสถานะได้
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'] as const).map((st) => {
                const labels = {
                  ALL: `ทั้งหมด (${filteredRequisitions.length})`,
                  PENDING: 'รออนุมัติ',
                  APPROVED: 'รอบันทึกสต็อก',
                  COMPLETED: 'บันทึกสต็อกแล้ว',
                  REJECTED: 'ไม่อนุมัติ',
                };
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPrintListStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      printListStatus === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {labels[st]}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-sky-700/20 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ สั่งพิมพ์เอกสาร</span>
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

          <div
            id="official-stock-requisitions-report"
            className="w-full max-w-5xl bg-white text-black p-4 sm:p-6 print:p-0 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            <div className="relative pb-1 mb-2">
              <div className="absolute top-0 right-0 text-right text-[10px] text-black font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>RTTR090ATHA.QRP</div>
              </div>

              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  รายงานสรุปใบขอเบิกซื้อและตรวจรับวัตถุดิบเข้าหน้าร้าน (Stock Requisitions Summary Report)
                </h3>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-b border-black pb-1 text-black">
                <div>
                  <span className="font-bold">ผู้ออกรายงาน: </span>
                  <span>{user?.name || 'ผู้ดูแลระบบ (Admin)'}</span>
                </div>
                <div>
                  <span className="font-bold">พิมพ์ ณ วันที่: </span>
                  <span className="font-mono ml-1">
                    {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-t border-b border-black text-black font-bold text-center bg-white">
                    <th className="py-1 px-1 border-r border-black w-8 text-center bg-white">ลำดับ</th>
                    <th className="py-1 px-1.5 border-r border-black w-24 bg-white text-center">เลขที่ใบขอ</th>
                    <th className="py-1 px-1.5 border-r border-black w-20 bg-white text-center">วันที่ยื่น</th>
                    <th className="py-1 px-2 border-r border-black text-left w-24 bg-white">ร้านค้า</th>
                    <th className="py-1 px-2 border-r border-black text-left bg-white">เหตุผล / หมายเหตุ</th>
                    <th className="py-1 px-2 border-r border-black text-left w-56 bg-white">รายการวัตถุดิบ (ขอ / รับเข้าจริง)</th>
                    <th className="py-1 px-2 border-r border-black text-right w-24 bg-white">ยอดเงิน (บาท)</th>
                    <th className="py-1 px-1.5 border-r border-black text-center w-24 bg-white">สถานะ</th>
                    <th className="py-1 px-2 text-left w-24 bg-white">ผู้อนุมัติ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {printRequisitions.map((req, reqIdx) => {
                    const items = req.items.length > 0 ? req.items : [null];

                    return items.map((item, itemIdx) => {
                      const isFirst = itemIdx === 0;
                      const cost = item ? Number(item.ingredient?.costPerUnit ?? 0) : 0;
                      const effQty = item ? getItemEffectiveQty(req, item) : 0;
                      const lineTotal = effQty * cost;

                      return (
                        <tr key={`${req.id}-${item?.id ?? itemIdx}`} className="border-b border-black">
                          {isFirst && (
                            <>
                              <td rowSpan={items.length} className="py-1 px-1 text-center border-r border-black font-sans text-black align-top">
                                {reqIdx + 1}
                              </td>
                              <td rowSpan={items.length} className="py-1 px-1.5 border-r border-black font-bold text-black font-mono text-center align-top">
                                #{req.requisitionNumber}
                              </td>
                              <td rowSpan={items.length} className="py-1 px-1.5 border-r border-black font-mono text-black text-center align-top">
                                {new Date(req.createdAt).toLocaleDateString('th-TH')}
                              </td>
                              <td rowSpan={items.length} className="py-1 px-2 border-r border-black font-sans text-black text-left align-top">
                                {req.store?.name}
                              </td>
                              <td rowSpan={items.length} className="py-1 px-2 border-r border-black font-sans text-black text-left align-top">
                                <div>{req.reason || 'ขอเบิกวัตถุดิบ'}</div>
                                {req.receiveNote && (
                                  <div className="text-[8.5px] text-black font-bold">(รับของ: {req.receiveNote})</div>
                                )}
                                {req.rejectReason && (
                                  <div className="text-[8.5px] text-red-600 font-bold">(ไม่อนุมัติ: {req.rejectReason})</div>
                                )}
                              </td>
                            </>
                          )}

                          <td className="py-1 px-2 border-r border-black font-sans text-left text-black align-top">
                            {item ? (
                              <div>
                                <span className="font-semibold">{item.ingredient?.name}</span>:{' '}
                                <span className="font-mono font-bold">
                                  {effQty.toLocaleString()} {item.ingredient?.unit}
                                </span>
                                {req.status === 'COMPLETED' &&
                                  item.receivedQty !== null &&
                                  Number(item.receivedQty) !== Number(item.requestedQty) && (
                                    <span className="text-[8.5px] text-slate-600 ml-1">
                                      (ขอ {Number(item.requestedQty).toLocaleString()})
                                    </span>
                                  )}
                              </div>
                            ) : (
                              <span>-</span>
                            )}
                          </td>

                          <td className="py-1 px-2 border-r border-black font-mono text-right text-black align-top">
                            {item ? (
                              <span>
                                ฿{lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span>-</span>
                            )}
                          </td>

                          {isFirst && (
                            <>
                              <td rowSpan={items.length} className="py-1 px-1.5 border-r border-black text-center font-sans text-black align-top">
                                {req.status === 'PENDING' && <span className="font-bold">รออนุมัติ</span>}
                                {req.status === 'APPROVED' && <span className="font-bold">รอบันทึกสต็อก</span>}
                                {req.status === 'COMPLETED' && <span className="font-bold">บันทึกสต็อกแล้ว</span>}
                                {req.status === 'REJECTED' && <span className="font-bold">ไม่อนุมัติ</span>}
                              </td>
                              <td rowSpan={items.length} className="py-1 px-2 font-sans text-black text-left text-[9px] align-top">
                                {req.approvedBy?.name || '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    });
                  })}
                </tbody>
                {printRequisitions.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-black font-bold text-black bg-slate-50 text-[10px]">
                      <td colSpan={5} className="py-1.5 px-2 border-r border-black text-right font-sans">
                        รวมใบขอเบิกทั้งหมด:
                      </td>
                      <td className="py-1.5 px-2 border-r border-black font-mono text-left text-black">
                        {printRequisitions.length} ฉบับ (รวม {printRequisitions.reduce((s, r) => s + r.items.length, 0)} รายการ)
                      </td>
                      <td className="py-1.5 px-2 border-r border-black font-mono text-right text-black font-bold">
                        ฿{printRequisitions.reduce((sum, req) => sum + computeRequisitionTotal(req), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="py-1.5 px-2 font-sans text-center text-slate-400">
                        -
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="print-signature-section mt-6 pt-2 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ขออนุมัติเบิก (ร้านค้า)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้อนุมัติ (ผู้จัดการ / Admin)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ตรวจรับเข้าสต็อก / บัญชี</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
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
  Store,
  Warehouse,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { showSuccessAlert, showErrorAlert, confirmActionAlert, confirmRejectAlert } from '@/lib/sweetalert';
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
  storeId?: number | null;
  store?: {
    id: number;
    name: string;
  } | null;
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
  const { mutate: globalMutate } = useSWRConfig();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Instant SWR Cache
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-adjustments');

  const adjustments: AdjustmentRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.adjustments) ? swrData.adjustments : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const staffStores = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
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

  const [formStoreId, setFormStoreId] = useState<string>('');
  const [storeQuery, setStoreQuery] = useState<string>('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [formIngredients, setFormIngredients] = useState<Ingredient[]>([]);
  const [loadingStoreStock, setLoadingStoreStock] = useState(false);
  const [formReason, setFormReason] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [formItems, setFormItems] = useState<NewItemForm[]>([
    { ingredientId: '', actualQuantity: '' },
  ]);
  const [rowIngQueries, setRowIngQueries] = useState<Record<number, string>>({});
  const [activeIngDropdownIdx, setActiveIngDropdownIdx] = useState<number | null>(null);


  // Detail Modal
  const [selectedAdjustment, setSelectedAdjustment] = useState<AdjustmentRecord | null>(null);

  // Print Modals
  const [printListModalOpen, setPrintListModalOpen] = useState(false);
  const [printListStatus, setPrintListStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [printVoucherOpen, setPrintVoucherOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getReasonBadge = (reason: string) => {
    if (reason.includes('เสียหาย') || reason.includes('ชำรุด') || reason.includes('แตก') || reason.includes('หก')) {
      return { label: '📦 เสียหาย / ชำรุด', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    if (reason.includes('หมดอายุ') || reason.includes('เสื่อม')) {
      return { label: '⚠️ หมดอายุ', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (reason.includes('ตรวจนับ') || reason.includes('นับสต็อก')) {
      return { label: '📋 ตรวจนับสต็อก', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (reason.includes('สูญหาย') || reason.includes('หาย')) {
      return { label: '❓ สูญหาย', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    if (reason.includes('ทดลอง') || reason.includes('ฝึกอบรม')) {
      return { label: '🧪 ทดลองสูตร', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    return { label: '✏️ ปรับปรุงสต็อก', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  // Fetch live stock for selected warehouse or store
  const fetchLocationStock = async (targetStoreId: string) => {
    setLoadingStoreStock(true);
    try {
      const res = await fetch(`/api/stock-adjustments?stockFor=${encodeURIComponent(targetStoreId)}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.ingredients)) {
        setFormIngredients(data.ingredients);
        return data.ingredients as Ingredient[];
      }
    } catch (err) {
      console.error('Failed to load location stock:', err);
    } finally {
      setLoadingStoreStock(false);
    }
    return ingredients;
  };

  // Open Create Modal
  const openCreateModal = async () => {
    const firstStoreId = staffStores[0] ? String(staffStores[0].id) : '';
    const initialStore = storeFilter !== 'ALL' ? storeFilter : firstStoreId;
    const initStoreObj = staffStores.find((s: any) => String(s.id) === String(initialStore));
    setFormStoreId(initialStore);
    setStoreQuery(initStoreObj ? `${initStoreObj.name} (@${initStoreObj.username})` : '');
    setStoreDropdownOpen(false);
    setFormReason('');
    setAutoApprove(true);
    setFormError(null);
    setRowIngQueries({ 0: '' });
    setActiveIngDropdownIdx(null);
    setFormItems([
      {
        ingredientId: '',
        actualQuantity: '',
      },
    ]);
    setCreateModalOpen(true);

    if (initialStore) {
      await fetchLocationStock(initialStore);
    }
  };

  const handleFormStoreChange = async (newStoreId: string) => {
    setFormStoreId(newStoreId);
    const stObj = staffStores.find((s: any) => String(s.id) === String(newStoreId));
    if (stObj) {
      setStoreQuery(`${stObj.name} (@${stObj.username})`);
    }
    setStoreDropdownOpen(false);
    setFormError(null);
    const updatedIngs = await fetchLocationStock(newStoreId);
    // Refresh displayed stock in row queries if an ingredient is already selected
    setRowIngQueries((prev) => {
      const next: Record<number, string> = { ...prev };
      formItems.forEach((it, idx) => {
        if (it.ingredientId) {
          const found = updatedIngs.find((i) => i.id === Number(it.ingredientId));
          if (found) {
            next[idx] = `${found.name} (${found.code})`;
          }
        }
      });
      return next;
    });
  };

  const handleAddItemRow = () => {
    const nextIdx = formItems.length;
    setFormItems((prev) => [
      ...prev,
      {
        ingredientId: '',
        actualQuantity: '',
      },
    ]);
    setRowIngQueries((prev) => ({ ...prev, [nextIdx]: '' }));
    setActiveIngDropdownIdx(nextIdx);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
    setRowIngQueries((prev) => {
      const updated: Record<number, string> = {};
      Object.keys(prev).forEach((key) => {
        const k = Number(key);
        if (k < idx) updated[k] = prev[k];
        else if (k > idx) updated[k - 1] = prev[k];
      });
      return updated;
    });
    if (activeIngDropdownIdx === idx) setActiveIngDropdownIdx(null);
  };

  const handleItemChange = (idx: number, field: keyof NewItemForm, value: string) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Submit New Adjustment
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // NOTE: item.actualQuantity holds the WASTE amount typed by the user (e.g. 20 g).
    // The new stock level sent to the API = current system stock - waste.
    const validItems = formItems.filter(
      (item) =>
        item.ingredientId &&
        item.actualQuantity !== '' &&
        !isNaN(parseFloat(item.actualQuantity)) &&
        parseFloat(item.actualQuantity) > 0
    );

    if (validItems.length === 0) {
      setFormError('กรุณาระบุวัตถุดิบและจำนวนเสีย (มากกว่า 0) อย่างน้อย 1 รายการ');
      return;
    }

    const activeIngList = formIngredients.length > 0 ? formIngredients : ingredients;
    const overItem = validItems.find((item) => {
      const ing = activeIngList.find((i) => i.id === Number(item.ingredientId));
      return ing && parseFloat(item.actualQuantity) > Number(ing.currentStock);
    });
    if (overItem) {
      const ing = activeIngList.find((i) => i.id === Number(overItem.ingredientId));
      setFormError(
        `จำนวนเสียของ "${ing?.name}" มากกว่าสต็อกในระบบ (${Number(ing?.currentStock)} ${ing?.unit})`
      );
      return;
    }

    const finalReason = formReason.trim();
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
          storeId: formStoreId,
          items: validItems.map((item) => ({
            ingredientId: Number(item.ingredientId),
            wasteQuantity: parseFloat(item.actualQuantity),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'สร้างใบปรับปรุงสต็อกไม่สำเร็จ');
      }

      showToast(data.message);
      await mutate();
      globalMutate('/api/notifications');
      setCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Action with SweetAlert2
  const handleApprove = async (adj: AdjustmentRecord) => {
    const isConfirmed = await confirmActionAlert({
      title: 'ยืนยันอนุมัติใบปรับปรุงสต็อก?',
      text: `ต้องการอนุมัติใบปรับปรุงสต็อก #${adj.adjustmentNumber} ใช่หรือไม่?\nระบบจะทำการอัปเดตยอดคงเหลือจริงในคลังทันที`,
      confirmButtonText: 'ยืนยันอนุมัติ',
      confirmButtonColor: '#10b981',
      icon: 'question',
    });

    if (!isConfirmed) return;

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

      await mutate();
      globalMutate('/api/notifications');
      if (selectedAdjustment?.id === adj.id) {
        setSelectedAdjustment(data.adjustment);
      }
      await showSuccessAlert(
        'อนุมัติสำเร็จ',
        `อนุมัติใบปรับปรุง #${adj.adjustmentNumber} และอัปเดตยอดสต็อกจริงเรียบร้อยแล้ว`
      );
    } catch (err: any) {
      await showErrorAlert('อนุมัติไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการอนุมัติ');
    }
  };

  // Reject Action with SweetAlert2
  const handleReject = async (adj: AdjustmentRecord) => {
    const { isConfirmed, reason } = await confirmRejectAlert({
      requisitionNumber: adj.adjustmentNumber,
      storeName: adj.requestedBy?.name,
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: adj.id,
          action: 'REJECT',
          rejectReason: reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ดำเนินการไม่สำเร็จ');
      }

      await mutate();
      globalMutate('/api/notifications');
      if (selectedAdjustment?.id === adj.id) {
        setSelectedAdjustment(data.adjustment);
      }
      await showSuccessAlert(
        'ปฏิเสธคำขอสำเร็จ',
        `ปฏิเสธใบปรับปรุง #${adj.adjustmentNumber} เรียบร้อยแล้ว`
      );
    } catch (err: any) {
      await showErrorAlert('ดำเนินการไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาด');
    }
  };

  // Filtered List
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      // Tab filter
      if (activeTab !== 'ALL' && adj.status !== activeTab) return false;

      // Store filter
      if (storeFilter !== 'ALL') {
        const staffId = Number(storeFilter);
        if (adj.requestedBy?.id !== staffId) return false;
      }

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
  }, [adjustments, activeTab, storeFilter, search]);

  // Filtered List for Printing Summary Report
  const printAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      // Print status filter
      if (printListStatus !== 'ALL' && adj.status !== printListStatus) return false;

      // Store filter
      if (storeFilter !== 'ALL') {
        const staffId = Number(storeFilter);
        if (adj.requestedBy?.id !== staffId) return false;
      }

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
  }, [adjustments, printListStatus, storeFilter, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, storeFilter]);

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
            onClick={() => {
              setPrintListStatus(activeTab);
              setPrintListModalOpen(true);
            }}
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
            <span>สร้างใบขอปรับปรุงสต็อกใหม่</span>
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

      
      {/* Unified Filters: ร้านค้า / สาขา + สถานะ + ช่องค้นหา (ในบรรทัดเดียวกัน) */}
      <div className="bg-white p-3 sm:p-3.5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* เลือกร้านค้า / สาขา */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <span className="px-2.5 text-xs font-bold text-slate-500 shrink-0">ร้านค้า / สาขา:</span>
            <button
              type="button"
              onClick={() => {
                setStoreFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                storeFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              ทุกสาขา ({adjustments.length})
            </button>
            {staffStores.map((st: any) => {
              const count = adjustments.filter((adj) => adj.requestedBy?.id === st.id).length;
              const isSelected = storeFilter === String(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setStoreFilter(String(st.id));
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  {st.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden lg:block" />

          {/* สถานะ */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100/70 rounded-2xl border border-slate-200/80 overflow-x-auto">
            <span className="px-2.5 text-xs font-bold text-slate-500 shrink-0">สถานะ:</span>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'ALL'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              ทั้งหมด ({metrics.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeTab === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>รอการอนุมัติ</span>
              {metrics.pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black">
                  {metrics.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('APPROVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'APPROVED'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-emerald-800 hover:bg-emerald-100/70'
              }`}
            >
              อนุมัติแล้ว ({metrics.approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REJECTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'REJECTED'
                  ? 'bg-red-700 text-white shadow-2xs'
                  : 'text-red-800 hover:bg-red-100/70'
              }`}
            >
              ไม่อนุมัติ ({metrics.rejectedCount})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full xl:w-72 shrink-0">
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
            <table className="w-full text-left text-xs min-w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider whitespace-nowrap">
                  <th className="py-2.5 px-3 text-center w-10 text-slate-500">#</th>
                  <th className="py-2.5 px-3">ใบปรับปรุงสต็อก</th>
                  <th className="py-2.5 px-3">วันที่ทำรายการ</th>
                  <th className="py-2.5 px-3">ร้านค้า / สาขา</th>
                  <th className="py-2.5 px-3">เหตุผลในการปรับปรุง</th>
                  <th className="py-2.5 px-3">รายการวัตถุดิบ & ผลต่าง</th>
                  <th className="py-2.5 px-3">ผู้ขอปรับปรุง</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                  <th className="py-2.5 px-3 text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedAdjustments.map((adj, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const isPending = adj.status === 'PENDING';
                  const isApproved = adj.status === 'APPROVED';
                  const isRejected = adj.status === 'REJECTED';
                  const isStore = adj.requestedBy?.role === 'STAFF';

                  return (
                    <tr
                      key={adj.id}
                      onClick={() => setSelectedAdjustment(adj)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Sequence Row Number */}
                      <td className="py-3 px-3 text-center text-slate-600 font-mono text-xs font-bold">
                        {rowNumber}
                      </td>

                      {/* Adjustment Number */}
                      <td className="py-3 px-4 font-mono font-bold text-xs text-slate-900 whitespace-nowrap">
                        <span className="hover:text-emerald-700 hover:underline">{adj.adjustmentNumber}</span>
                      </td>

                      {/* Date & Time (Single Line) */}
                      <td className="py-3 px-4 text-slate-900 whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {new Date(adj.createdAt).toLocaleDateString('th-TH')}
                        </span>
                        <span className="text-[11px] text-slate-600 font-mono font-semibold ml-1.5">
                          {new Date(adj.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                      </td>

                      {/* Store / Branch Badge (Single Line, Smaller Font) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 whitespace-nowrap">
                          {adj.requestedBy?.name || 'ร้านค้า'}
                        </span>
                      </td>

                      {/* Reason (Single Line) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {(() => {
                          const badge = getReasonBadge(adj.reason);
                          return (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.color} shrink-0`}>
                                {badge.label}
                              </span>
                              <span className="text-xs text-slate-900 font-semibold truncate max-w-[200px]" title={adj.reason}>
                                {adj.reason}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Items Summary (Name & Diff Together, Single Line) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {adj.items.slice(0, 2).map((item, itemIdx) => {
                            const diff = Number(item.diffQuantity || 0);
                            const unit = item.ingredient?.unit || '';
                            return (
                              <div key={item.id || itemIdx} className="inline-flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]" title={item.ingredient?.name}>
                                  {item.ingredient?.name}
                                </span>
                                <span
                                  className={`font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-md shrink-0 ${
                                    diff < 0
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : diff > 0
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}` : diff} {unit}
                                </span>
                              </div>
                            );
                          })}
                          {adj.items.length > 2 && (
                            <span className="text-[11px] text-slate-600 font-bold">
                              +{adj.items.length - 2} รายการ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Requested By (Single Line, Smaller Font) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-xs text-slate-900">
                          {adj.requestedBy?.name || 'User'}
                        </span>
                        {adj.requestedBy?.username && (
                          <span className="text-[11px] text-slate-600 font-mono font-semibold ml-1">
                            (@{adj.requestedBy?.username})
                          </span>
                        )}
                      </td>

                      {/* Status Badge (Single Line, Smaller Font) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isPending && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
                            รออนุมัติ
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                            อนุมัติแล้ว
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300 whitespace-nowrap">
                            ไม่อนุมัติ
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedAdjustment(adj)}
                            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 shadow-2xs transition-all cursor-pointer"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(adj)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="อนุมัติและปรับปรุงยอดสต็อกจริง"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>อนุมัติ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(adj)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                title="ปฏิเสธคำขอนี้"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>ปฏิเสธ</span>
                              </button>
                            </>
                          )}
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
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
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
                    ระบุวัตถุดิบและจำนวนที่เสีย ระบบจะหักออกจากสต็อกให้อัตโนมัติ
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
              {/* Click-away backdrop for autocomplete popovers */}
              {(storeDropdownOpen || activeIngDropdownIdx !== null) && (
                <div
                  className="fixed inset-0 z-[55] bg-transparent"
                  onClick={() => {
                    setStoreDropdownOpen(false);
                    setActiveIngDropdownIdx(null);
                  }}
                />
              )}

              {/* Store Autocomplete Input */}
              <div className="relative z-[60]">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    ร้านค้าที่ต้องการปรับสต็อก <span className="text-red-500">*</span>
                  </label>
                  {loadingStoreStock && (
                    <span className="text-[11px] font-bold text-emerald-700 animate-pulse">
                      กำลังดึงยอดสต็อกปัจจุบัน...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={storeQuery}
                    onFocus={() => {
                      setStoreDropdownOpen(true);
                      setActiveIngDropdownIdx(null);
                    }}
                    onChange={(e) => {
                      setStoreQuery(e.target.value);
                      setStoreDropdownOpen(true);
                    }}
                    placeholder="พิมพ์ชื่อร้านค้า หรือรหัสร้านค้าเพื่อค้นหา..."
                    className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {storeQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setStoreQuery('');
                        setStoreDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="ล้างเพื่อพิมพ์ใหม่"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {storeDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      const q = storeQuery.toLowerCase().trim();
                      const currentSelectedStore = staffStores.find(
                        (s: any) => String(s.id) === String(formStoreId)
                      );
                      const isShowingFullSelectedLabel =
                        currentSelectedStore &&
                        storeQuery === `${currentSelectedStore.name} (@${currentSelectedStore.username})`;
                      const matchedStores =
                        !q || isShowingFullSelectedLabel
                          ? staffStores
                          : staffStores.filter(
                              (s: any) =>
                                s.name?.toLowerCase().includes(q) ||
                                s.username?.toLowerCase().includes(q)
                            );

                      if (matchedStores.length === 0) {
                        return (
                          <div className="p-3 text-center text-xs text-slate-400">
                            ไม่พบร้านค้าที่ตรงกับ &ldquo;{storeQuery}&rdquo;
                          </div>
                        );
                      }

                      return matchedStores.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleFormStoreChange(String(s.id))}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between cursor-pointer transition-colors ${
                            String(s.id) === String(formStoreId)
                              ? 'bg-emerald-50/70 font-bold text-emerald-900'
                              : 'text-slate-800 font-medium'
                          }`}
                        >
                          <span>🏪 {s.name}</span>
                          <span className="font-mono text-[11px] text-slate-500">@{s.username}</span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เหตุผลในการปรับปรุงสต็อก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="พิมพ์เหตุผลได้เลย หรือกดเลือกจากตัวเลือกด้านล่าง..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                {/* Quick-pick reason chips (fills the input; user can still edit freely) */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    'วัตถุดิบเสียหาย / ชำรุด',
                    'วัตถุดิบหมดอายุ / เสื่อมสภาพ',
                    'นำไปใช้ทดลองสูตร / ฝึกอบรม',
                    'ปรับปรุงจากการตรวจนับสต็อกจริง',
                    'ได้รับแถมจากซัพพลายเออร์',
                    'สินค้าสูญหายไม่ทราบสาเหตุ',
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormReason(r)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        formReason === r
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
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

                <div className="space-y-2">
                  {formItems.map((item, idx) => {
                    const activeIngredients = formIngredients.length > 0 ? formIngredients : ingredients;
                    const selectedIng = activeIngredients.find((i) => i.id === Number(item.ingredientId));
                    const systemQty = selectedIng ? Number(selectedIng.currentStock) : 0;
                    const wasteQty = parseFloat(item.actualQuantity);
                    const diff = item.actualQuantity !== '' && !isNaN(wasteQty) ? -Math.abs(wasteQty) : 0;
                    const remainQty = Math.max(0, systemQty + diff);
                    const rowQuery = rowIngQueries[idx] ?? (selectedIng ? `${selectedIng.name} (${selectedIng.code})` : '');
                    const isRowDropdownOpen = activeIngDropdownIdx === idx;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-2 text-xs relative ${
                          isRowDropdownOpen ? 'z-[60] border-emerald-400 bg-white shadow-sm' : ''
                        }`}
                      >
                        {/* Ingredient Autocomplete Input */}
                        <div className="flex-1 w-full relative">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={rowQuery}
                              onFocus={() => {
                                setActiveIngDropdownIdx(idx);
                                setStoreDropdownOpen(false);
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRowIngQueries((prev) => ({ ...prev, [idx]: val }));
                                setActiveIngDropdownIdx(idx);
                                if (!val.trim()) {
                                  handleItemChange(idx, 'ingredientId', '');
                                }
                              }}
                              placeholder="พิมพ์ชื่อ หรือรหัสวัตถุดิบเพื่อค้นหา..."
                              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                            {rowQuery && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRowIngQueries((prev) => ({ ...prev, [idx]: '' }));
                                  handleItemChange(idx, 'ingredientId', '');
                                  setActiveIngDropdownIdx(idx);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                title="ล้างเพื่อพิมพ์ใหม่"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {isRowDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] max-h-56 overflow-y-auto divide-y divide-slate-100">
                              {(() => {
                                const q = rowQuery.toLowerCase().trim();
                                const isShowingSelectedLabel =
                                  selectedIng && rowQuery === `${selectedIng.name} (${selectedIng.code})`;
                                const matchedIngs =
                                  !q || isShowingSelectedLabel
                                    ? activeIngredients
                                    : activeIngredients.filter(
                                        (ing) =>
                                          ing.name.toLowerCase().includes(q) ||
                                          ing.code.toLowerCase().includes(q) ||
                                          (ing.category && ing.category.toLowerCase().includes(q))
                                      );

                                if (matchedIngs.length === 0) {
                                  return (
                                    <div className="p-3 text-center text-xs text-slate-400">
                                      ไม่พบวัตถุดิบที่ตรงกับ &ldquo;{rowQuery}&rdquo;
                                    </div>
                                  );
                                }

                                return matchedIngs.map((ing) => (
                                  <button
                                    key={ing.id}
                                    type="button"
                                    onClick={() => {
                                      handleItemChange(idx, 'ingredientId', String(ing.id));
                                      setRowIngQueries((prev) => ({
                                        ...prev,
                                        [idx]: `${ing.name} (${ing.code})`,
                                      }));
                                      setActiveIngDropdownIdx(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                      String(ing.id) === String(item.ingredientId)
                                        ? 'bg-emerald-50/70 font-bold'
                                        : ''
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-xs text-slate-800 truncate">
                                        {ing.name}{' '}
                                        <span className="font-mono text-[10px] text-slate-400">({ing.code})</span>
                                      </div>
                                      {ing.category && (
                                        <div className="text-[10px] text-slate-400 truncate">
                                          หมวด: {ing.category}
                                        </div>
                                      )}
                                    </div>
                                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                      ในระบบ: {Number(ing.currentStock).toLocaleString()} {ing.unit}
                                    </span>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>

                        {/* System Stock preview */}
                        <div className="w-24 text-right font-mono text-slate-500 hidden sm:block">
                          ระบบ: {systemQty.toLocaleString()}
                        </div>

                        {/* Waste Input */}
                        <div className="w-full sm:w-40 flex items-center gap-1">
                          <span className="text-slate-600 text-[10px] font-bold whitespace-nowrap">จำนวนเสีย:</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={item.actualQuantity}
                            onChange={(e) => handleItemChange(idx, 'actualQuantity', e.target.value)}
                            placeholder="เช่น 20"
                            className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono font-bold text-right focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500 w-8 truncate">
                            {selectedIng?.unit || 'หน่วย'}
                          </span>
                        </div>

                        {/* Diff Preview + remaining */}
                        <div className="w-28 text-right font-mono font-bold leading-tight">
                          {diff === 0 ? (
                            <span className="text-slate-400">0</span>
                          ) : (
                            <span className="text-red-600">{diff.toLocaleString()}</span>
                          )}
                          {diff !== 0 && (
                            <div className="text-[10px] font-semibold text-slate-500">
                              คงเหลือ {remainQty.toLocaleString()}
                            </div>
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



      {/* Modal 3: View Adjustment Detail */}
      {selectedAdjustment && !printVoucherOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>ใบปรับปรุงสต็อก</span>
                  <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                    #{selectedAdjustment.adjustmentNumber}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  วันที่ {new Date(selectedAdjustment.createdAt).toLocaleString('th-TH')} น.
                </p>
              </div>
              <button
                onClick={() => setSelectedAdjustment(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta Grid */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium">ผู้ขอปรับปรุง:</span>
                <div className="font-bold text-slate-800">
                  {selectedAdjustment.requestedBy?.name} (@{selectedAdjustment.requestedBy?.username})
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-slate-500 font-medium">สถานะคำขอ:</span>
                <div>
                  {selectedAdjustment.status === 'PENDING' && (
                    <span className="inline-block font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs">
                      รอการอนุมัติ (Pending)
                    </span>
                  )}
                  {selectedAdjustment.status === 'APPROVED' && (
                    <span className="inline-block font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs">
                      อนุมัติแล้ว (Approved)
                    </span>
                  )}
                  {selectedAdjustment.status === 'REJECTED' && (
                    <span className="inline-block font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-xs">
                      ไม่อนุมัติ (Rejected)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-medium">เหตุผล:</span>
                <div className="font-bold text-slate-800">{selectedAdjustment.reason}</div>
              </div>

              {selectedAdjustment.approvedBy && (
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 font-medium">
                    {selectedAdjustment.status === 'APPROVED' ? 'ผู้อนุมัติ:' : 'ผู้ปฏิเสธ:'}
                  </span>
                  <div className="font-bold text-slate-800">
                    {selectedAdjustment.approvedBy.name} (
                    {new Date(selectedAdjustment.approvedAt || '').toLocaleString('th-TH')})
                  </div>
                </div>
              )}

              {selectedAdjustment.rejectReason && (
                <div className="sm:col-span-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  <span className="font-bold">เหตุผลที่ปฏิเสธ: </span>
                  <span>{selectedAdjustment.rejectReason}</span>
                </div>
              )}
            </div>

            {/* Items Table with Cost / Value */}
            <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="py-3 px-3.5 text-center w-12 text-slate-400">#</th>
                    <th className="py-3 px-4">รหัส / ชื่อวัตถุดิบ</th>
                    <th className="py-3 px-4 text-right">ยอดในระบบเดิม</th>
                    <th className="py-3 px-4 text-right">ยอดที่ปรับใหม่</th>
                    <th className="py-3 px-4 text-right">ผลต่าง (Diff)</th>
                    <th className="py-3 px-4 text-right">ราคาต้นทุน / หน่วย</th>
                    <th className="py-3 px-4 text-right">มูลค่าผลต่าง (฿)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedAdjustment.items.map((item, idx) => {
                    const diff = Number(item.diffQuantity);
                    const cost = Number(item.ingredient?.costPerUnit || 0);
                    const diffVal = diff * cost;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-xs font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{item.ingredient?.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{item.ingredient?.code}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {Number(item.systemQuantity).toLocaleString()} {item.ingredient?.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {Number(item.actualQuantity).toLocaleString()} {item.ingredient?.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {diff === 0 ? (
                            <span className="text-slate-400 font-bold">0 {item.ingredient?.unit}</span>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black ${
                                diff > 0
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} {item.ingredient?.unit}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 text-xs">
                          ฿{cost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                          {diffVal === 0 ? (
                            <span className="text-slate-400">฿0.00</span>
                          ) : (
                            <span className={diffVal > 0 ? 'text-blue-700' : 'text-rose-600'}>
                              {diffVal > 0
                                ? `+฿${diffVal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `-฿${Math.abs(diffVal).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totalDiffCost = selectedAdjustment.items.reduce(
                      (sum, item) => sum + Number(item.diffQuantity) * Number(item.ingredient?.costPerUnit || 0),
                      0
                    );
                    return (
                      <tr className="bg-slate-50/90 font-bold border-t border-slate-200 text-xs">
                        <td colSpan={5} className="py-3 px-4 text-right text-slate-700">
                          มูลค่าผลต่างสุทธิรวม (Total Net Adjustment Cost):
                        </td>
                        <td colSpan={2} className="py-3 px-4 text-right font-mono text-sm">
                          {totalDiffCost === 0 ? (
                            <span className="text-slate-500">฿0.00</span>
                          ) : (
                            <span className={totalDiffCost > 0 ? 'text-blue-700' : 'text-rose-600'}>
                              {totalDiffCost > 0
                                ? `+฿${totalDiffCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `-฿${Math.abs(totalDiffCost).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })()}
                </tfoot>
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
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>อนุมัติคำขอนี้</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(selectedAdjustment)}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ปฏิเสธคำขอ</span>
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
            className="w-full max-w-5xl bg-white text-black p-4 sm:p-6 print:p-0 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-1 mb-2">
              {/* Top Right Reference Meta */}
              <div className="absolute top-0 right-0 text-right text-[10px] text-black font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>ฝ่ายควบคุมสต็อกและคลังสินค้า</div>
              </div>

              {/* Company & Document Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  ใบขออนุมัติปรับปรุงยอดสต็อกสินค้า (Stock Adjustment Request & Approval Voucher)
                </h3>
              </div>

              {/* Sub-Header: Document Number, Date, Store */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-b border-black pb-1 text-black">
                <div>
                  <span className="font-bold">เลขที่คำขอ </span>
                  <span className="font-mono font-bold ml-1">{selectedAdjustment.adjustmentNumber}</span>
                  {selectedAdjustment.store?.name && (
                    <span className="ml-3">
                      (<span className="font-bold">สาขา: </span>{selectedAdjustment.store.name})
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold">วันที่ยื่นคำขอ </span>
                  <span className="font-mono ml-1">
                    {new Date(selectedAdjustment.createdAt).toLocaleDateString('th-TH')} {new Date(selectedAdjustment.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                  <span className="font-bold ml-4">
                    สถานะ: {selectedAdjustment.status === 'PENDING' ? 'รอการอนุมัติ' : selectedAdjustment.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ'}
                  </span>
                </div>
              </div>

              {/* Sub-Header 2: Staff, Approver, Reason */}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-black font-bold">
                <div>
                  <span className="font-bold">ผู้ยื่นคำขอ: </span>
                  <span className="font-bold">{selectedAdjustment.requestedBy?.name} (@{selectedAdjustment.requestedBy?.username})</span>
                  {selectedAdjustment.approvedBy && (
                    <span className="ml-4">
                      <span className="font-bold">ผู้อนุมัติ/จัดการ: </span>
                      <span className="font-bold">{selectedAdjustment.approvedBy.name}</span>
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold">เหตุผล: </span>
                  <span className="font-bold">{selectedAdjustment.reason}</span>
                  {selectedAdjustment.rejectReason && (
                    <span className="ml-2 font-bold">(เหตุผลปฏิเสธ: {selectedAdjustment.rejectReason})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Adjustment Items Table with Price / Value */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-t border-b border-black text-black font-bold text-center bg-white">
                    <th className="py-1 px-1 border-r border-black w-8 text-center bg-white">ลำดับ</th>
                    <th className="py-1 px-1.5 border-r border-black w-24 bg-white">รหัสวัตถุดิบ</th>
                    <th className="py-1 px-2 border-r border-black text-left bg-white">ชื่อวัตถุดิบ</th>
                    <th className="py-1 px-1.5 border-r border-black text-right w-16 bg-white">ยอดเดิม</th>
                    <th className="py-1 px-1.5 border-r border-black text-right w-16 bg-white">ปรับใหม่</th>
                    <th className="py-1 px-1.5 border-r border-black text-right w-16 bg-white">ผลต่าง</th>
                    <th className="py-1 px-1 border-r border-black text-center w-12 bg-white">หน่วย</th>
                    <th className="py-1 px-1.5 border-r border-black text-right w-24 bg-white">ต้นทุน/หน่วย (฿)</th>
                    <th className="py-1 px-1.5 text-right w-28 bg-white">มูลค่าผลต่าง (฿)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {selectedAdjustment.items.map((item, idx) => {
                    const diff = Number(item.diffQuantity);
                    const cost = Number(item.ingredient?.costPerUnit || 0);
                    const diffVal = diff * cost;
                    return (
                      <tr key={item.id} className="border-b border-black">
                        <td className="py-0.5 px-1 text-center border-r border-black font-sans font-bold text-black">
                          {idx + 1}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black whitespace-nowrap text-black font-mono font-bold">
                          {item.ingredient?.code}
                        </td>
                        <td className="py-0.5 px-2 border-r border-black font-sans font-bold text-black truncate max-w-[200px]">
                          {item.ingredient?.name}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black text-right text-black font-mono font-bold">
                          {Number(item.systemQuantity).toLocaleString()}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black text-right font-bold text-black font-mono">
                          {Number(item.actualQuantity).toLocaleString()}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black text-right font-bold text-black font-mono">
                          {diff === 0 ? '0' : diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                        </td>
                        <td className="py-0.5 px-1 text-center font-sans font-bold text-black border-r border-black">
                          {item.ingredient?.unit}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black text-right font-mono font-bold text-black">
                          ฿{cost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-0.5 px-1.5 text-right font-bold font-mono text-black">
                          {diffVal === 0 ? (
                            '฿0.00'
                          ) : diffVal > 0 ? (
                            `+฿${diffVal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : (
                            `-฿${Math.abs(diffVal).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totalDiffCost = selectedAdjustment.items.reduce(
                      (sum, item) => sum + Number(item.diffQuantity) * Number(item.ingredient?.costPerUnit || 0),
                      0
                    );
                    return (
                      <tr className="border-t border-black bg-white font-bold text-[10px] text-black">
                        <td colSpan={3} className="py-1 px-2 text-left font-sans border-r border-black">
                          รวมรายการที่ขอปรับปรุง: <span className="font-mono font-bold">{selectedAdjustment.items.length}</span> รายการ
                        </td>
                        <td colSpan={4} className="py-1 px-2 text-right font-sans border-r border-black">
                          มูลค่าผลต่างสุทธิรวม (Total Net Adjustment Value):
                        </td>
                        <td colSpan={2} className="py-1 px-1.5 text-right font-mono font-bold text-black">
                          {totalDiffCost === 0 ? (
                            '฿0.00'
                          ) : totalDiffCost > 0 ? (
                            `+฿${totalDiffCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : (
                            `-฿${Math.abs(totalDiffCost).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )}
                        </td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>

            {/* Bottom 3 Signature Blocks (Matching User Form in Stock-Count) */}
            <div className="print-signature-section mt-4 pt-2 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
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
                <div className="font-bold text-black">ผู้อนุมัติ (ผู้จัดการ / บัญชี)</div>
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
          <div className="no-print w-full max-w-5xl bg-white rounded-2xl p-3.5 shadow-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ตัวอย่างพิมพ์รายงานสรุปรายการขอปรับปรุงสต็อก (A4 แนวนอน)
                </h3>
                <p className="text-[11px] text-slate-500">
                  เลือกสถานะที่ต้องการพิมพ์ หรือสลับพิมพ์เฉพาะที่อนุมัติแล้ว / ไม่อนุมัติ ได้ทันที
                </p>
              </div>
            </div>

            {/* Status Switcher in Print Preview */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPrintListStatus('APPROVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printListStatus === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                เฉพาะที่อนุมัติแล้ว ({metrics.approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setPrintListStatus('REJECTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printListStatus === 'REJECTED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                เฉพาะที่ไม่อนุมัติ ({metrics.rejectedCount})
              </button>
              <button
                type="button"
                onClick={() => setPrintListStatus('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printListStatus === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                เฉพาะรออนุมัติ ({metrics.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setPrintListStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  printListStatus === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                ทุกสถานะรวมกัน ({metrics.totalCount})
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
            className="w-full max-w-5xl bg-white text-black p-4 sm:p-6 print:p-0 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-1 mb-2">
              {/* Top Right Reference Meta */}
              <div className="absolute top-0 right-0 text-right text-[10px] text-black font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>ฝ่ายควบคุมสต็อกและคลังสินค้า</div>
              </div>

              {/* Company & Document Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  {printListStatus === 'APPROVED' && 'รายงานสรุปรายการขอปรับปรุงสต็อกสินค้า (เฉพาะรายการที่อนุมัติแล้ว - อัปเดตสต็อกจริง)'}
                  {printListStatus === 'REJECTED' && 'รายงานสรุปรายการขอปรับปรุงสต็อกสินค้า (เฉพาะรายการที่ไม่อนุมัติ / ปฏิเสธคำขอ)'}
                  {printListStatus === 'PENDING' && 'รายงานสรุปรายการขอปรับปรุงสต็อกสินค้า (เฉพาะรายการรอการอนุมัติ)'}
                  {printListStatus === 'ALL' && 'รายงานสรุปรายการขอปรับปรุงสต็อกสินค้า (ทุกสถานะคำขอ)'}
                </h3>
              </div>

              {/* Sub-Header: Document Number, Date, Store */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-b border-black pb-1 text-black">
                <div>
                  <span className="font-bold">สถานะที่เลือกพิมพ์: </span>
                  <span className="font-mono font-bold ml-1">
                    {printListStatus === 'ALL'
                      ? 'คำขอทั้งหมด'
                      : printListStatus === 'PENDING'
                      ? 'รอการอนุมัติ (Pending)'
                      : printListStatus === 'APPROVED'
                      ? 'อนุมัติแล้ว (Approved)'
                      : 'ไม่อนุมัติ (Rejected)'}
                  </span>
                  {storeFilter !== 'ALL' && (
                    <span className="ml-3">
                      (<span className="font-bold">สาขา: </span>{staffStores.find((s: any) => String(s.id) === storeFilter)?.name || 'เฉพาะสาขาที่เลือก'})
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold">วันที่พิมพ์: </span>
                  <span className="font-mono ml-1">
                    {new Date().toLocaleDateString('th-TH')}
                  </span>
                  <span className="font-bold ml-4">จำนวน: </span>
                  <span className="font-mono font-bold ml-1">{printAdjustments.length}</span> ฉบับ
                </div>
              </div>
            </div>

            {/* Adjustments Table */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  <tr className="border-t border-b border-black text-black font-bold text-center bg-white">
                    <th className="py-1 px-1 border-r border-black w-8 text-center bg-white">ลำดับ</th>
                    <th className="py-1 px-1.5 border-r border-black w-24 bg-white">เลขที่คำขอ</th>
                    <th className="py-1 px-1.5 border-r border-black w-20 bg-white">วันที่ยื่น</th>
                    <th className="py-1 px-2 border-r border-black text-left w-24 bg-white">ผู้ขอปรับปรุง</th>
                    <th className="py-1 px-2 border-r border-black text-left bg-white">เหตุผล</th>
                    <th className="py-1 px-2 border-r border-black text-left w-44 bg-white">รายการวัตถุดิบ & ผลต่าง</th>
                    <th className="py-1 px-1.5 border-r border-black text-right w-24 bg-white">มูลค่าผลต่าง (฿)</th>
                    <th className="py-1 px-1.5 border-r border-black text-center w-18 bg-white">สถานะ</th>
                    <th className="py-1 px-2 text-left w-24 bg-white">ผู้อนุมัติ/จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {printAdjustments.map((adj, idx) => {
                    const adjTotalDiffCost = adj.items.reduce(
                      (sum, it) => sum + Number(it.diffQuantity) * Number(it.ingredient?.costPerUnit || 0),
                      0
                    );
                    return (
                      <tr key={adj.id} className="border-b border-black">
                        <td className="py-0.5 px-1 text-center border-r border-black font-mono font-bold text-black">
                          {idx + 1}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black font-bold text-black font-mono">
                          {adj.adjustmentNumber}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black font-mono font-bold text-black text-center">
                          {new Date(adj.createdAt).toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-0.5 px-2 border-r border-black font-sans text-black text-left font-bold">
                          {adj.requestedBy?.name}
                        </td>
                        <td className="py-0.5 px-2 border-r border-black font-sans text-black text-left font-bold">
                          <div>{adj.reason}</div>
                          {adj.rejectReason && (
                            <div className="text-[8.5px] text-black font-bold">(เหตุผล: {adj.rejectReason})</div>
                          )}
                        </td>
                        <td className="py-0.5 px-2 border-r border-black font-sans text-left text-black font-bold">
                          {adj.items.map((i) => {
                            const diff = Number(i.diffQuantity);
                            return (
                              <div key={i.id} className="text-[9px] leading-tight text-black font-bold">
                                • {i.ingredient?.name}:{' '}
                                <span className="text-black font-bold font-mono">
                                  {diff > 0 ? `+${diff}` : diff} {i.ingredient?.unit}
                                </span>
                              </div>
                            );
                          })}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black font-mono text-black text-right font-bold text-[9px]">
                          {adjTotalDiffCost === 0 ? (
                            '฿0.00'
                          ) : adjTotalDiffCost > 0 ? (
                            `+฿${adjTotalDiffCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : (
                            `-฿${Math.abs(adjTotalDiffCost).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )}
                        </td>
                        <td className="py-0.5 px-1.5 border-r border-black text-center font-sans font-bold text-black">
                          {adj.status === 'PENDING' && <span>รออนุมัติ</span>}
                          {adj.status === 'APPROVED' && <span>อนุมัติแล้ว</span>}
                          {adj.status === 'REJECTED' && <span>ไม่อนุมัติ</span>}
                        </td>
                        <td className="py-0.5 px-2 font-sans text-black text-left text-[9px] font-bold">
                          {adj.approvedBy?.name || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {printAdjustments.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-black font-sans">
                        ไม่พบข้อมูลคำขอปรับปรุงสต็อกตามสถานะที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {(() => {
                    const grandTotalCost = printAdjustments.reduce(
                      (total, adj) =>
                        total +
                        adj.items.reduce(
                          (sum, it) => sum + Number(it.diffQuantity) * Number(it.ingredient?.costPerUnit || 0),
                          0
                        ),
                      0
                    );
                    return (
                      <tr className="border-t border-black bg-white font-bold text-[10px] text-black">
                        <td colSpan={5} className="py-1 px-2 text-right font-sans border-r border-black">
                          รวมคำขอทั้งหมดในรายงานนี้: <span className="font-mono font-bold">{printAdjustments.length}</span> ใบคำขอ
                        </td>
                        <td className="py-1 px-2 text-right font-sans border-r border-black">
                          มูลค่าผลต่างสุทธิ:
                        </td>
                        <td className="py-1 px-1.5 text-right font-mono font-bold text-black border-r border-black">
                          {grandTotalCost === 0 ? (
                            '฿0.00'
                          ) : grandTotalCost > 0 ? (
                            `+฿${grandTotalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : (
                            `-฿${Math.abs(grandTotalCost).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )}
                        </td>
                        <td colSpan={2} className="py-1 px-2 text-center font-sans text-black">
                          {printAdjustments.length} ฉบับ
                        </td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>

            {/* Bottom 3 Signature Blocks (Matching User Form in Stock-Count) */}
            <div className="print-signature-section mt-4 pt-2 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
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
                <div className="font-bold text-black">ผู้อนุมัติ (ผู้จัดการ / บัญชี)</div>
                <div className="text-[9.5px] text-black font-mono">วันที่: ...... / ...... / ..........</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Pagination from '@/components/Pagination';
import {
  ClipboardCheck,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  Calendar,
  Clock,
  X,
  FileText,
  User,
  ArrowRight,
  Filter,
  Printer,
  Sparkles,
  Check,
  AlertCircle,
  Warehouse,
  Store,
} from 'lucide-react';

interface Ingredient {
  id: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  currentStock: number;
  costPerUnit: number;
  minStock: number;
}

interface StaffStore {
  id: number;
  username: string;
  name: string;
}

interface StockCountItem {
  id: number;
  ingredientId: number;
  systemQuantity: number;
  actualQuantity: number;
  diffQuantity: number;
  status: 'MATCH' | 'SHORTAGE' | 'SURPLUS' | string;
  openingQuantity?: number;
  inboundQuantity?: number;
  salesQuantity?: number;
  wasteQuantity?: number;
  doh?: number;
  ingredient: {
    id: number;
    code: string;
    name: string;
    unit: string;
    category: string | null;
    costPerUnit: number;
  };
}

interface StockCountRecord {
  id: number;
  countNumber: string;
  countDate: string;
  status: string;
  location?: string | null;
  storeId?: number | null;
  storeName?: string | null;
  note: string | null;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  items: StockCountItem[];
}

export default function AdminStockCountPage() {
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-count', {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const stockCounts: StockCountRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.stockCounts) ? swrData.stockCounts : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  const storeBalances: Record<number, any[]> = useMemo(() => {
    return swrData?.success && swrData.storeBalances ? swrData.storeBalances : {};
  }, [swrData]);

  const loading = isLoading && stockCounts.length === 0;

  // Search & Filter
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL'); // ALL | WAREHOUSE | storeId

  // New Count Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields
  const [targetLocation, setTargetLocation] = useState<'WAREHOUSE' | 'STORE'>('STORE');
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  const [countNote, setCountNote] = useState('');
  const [syncStock, setSyncStock] = useState(true);
  const [countInputs, setCountInputs] = useState<Record<number, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [detailSearch, setDetailSearch] = useState<string>('');

  // Detail Modal
  const [selectedCount, setSelectedCount] = useState<StockCountRecord | null>(null);

  // Official Report Print Modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printRecord, setPrintRecord] = useState<StockCountRecord | null>(null);

  const handleOpenPrintReport = (sc: StockCountRecord) => {
    setPrintRecord(sc);
    setPrintModalOpen(true);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Distinct Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [ingredients]);

  // Current Store Balance Map for currently selected store
  const currentStoreBalances = useMemo(() => {
    if (targetLocation !== 'STORE' || !targetStoreId) return null;
    const list = storeBalances[Number(targetStoreId)] || [];
    const map = new Map<number, any>();
    list.forEach((item) => map.set(item.ingredientId, item));
    return map;
  }, [targetLocation, targetStoreId, storeBalances]);

  // Open New Stock Count Modal
  const openNewStockCount = () => {
    const firstStoreId = staffStores[0]?.id ? String(staffStores[0].id) : '';
    setTargetLocation('STORE');
    setTargetStoreId(firstStoreId);

    const list = storeBalances[Number(firstStoreId)] || [];
    const map = new Map<number, any>();
    list.forEach((item) => map.set(item.ingredientId, item));

    const initialInputs: Record<number, string> = {};
    ingredients.forEach((ing) => {
      const b = map.get(ing.id);
      initialInputs[ing.id] = String(b ? b.expectedStock : 0);
    });
    setCountInputs(initialInputs);

    setCountNote('ตรวจนับสินค้าจริงประจำรอบ');
    setSyncStock(true);
    setSelectedCategory('ALL');
    setModalSearch('');
    setFormError(null);
    setModalOpen(true);
  };

  // Switch location in modal
  const handleLocationChange = (loc: 'WAREHOUSE' | 'STORE') => {
    setTargetLocation(loc);
    const updated: Record<number, string> = {};
    if (loc === 'WAREHOUSE') {
      ingredients.forEach((ing) => {
        updated[ing.id] = String(Number(ing.currentStock));
      });
    } else {
      const activeStoreId = targetStoreId || (staffStores[0]?.id ? String(staffStores[0].id) : '');
      const list = storeBalances[Number(activeStoreId)] || [];
      const map = new Map<number, any>();
      list.forEach((item) => map.set(item.ingredientId, item));
      ingredients.forEach((ing) => {
        const b = map.get(ing.id);
        updated[ing.id] = String(b ? b.expectedStock : 0);
      });
    }
    setCountInputs(updated);
  };

  // Switch store in modal
  const handleStoreSelectChange = (newStoreId: string) => {
    setTargetStoreId(newStoreId);
    const list = storeBalances[Number(newStoreId)] || [];
    const map = new Map<number, any>();
    list.forEach((item) => map.set(item.ingredientId, item));
    const updated: Record<number, string> = {};
    ingredients.forEach((ing) => {
      const b = map.get(ing.id);
      updated[ing.id] = String(b ? b.expectedStock : 0);
    });
    setCountInputs(updated);
  };

  // Quick fill all inputs with current store expected stock
  const handleFillAllCurrent = () => {
    const list = storeBalances[Number(targetStoreId)] || [];
    const map = new Map<number, any>();
    list.forEach((item) => map.set(item.ingredientId, item));
    const updated: Record<number, string> = {};
    ingredients.forEach((ing) => {
      const b = map.get(ing.id);
      updated[ing.id] = String(b ? b.expectedStock : 0);
    });
    setCountInputs(updated);
  };

  // Quick clear all inputs
  const handleClearAll = () => {
    const updated: Record<number, string> = {};
    ingredients.forEach((ing) => {
      updated[ing.id] = '';
    });
    setCountInputs(updated);
  };

  // Filtered Ingredients in Modal
  const filteredModalIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (selectedCategory !== 'ALL' && ing.category !== selectedCategory) return false;
      if (modalSearch.trim()) {
        const query = modalSearch.toLowerCase().trim();
        const matchName = ing.name.toLowerCase().includes(query);
        const matchCode = ing.code.toLowerCase().includes(query);
        const matchCat = ing.category?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [ingredients, selectedCategory, modalSearch]);

  // Modal Live Summary
  const modalSummary = useMemo(() => {
    let matchCount = 0;
    let shortageCount = 0;
    let surplusCount = 0;
    let totalItemsCounted = 0;
    let netVarianceValue = 0;

    ingredients.forEach((ing) => {
      const val = countInputs[ing.id];
      if (val !== undefined && val.trim() !== '') {
        const actual = parseFloat(val);
        if (!isNaN(actual)) {
          totalItemsCounted++;
          let system = Number(ing.currentStock);
          if (targetLocation === 'STORE' && currentStoreBalances) {
            const b = currentStoreBalances.get(ing.id);
            system = b ? b.expectedStock : 0;
          }
          const diff = actual - system;
          const cost = Number(ing.costPerUnit || 0);

          if (diff === 0) {
            matchCount++;
          } else if (diff < 0) {
            shortageCount++;
            netVarianceValue += diff * cost;
          } else {
            surplusCount++;
            netVarianceValue += diff * cost;
          }
        }
      }
    });

    return {
      totalItemsCounted,
      matchCount,
      shortageCount,
      surplusCount,
      netVarianceValue,
    };
  }, [ingredients, countInputs, targetLocation, currentStoreBalances]);

  // Filtered Items in Detail Modal
  const filteredDetailItems = useMemo(() => {
    if (!selectedCount?.items) return [];
    if (!detailSearch.trim()) return selectedCount.items;
    const q = detailSearch.toLowerCase().trim();
    return selectedCount.items.filter((it) =>
      it.ingredient?.name.toLowerCase().includes(q) ||
      it.ingredient?.code.toLowerCase().includes(q)
    );
  }, [selectedCount, detailSearch]);

  // Submit New Count Audit
  const handleSubmitCount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (targetLocation === 'STORE' && !targetStoreId) {
      setFormError('กรุณาเลือกร้านค้า / จุดขายที่ทำการตรวจนับ');
      return;
    }

    const itemsToSubmit = Object.entries(countInputs)
      .filter(([_, val]) => val !== undefined && val.trim() !== '' && !isNaN(parseFloat(val)))
      .map(([ingId, val]) => ({
        ingredientId: Number(ingId),
        actualQuantity: parseFloat(val),
      }));

    if (itemsToSubmit.length === 0) {
      setFormError('กรุณากรอกยอดที่นับได้จริงอย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/stock-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: targetLocation,
          storeId: targetLocation === 'STORE' ? Number(targetStoreId) : null,
          note: countNote.trim(),
          syncStock,
          items: itemsToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'บันทึกตรวจนับไม่สำเร็จ');
      }

      showToast(data.message || 'บันทึกตรวจนับสต็อกจริงเรียบร้อยแล้ว');
      await mutate();
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered History
  const filteredCounts = useMemo(() => {
    return stockCounts.filter((sc) => {
      // Location filter
      if (locationFilter === 'WAREHOUSE') {
        if (sc.location === 'STORE' || sc.storeId) return false;
      } else if (locationFilter !== 'ALL') {
        const staffId = Number(locationFilter);
        if (sc.storeId !== staffId) return false;
      }

      // Search keyword
      const q = search.toLowerCase().trim();
      if (q) {
        const matchNum = sc.countNumber.toLowerCase().includes(q);
        const matchUser = sc.createdBy?.name.toLowerCase().includes(q);
        const matchStore = sc.storeName?.toLowerCase().includes(q);
        const matchNote = sc.note?.toLowerCase().includes(q);
        if (!matchNum && !matchUser && !matchStore && !matchNote) return false;
      }
      return true;
    });
  }, [stockCounts, locationFilter, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, locationFilter]);

  // Paginated counts (10 items per page for screen view)
  const paginatedCounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCounts.slice(start, start + pageSize);
  }, [filteredCounts, currentPage, pageSize]);

  // Overall Statistics across history
  const stats = useMemo(() => {
    let totalAudits = stockCounts.length;
    let totalItemsAudited = 0;
    let totalMatches = 0;
    let totalShortages = 0;
    let totalSurplus = 0;

    stockCounts.forEach((sc) => {
      sc.items.forEach((item) => {
        totalItemsAudited++;
        if (item.status === 'MATCH') totalMatches++;
        else if (item.status === 'SHORTAGE') totalShortages++;
        else if (item.status === 'SURPLUS') totalSurplus++;
      });
    });

    return { totalAudits, totalItemsAudited, totalMatches, totalShortages, totalSurplus };
  }, [stockCounts]);

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
        {/* Top Action Bar */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <button
            onClick={openNewStockCount}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ ทำรายการตรวจนับสต็อกจริงใหม่</span>
          </button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Audits */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                รอบตรวจนับทั้งหมด
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
              {stats.totalAudits} <span className="text-xs font-semibold text-slate-500">ครั้ง</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">รวม {stats.totalItemsAudited} รายการที่นับ</p>
          </div>

          {/* Card 2: Matched Items */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                สต็อกตรงกัน 100%
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
              {stats.totalMatches} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">ยอดนับตรงกับระบบ</p>
          </div>

          {/* Card 3: Shortage Items */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                สต็อกขาดหาย (Shortage)
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-red-600 mt-1 font-mono">
              {stats.totalShortages} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">ยอดจริงน้อยกว่าระบบ</p>
          </div>

          {/* Card 4: Surplus Items */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                สต็อกเกิน (Surplus)
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-blue-600 mt-1 font-mono">
              {stats.totalSurplus} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">ยอดจริงมากกว่าระบบ</p>
          </div>
        </div>

        {/* History Audit Table Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Table Header Filter & Search */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              <h2 className="font-bold text-sm text-slate-800">
                ประวัติการตรวจนับสต็อก ({filteredCounts.length} รอบ)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Location Filter Dropdown */}
              <div className="relative">
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="ALL">🏢 ทุกจุดตรวจนับ</option>
                  <option value="WAREHOUSE">📦 คลังสินค้าส่วนกลาง</option>
                  {staffStores.map((st) => (
                    <option key={st.id} value={st.id}>
                      🏪 {st.name} (@{st.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขที่ใบนับ, ชื่อร้าน, ผู้ตรวจ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs font-medium">กำลังโหลดประวัติการตรวจนับสต็อก...</p>
            </div>
          ) : filteredCounts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">ยังไม่มีประวัติการตรวจนับสต็อกที่ตรงกับเงื่อนไข</p>
              <p className="max-w-md mx-auto text-xs text-slate-400">
                กดปุ่ม <span className="text-emerald-700 font-bold">&quot;+ ทำรายการตรวจนับสต็อกจริงใหม่&quot;</span> ด้านบน เพื่อเริ่มตรวจนับของคลังกลางหรือหน้าร้านค้า
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12 text-slate-400">#</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ใบนับสต็อก</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">วันที่ & เวลาตรวจนับ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">จุดตรวจนับ / ร้านค้า</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">ผู้ตรวจนับ</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">จำนวนรายการ</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">สรุปผลต่าง (Variance)</th>
                    <th className="py-2.5 px-3">หมายเหตุ</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedCounts.map((sc, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const matchCount = sc.items.filter((i) => i.status === 'MATCH').length;
                    const shortageCount = sc.items.filter((i) => i.status === 'SHORTAGE').length;
                    const surplusCount = sc.items.filter((i) => i.status === 'SURPLUS').length;
                    const isStore = sc.location === 'STORE' || Boolean(sc.storeId);

                    return (
                      <tr
                        key={sc.id}
                        onClick={() => setSelectedCount(sc)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Sequence Row Number */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                          {rowNumber}
                        </td>

                        {/* Count Number */}
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 group-hover:underline">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{sc.countNumber}</span>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          <div className="font-bold text-slate-700">
                            {new Date(sc.countDate || sc.createdAt).toLocaleDateString('th-TH')}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sc.countDate || sc.createdAt).toLocaleTimeString('th-TH')} น.
                          </div>
                        </td>

                        {/* Store / Location Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isStore ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              <Store className="w-3.5 h-3.5 text-amber-700" />
                              <span>จุดขาย: {sc.storeName || 'หน้าร้าน'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
                              <span>คลังสินค้าส่วนกลาง</span>
                            </span>
                          )}
                        </td>

                        {/* Created By */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{sc.createdBy?.name || 'Admin'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{sc.createdBy?.username} ({sc.createdBy?.role})
                          </div>
                        </td>

                        {/* Total Items */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                          {sc.items.length} รายการ
                        </td>

                        {/* Variance Badges */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {matchCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" /> ตรง {matchCount}
                              </span>
                            )}
                            {shortageCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <TrendingDown className="w-3 h-3" /> ขาด {shortageCount}
                              </span>
                            )}
                            {surplusCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <TrendingUp className="w-3 h-3" /> เกิน {surplusCount}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Note */}
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                          {sc.note || '-'}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenPrintReport(sc)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer border border-emerald-200 flex items-center gap-1"
                              title="พิมพ์รายงานผลต่างตามแบบฟอร์มทางการ"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-600" />
                              <span>พิมพ์รายงาน</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCount(sc)}
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
                totalItems={filteredCounts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Create New Physical Stock Count */}
      {modalOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-6xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 h-[92vh] max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    บันทึกผลการตรวจนับสต็อกจริง (Physical Stock Count)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ตรวจนับสต็อกจริงจุดขายหน้าร้าน เพื่อกระทบยอดที่ควรมีและตัดยอดผลต่างอย่างถูกต้อง
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
              <div className="mt-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Store Selector */}
            <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 shrink-0 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-700" />
                  <span>เลือกร้านค้า / จุดขายที่ทำการตรวจนับสต็อก:</span>
                  <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  🏪 โหมดตรวจนับสต็อกหน้าร้าน
                </span>
              </div>

              <select
                value={targetStoreId}
                onChange={(e) => handleStoreSelectChange(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border-2 border-amber-300 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
              >
                {staffStores.map((st) => (
                  <option key={st.id} value={st.id}>
                    🏪 {st.name} (@{st.username})
                  </option>
                ))}
              </select>

              <div className="p-2 rounded-xl bg-amber-100/60 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  <strong>สูตรกระทบยอดหน้าร้าน:</strong> [ยอดยกมา] + [เบิกเข้าเพิ่ม] - [ขายไปตามสูตร] = <strong>[สต็อกที่ควรมีในร้าน]</strong> (ระบบดึงยอดที่ควรมีมาเทียบผลต่างให้อัตโนมัติ)
                </span>
              </div>
            </div>

            {/* Quick Filter, Search & Actions Bar */}
            <div className="mt-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    selectedCategory === 'ALL'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทั้งหมด ({ingredients.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search input & Quick Helper Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อสินค้า / วัตถุดิบ..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFillAllCurrent}
                  className="px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 cursor-pointer shrink-0"
                  title="ใส่ค่ายอดที่ควรมีลงทุกช่อง"
                >
                  ใส่ยอดที่ควรมีในร้านทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer shrink-0"
                >
                  ล้างค่า
                </button>
              </div>
            </div>

            {/* Count Input Table (Flex-1 with min-h-0 so it fits inside the card without overflowing) */}
            <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto border-2 border-slate-200 rounded-2xl scrollbar-thin shadow-2xs bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12 text-slate-400 font-normal">#</th>
                    <th className="py-2.5 px-3">รายการสินค้า / วัตถุดิบ</th>
                    {targetLocation === 'STORE' ? (
                      <>
                        <th className="py-2.5 px-2 text-right w-20">ยอดยกมา</th>
                        <th className="py-2.5 px-2 text-right w-20 text-emerald-700">เบิกเข้า (+)</th>
                        <th className="py-2.5 px-2 text-right w-20 text-red-700">ขายตามสูตร (-)</th>
                        <th className="py-2.5 px-2.5 text-right w-28 bg-amber-50/80 text-amber-950 font-black">ควรมีในร้าน</th>
                      </>
                    ) : (
                      <th className="py-2.5 px-3 text-right">สต็อกในระบบ (คลังกลาง)</th>
                    )}
                    <th className="py-2.5 px-3 text-center w-36">ยอดนับได้จริง *</th>
                    <th className="py-2.5 px-3 text-right">ผลต่าง (Variance)</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredModalIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={targetLocation === 'STORE' ? 9 : 6} className="py-12 text-center text-slate-400">
                        ไม่พบรายการสินค้าหรือวัตถุดิบที่ตรงกับการค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredModalIngredients.map((ing, idx) => {
                      let systemQty = Number(ing.currentStock);
                      let openingQty = 0;
                      let inboundQty = 0;
                      let salesQty = 0;

                      if (targetLocation === 'STORE' && currentStoreBalances) {
                        const b = currentStoreBalances.get(ing.id);
                        openingQty = b ? b.openingQuantity : 0;
                        inboundQty = b ? b.inboundQuantity : 0;
                        salesQty = b ? b.salesQuantity : 0;
                        systemQty = b ? b.expectedStock : 0;
                      }

                      const inputValue = countInputs[ing.id] ?? '';
                      const actualQty = parseFloat(inputValue);
                      const hasInput = inputValue.trim() !== '' && !isNaN(actualQty);
                      const diff = hasInput ? actualQty - systemQty : 0;

                      let statusBadge = (
                        <span className="text-slate-300 text-xs">-</span>
                      );
                      if (hasInput) {
                        if (diff === 0) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3.5 h-3.5" /> สต็อกตรง
                            </span>
                          );
                        } else if (diff < 0) {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <TrendingDown className="w-3.5 h-3.5" /> ขาด {Math.abs(diff)}
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <TrendingUp className="w-3.5 h-3.5" /> เกิน +{diff}
                            </span>
                          );
                        }
                      }

                      return (
                        <tr key={ing.id} className="hover:bg-amber-50/40 transition-colors border-b border-slate-100">
                          {/* Row Number */}
                          <td className="py-2.5 px-3 text-center text-xs text-slate-400 font-mono">
                            {idx + 1}
                          </td>

                          {/* Name & Details */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                              <span>{ing.name}</span>
                              {ing.category && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  {ing.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              รหัส: {ing.code}
                            </div>
                          </td>

                          {/* Location Specific Columns */}
                          {targetLocation === 'STORE' ? (
                            <>
                              <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-600">
                                {openingQty.toLocaleString()} <span className="text-[10px] text-slate-400">{ing.unit}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-xs text-emerald-700 font-bold">
                                {inboundQty > 0 ? `+${inboundQty.toLocaleString()}` : '0'} <span className="text-[10px] text-slate-400">{ing.unit}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-xs text-red-700 font-bold">
                                {salesQty > 0 ? `-${salesQty.toLocaleString()}` : '0'} <span className="text-[10px] text-slate-400">{ing.unit}</span>
                              </td>
                              <td className="py-2.5 px-2.5 text-right bg-amber-50/80 font-mono font-black text-xs sm:text-sm text-amber-950">
                                {systemQty.toLocaleString()} <span className="text-[10px] font-semibold text-slate-500 ml-1">{ing.unit}</span>
                              </td>
                            </>
                          ) : (
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-black text-xs sm:text-sm text-slate-800">
                                {systemQty.toLocaleString()}
                              </span>
                              <span className="text-xs font-semibold text-slate-500 ml-1.5">{ing.unit}</span>
                            </td>
                          )}

                          {/* Actual Input */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={inputValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setCountInputs((prev) => ({
                                      ...prev,
                                      [ing.id]: val,
                                    }));
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="w-24 sm:w-28 px-2.5 py-1 text-xs sm:text-sm text-right font-mono font-black rounded-xl border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 bg-white shadow-2xs"
                              />
                              <span className="text-[11px] font-bold text-slate-600 w-8 text-left truncate">{ing.unit}</span>
                            </div>
                          </td>

                          {/* Diff */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm">
                            {hasInput ? (
                              diff === 0 ? (
                                <span className="text-emerald-600 font-black">0</span>
                              ) : diff < 0 ? (
                                <span className="text-red-600 font-black">
                                  {diff.toLocaleString()} {ing.unit}
                                </span>
                              ) : (
                                <span className="text-blue-600 font-black">
                                  +{diff.toLocaleString()} {ing.unit}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            {statusBadge}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary & Form Settings */}
            <form onSubmit={handleSubmitCount} className="mt-2 pt-2 border-t border-slate-100 space-y-2 shrink-0 bg-white">
              {/* Live Metric Ribbon */}
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">ระบุแล้ว:</span>
                  <div className="font-mono font-bold text-slate-800">
                    {modalSummary.totalItemsCounted} / {ingredients.length} ชนิด
                  </div>
                </div>
                <div>
                  <span className="text-emerald-700">สต็อกตรง:</span>
                  <div className="font-mono font-bold text-emerald-800">
                    {modalSummary.matchCount} รายการ
                  </div>
                </div>
                <div>
                  <span className="text-red-700">สต็อกขาด:</span>
                  <div className="font-mono font-bold text-red-700">
                    {modalSummary.shortageCount} รายการ
                  </div>
                </div>
                <div>
                  <span className="text-blue-700">สต็อกเกิน:</span>
                  <div className="font-mono font-bold text-blue-700">
                    {modalSummary.surplusCount} รายการ
                  </div>
                </div>
              </div>

              {/* Note & Sync Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <div>
                  <input
                    type="text"
                    value={countNote}
                    onChange={(e) => setCountNote(e.target.value)}
                    placeholder="หมายเหตุการตรวจนับ (ถ้ามี)..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncStock}
                      onChange={(e) => setSyncStock(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      🔄 บันทึกผลการตรวจนับสต็อกหน้าร้าน (ปรับปรุงยอดยกมาตามที่นับได้จริง)
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || modalSummary.totalItemsCounted === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{submitting ? 'กำลังบันทึก...' : '💾 ยืนยันบันทึกผลการตรวจนับ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Stock Count Audit Detail */}
      {selectedCount && !printModalOpen && (
        <div className="print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 h-[92vh] max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    ใบบันทึกผลตรวจนับสินค้าจริง #{selectedCount.countNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    วันที่ {new Date(selectedCount.countDate || selectedCount.createdAt).toLocaleString('th-TH')} น.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPrintReport(selectedCount)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="พิมพ์ใบบันทึกผลตรวจนับสินค้าจริง"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์เอกสาร</span>
                </button>
                <button
                  onClick={() => setSelectedCount(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Info Ribbon */}
            <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div>
                <span className="text-slate-400">จุดตรวจนับ:</span>
                <div className="font-bold text-slate-800 mt-0.5">
                  {selectedCount.location === 'STORE' || selectedCount.storeId
                    ? `🏪 จุดขาย: ${selectedCount.storeName}`
                    : '📦 คลังสินค้าส่วนกลาง JJ Mall'}
                </div>
              </div>
              <div>
                <span className="text-slate-400">ผู้ตรวจนับ:</span>
                <div className="font-bold text-slate-800 mt-0.5">
                  {selectedCount.createdBy?.name} (@{selectedCount.createdBy?.username})
                </div>
              </div>
              <div>
                <span className="text-slate-400">จำนวนที่นับ:</span>
                <div className="font-bold text-slate-800 mt-0.5">
                  {selectedCount.items.length} รายการ
                </div>
              </div>
              <div>
                <span className="text-slate-400">หมายเหตุ:</span>
                <div className="font-bold text-slate-800 mt-0.5 truncate">
                  {selectedCount.note || '-'}
                </div>
              </div>
            </div>

            {/* Search Filter inside Detail Modal */}
            <div className="mt-2.5 flex items-center justify-between gap-2 shrink-0">
              <div className="text-xs font-bold text-slate-700">
                รายการวัตถุดิบทั้งหมด ({selectedCount.items.length} รายการ)
              </div>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาในรายการที่นับ..."
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>
            </div>

            {/* Itemized Detail Table */}
            <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto border-2 border-slate-200 rounded-2xl scrollbar-thin shadow-2xs bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3">รหัส / รายการสินค้า-วัตถุดิบ</th>
                    {selectedCount.location === 'STORE' || selectedCount.storeId ? (
                      <>
                        <th className="py-2.5 px-2 text-right w-20">ยอดยกมา</th>
                        <th className="py-2.5 px-2 text-right w-20 text-emerald-700">เบิกเข้า (+)</th>
                        <th className="py-2.5 px-2 text-right w-20 text-red-700">ขายตามสูตร (-)</th>
                        <th className="py-2.5 px-2.5 text-right w-28 bg-amber-50/80 text-amber-950 font-black">ควรมีในร้าน</th>
                      </>
                    ) : (
                      <th className="py-2.5 px-3 text-right">ยอดในคลังกลาง</th>
                    )}
                    <th className="py-2.5 px-3 text-right">ยอดนับจริง</th>
                    <th className="py-2.5 px-3 text-right">ผลต่าง (Variance)</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredDetailItems.length === 0 ? (
                    <tr>
                      <td colSpan={selectedCount.location === 'STORE' || selectedCount.storeId ? 8 : 5} className="py-12 text-center text-slate-400">
                        ไม่พบรายการที่ตรงกับการค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredDetailItems.map((item) => {
                      const diff = Number(item.diffQuantity);
                      const isStoreCount = selectedCount.location === 'STORE' || Boolean(selectedCount.storeId);
                      const openQty = Number(item.openingQuantity ?? 0);
                      const inQty = Number(item.inboundQuantity ?? 0);
                      const saleQty = Number(item.salesQuantity ?? 0);

                      return (
                        <tr key={item.id} className="hover:bg-amber-50/40 transition-colors border-b border-slate-100">
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                              <span>{item.ingredient?.name}</span>
                              {item.ingredient?.category && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  {item.ingredient.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              รหัส: {item.ingredient?.code}
                            </div>
                          </td>

                          {isStoreCount ? (
                            <>
                              <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-600">
                                {openQty.toLocaleString()} <span className="text-[10px] text-slate-400">{item.ingredient?.unit}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-xs text-emerald-700 font-bold">
                                {inQty > 0 ? `+${inQty.toLocaleString()}` : '0'} <span className="text-[10px] text-slate-400">{item.ingredient?.unit}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-xs text-red-700 font-bold">
                                {saleQty > 0 ? `-${saleQty.toLocaleString()}` : '0'} <span className="text-[10px] text-slate-400">{item.ingredient?.unit}</span>
                              </td>
                              <td className="py-2.5 px-2.5 text-right bg-amber-50/80 font-mono font-black text-xs sm:text-sm text-amber-950">
                                {Number(item.systemQuantity).toLocaleString()} <span className="text-[10px] font-semibold text-slate-500 ml-1">{item.ingredient?.unit}</span>
                              </td>
                            </>
                          ) : (
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-xs sm:text-sm text-slate-700">
                                {Number(item.systemQuantity).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-500 ml-1">{item.ingredient?.unit}</span>
                            </td>
                          )}

                          <td className="py-2.5 px-3 text-right">
                            <span className="font-mono font-black text-xs sm:text-sm text-slate-900">
                              {Number(item.actualQuantity).toLocaleString()}
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 ml-1">{item.ingredient?.unit}</span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm">
                            {diff === 0 ? (
                              <span className="text-emerald-600 font-black">0</span>
                            ) : diff < 0 ? (
                              <span className="text-red-600 font-black">
                                {diff.toLocaleString()} {item.ingredient?.unit}
                              </span>
                            ) : (
                              <span className="text-blue-600 font-black">
                                +{diff.toLocaleString()} {item.ingredient?.unit}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {item.status === 'MATCH' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3.5 h-3.5" /> สต็อกตรง
                              </span>
                            ) : item.status === 'SHORTAGE' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                <TrendingDown className="w-3.5 h-3.5" /> ขาดหาย
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <TrendingUp className="w-3.5 h-3.5" /> ยอดเกิน
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => handleOpenPrintReport(selectedCount)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบบันทึกผลตรวจนับสินค้าจริง / รายงานผลต่าง (ตามแบบฟอร์มทางการ)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCount(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Official Printable Report (ตามแบบฟอร์มรายงานผลต่าง/ใบขออนุมัติปรับปรุงสต็อก) */}
      {printModalOpen && printRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto print:static print:inset-auto print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
          {/* Top Control Toolbar (Hidden when printing) */}
          <div className="no-print w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างก่อนพิมพ์: ใบบันทึกผลตรวจนับสินค้าจริง / รายงานผลต่างจากการตรวจนับสินค้า
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
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
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

          {/* Printable Document Sheet (A4 Landscape Style) */}
          <div
            id="official-stock-print-report"
            className="w-full max-w-5xl bg-white text-black p-4 sm:p-6 print:p-0 shadow-2xl rounded-xl border border-black font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-1 mb-2">
              {/* Top Right Reference Meta */}
              <div className="absolute top-0 right-0 text-right text-[10px] text-black font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>RTTR080ATHA.QRP</div>
              </div>

              {/* Company & Document Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-black tracking-tight">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-black">
                  ใบบันทึกผลตรวจนับสินค้าจริง / รายงานผลต่างจากการตรวจนับสินค้า (ใบขออนุมัติปรับปรุงสต็อก)
                </h3>
              </div>

              {/* Sub-Header: Document Number, Date, Store */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-b border-black pb-1 text-black">
                <div>
                  <span className="font-bold">เลขที่เอกสาร </span>
                  <span className="font-mono font-bold ml-1">{printRecord.countNumber}</span>
                  {printRecord.storeName && (
                    <span className="ml-3">
                      (<span className="font-bold">จุดตรวจนับ: </span>{printRecord.storeName})
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold">วันที่ตรวจนับ </span>
                  <span className="font-mono ml-1">
                    {new Date(printRecord.countDate || printRecord.createdAt).toLocaleDateString('th-TH')}
                  </span>
                  <span className="font-bold ml-4">ตรวจนับหลังปิดร้าน</span>
                </div>
              </div>
            </div>

            {/* Official Report Table */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse text-[10px] leading-tight text-black border border-black">
                <thead>
                  {/* Super Header Groups */}
                  <tr className="border-t border-b border-black text-black font-bold text-center bg-white">
                    <th rowSpan={2} className="py-1 px-1 border-r border-black w-8 text-center bg-white">ลำดับ</th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-black w-24 bg-white">รหัสสินค้า</th>
                    <th rowSpan={2} className="py-1 px-2 border-r border-black text-left bg-white">ชื่อสินค้า</th>
                    <th rowSpan={2} className="py-1 px-1 border-r border-black w-12 text-center bg-white">หน่วยนับ</th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-black w-14 text-right bg-white">ยกมา</th>
                    <th colSpan={1} className="py-0.5 px-1 border-r border-black bg-white text-center whitespace-nowrap">
                      &lt;------------ รายการรับ ------------&gt;
                    </th>
                    <th colSpan={2} className="py-0.5 px-1 border-r border-black bg-white text-center whitespace-nowrap">
                      &lt;------------ รายการจ่าย ------------&gt;
                    </th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-black text-right w-20 bg-white">
                      คงเหลือจาก<br />การคำนวณ
                    </th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-black text-right w-20 bg-white">
                      คงเหลือจาก<br />การตรวจนับ
                    </th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-black text-right w-16 bg-white">
                      ผลต่าง
                    </th>
                    <th rowSpan={2} className="py-1 px-1 text-right w-14 bg-white">
                      DOH<br />(Day)
                    </th>
                  </tr>

                  {/* Sub Header Columns */}
                  <tr className="border-b border-black text-black font-bold text-center bg-white">
                    <th className="py-0.5 px-1 border-r border-black text-right w-18 bg-white">
                      ปรับปรุงเพิ่ม
                    </th>
                    <th className="py-0.5 px-1 border-r border-black text-right w-14 bg-white">ขาย</th>
                    <th className="py-0.5 px-1 border-r border-black text-right w-14 bg-white">จ่ายทำลาย</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black font-mono text-[9.5px] text-black">
                  {printRecord.items.map((item, idx) => {
                    const sysQty = Number(item.systemQuantity);
                    const actQty = Number(item.actualQuantity);
                    const diff = Number(item.diffQuantity);
                    const openQty = item.openingQuantity !== undefined ? item.openingQuantity : sysQty;
                    const inQty = item.inboundQuantity !== undefined ? item.inboundQuantity : 0;
                    const saleQty = item.salesQuantity !== undefined ? item.salesQuantity : 0;
                    const wasteQty = item.wasteQuantity !== undefined ? item.wasteQuantity : 0;
                    const dohVal = item.doh !== undefined ? item.doh : 0;

                    return (
                      <tr key={item.id} className="border-b border-black">
                        {/* No. */}
                        <td className="py-0.5 px-1 text-center border-r border-black font-sans text-black">
                          {idx + 1}
                        </td>

                        {/* Product Code */}
                        <td className="py-0.5 px-1.5 border-r border-black whitespace-nowrap text-black font-mono font-bold">
                          {item.ingredient?.code}
                        </td>

                        {/* Product Name */}
                        <td className="py-0.5 px-2 border-r border-black font-sans font-medium text-black truncate max-w-[180px]">
                          {item.ingredient?.name}
                        </td>

                        {/* Unit */}
                        <td className="py-0.5 px-1 border-r border-black text-center font-sans text-black">
                          {item.ingredient?.unit}
                        </td>

                        {/* ยกมา (Opening) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-black text-black">
                          {openQty < 0 ? `(${Math.abs(openQty).toFixed(2)})` : openQty.toFixed(2)}
                        </td>

                        {/* ปรับปรุงเพิ่ม (รับเข้า) */}
                        <td className="py-0.5 px-1 border-r border-black text-right text-black">
                          {inQty > 0 ? inQty.toFixed(2) : ''}
                        </td>

                        {/* ขาย (Sales) */}
                        <td className="py-0.5 px-1 border-r border-black text-right text-black">
                          {saleQty > 0 ? `(${saleQty.toFixed(2)})` : ''}
                        </td>

                        {/* จ่ายทำลาย (Waste) */}
                        <td className="py-0.5 px-1 border-r border-black text-right text-black">
                          {wasteQty > 0 ? `(${wasteQty.toFixed(2)})` : ''}
                        </td>

                        {/* คงเหลือจากการคำนวณ (System) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-black font-bold text-black">
                          {sysQty.toFixed(2)}
                        </td>

                        {/* คงเหลือจากการตรวจนับ (Actual) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-black font-bold text-black">
                          {actQty.toFixed(2)}
                        </td>

                        {/* ผลต่าง (Variance) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-black font-bold text-black">
                          {diff === 0 ? '0.00' : diff < 0 ? `(${Math.abs(diff).toFixed(2)})` : `+${diff.toFixed(2)}`}
                        </td>

                        {/* DOH (Day) */}
                        <td className="py-0.5 px-1 text-right text-black font-bold">
                          {dohVal > 0 ? dohVal.toFixed(1) : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Note Section */}
            {printRecord.note && (
              <div className="mt-2 pt-1 border-t border-black text-[9.5px] text-black">
                <span className="font-bold">หมายเหตุการตรวจนับ: </span>
                <span>{printRecord.note}</span>
              </div>
            )}

            {/* Bottom 3 Signature Blocks (Matching User Form) */}
            <div className="print-signature-section mt-4 pt-2 grid grid-cols-3 gap-6 text-center text-[10px] font-sans text-black">
              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้ขออนุมัติ (ร้านค้า)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้อนุมัติ (ร้านค้า)</div>
                <div className="text-[9.5px] text-black font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-black font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-black">ผู้อนุมัติ (บัญชี)</div>
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

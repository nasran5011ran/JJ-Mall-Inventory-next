'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { useAuth } from '@/context/auth-context';
import { confirmDeleteAlert, showSuccessAlert, showErrorAlert } from '@/lib/sweetalert';
import Pagination from '@/components/Pagination';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ArrowDownToLine,
  ChefHat,
  Eye,
  TrendingDown,
  DollarSign,
  Store,
  Warehouse,
  ArrowUpFromLine,
} from 'lucide-react';

interface StaffStore {
  id: number;
  name: string;
  username: string;
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
  hasStockHistory: boolean;
}

interface IngredientItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  status: 'ACTIVE' | 'INACTIVE';
  _count?: {
    recipeItems: number;
    stockTransactions: number;
  };
}

const PRESET_UNITS = [
  'กรัม',
  'มล.',
  'กิโลกรัม',
  'ลิตร',
  'ใบ',
  'ชิ้น',
  'ขวด',
  'กล่อง',
  'แพ็ค',
  'หลอด',
  'ซอง',
  'ถุง',
  'แก้ว',
];

const DEFAULT_CATEGORIES = [
  'ผงเครื่องดื่ม / ชา / กาแฟ',
  'นมและครีม',
  'ไซรัปและน้ำเชื่อม',
  'ท็อปปิ้งและไข่มุก',
  'บรรจุภัณฑ์และแก้ว',
  'ผลไม้และเบเกอรี่',
  'อุปกรณ์และอื่นๆ',
];

export default function IngredientsPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const { mutate: globalMutate } = useSWRConfig();
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [unitMode, setUnitMode] = useState<'SELECT' | 'CUSTOM'>('SELECT');
  const [categoryMode, setCategoryMode] = useState<'SELECT' | 'CUSTOM'>('SELECT');

  // Instant SWR Cache: Shows cached ingredients immediately & auto-refreshes in real-time
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/ingredients', {
    refreshInterval: 5000,   // ดึงข้อมูลอัปเดตอัตโนมัติทุก 5 วินาทีแบบ Real-time
    revalidateOnFocus: true, // ดึงข้อมูลใหม่ทันทีเมื่อสลับหน้าต่างกลับมา
    dedupingInterval: 2000,
  });

  useEffect(() => {
    if (swrData?.success && Array.isArray(swrData.ingredients)) {
      setIngredients(swrData.ingredients);
    }
  }, [swrData]);

  const initialLoading = isLoading && ingredients.length === 0;
  const refreshing = isValidating;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState('ALL');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  // Auto-select first store when loaded
  useEffect(() => {
    if (staffStores.length > 0 && (!selectedStoreId || selectedStoreId === 'CENTRAL' || !staffStores.some((s) => String(s.id) === selectedStoreId))) {
      setSelectedStoreId(String(staffStores[0].id));
    }
  }, [staffStores, selectedStoreId]);

  const storeBalances: Record<number, StoreIngredientBalance[]> = useMemo(() => {
    return swrData?.success && swrData.storeBalances ? swrData.storeBalances : {};
  }, [swrData]);

  const isCentral = false;

  const selectedStoreBalancesMap = useMemo(() => {
    const storeIdNum = Number(selectedStoreId || staffStores[0]?.id || 0);
    const list = storeBalances[storeIdNum] || [];
    const map = new Map<number, StoreIngredientBalance>();
    list.forEach((item) => map.set(item.ingredientId, item));
    return map;
  }, [selectedStoreId, storeBalances, staffStores]);

  const currentSelectedStore = useMemo(() => {
    const storeIdNum = Number(selectedStoreId || staffStores[0]?.id || 0);
    return staffStores.find((s) => s.id === storeIdNum) || null;
  }, [selectedStoreId, staffStores]);

  // Low Stock Counts for Central Warehouse & Stores (for visual indicator tabs)
  const centralLowCountTab = useMemo(() => {
    return ingredients.filter((ing) => Number(ing.currentStock) <= Number(ing.minStock)).length;
  }, [ingredients]);

  const storeLowCountMap = useMemo(() => {
    const minMap = new Map<number, number>();
    ingredients.forEach((i) => minMap.set(i.id, Number(i.minStock)));
    const counts: Record<number, number> = {};
    staffStores.forEach((st) => {
      const list = storeBalances[st.id] || [];
      const lowItems = list.filter((item) => {
        if (!item.hasStockHistory) return false;
        const min = minMap.get(item.ingredientId) ?? 0;
        return Number(item.expectedStock) <= min;
      });
      counts[st.id] = lowItems.length;
    });
    return counts;
  }, [ingredients, staffStores, storeBalances]);

  // Highlight updated or newly added row
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Detail / Recipes modal
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'ผงเครื่องดื่ม',
    unit: 'กรัม',
    currentStock: '0',
    minStock: '10',
    costPerUnit: '0',
    status: 'ACTIVE',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadIngredients = async (_isBackground = false) => {
    await mutate();
  };

  // Distinct Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((ing) => {
      if (ing.category) set.add(ing.category);
    });
    return Array.from(set);
  }, [ingredients]);

  // Combined Categories for Form Selector (Presets + Existing in DB)
  const allAvailableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    ingredients.forEach((ing) => {
      if (ing.category && ing.category.trim()) {
        set.add(ing.category.trim());
      }
    });
    return Array.from(set);
  }, [ingredients]);

  // Combined Units for Form Selector (Presets + Existing in DB)
  const allAvailableUnits = useMemo(() => {
    const set = new Set<string>(PRESET_UNITS);
    ingredients.forEach((ing) => {
      if (ing.unit && ing.unit.trim()) {
        set.add(ing.unit.trim());
      }
    });
    return Array.from(set);
  }, [ingredients]);

  // Fast Client-side Filtering
  const filteredIngredients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients.filter((ing) => {
      const matchSearch =
        !q ||
        ing.code.toLowerCase().includes(q) ||
        ing.name.toLowerCase().includes(q) ||
        (ing.category && ing.category.toLowerCase().includes(q));

      const matchCategory = selectedCategory === 'ALL' || ing.category === selectedCategory;

      let stock = Number(ing.currentStock);
      let isStockedInStore = true;
      if (!isCentral) {
        const b = selectedStoreBalancesMap.get(ing.id);
        stock = b ? Number(b.expectedStock) : 0;
        isStockedInStore = Boolean(b?.hasStockHistory);
      }
      const min = Number(ing.minStock);

      let matchStock = true;
      if (!isCentral && !isStockedInStore) {
        if (selectedStockStatus === 'SAFE' || selectedStockStatus === 'LOW' || selectedStockStatus === 'OUT') {
          matchStock = false;
        }
      } else {
        if (selectedStockStatus === 'SAFE') {
          matchStock = stock > min;
        } else if (selectedStockStatus === 'LOW') {
          matchStock = stock > 0 && stock <= min;
        } else if (selectedStockStatus === 'OUT') {
          matchStock = stock <= 0;
        }
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [ingredients, search, selectedCategory, selectedStockStatus, isCentral, selectedStoreBalancesMap]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedStockStatus, selectedStoreId]);

  // Paginated items (10 items per page)
  const paginatedIngredients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIngredients.slice(start, start + pageSize);
  }, [filteredIngredients, currentPage, pageSize]);

  const openAddModal = () => {
    setEditingIngredient(null);
    setUnitMode('SELECT');
    setCategoryMode('SELECT');
    setFormData({
      code: `ING-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: allAvailableCategories[0] || 'ผงเครื่องดื่ม / ชา / กาแฟ',
      unit: 'กรัม',
      currentStock: '0',
      minStock: '10',
      costPerUnit: '0',
      status: 'ACTIVE',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (ing: IngredientItem) => {
    setEditingIngredient(ing);
    const hasPresetUnit = allAvailableUnits.includes(ing.unit);
    const hasPresetCategory = allAvailableCategories.includes(ing.category);
    setUnitMode(hasPresetUnit ? 'SELECT' : 'CUSTOM');
    setCategoryMode(hasPresetCategory ? 'SELECT' : 'CUSTOM');
    setFormData({
      code: ing.code,
      name: ing.name,
      category: ing.category || allAvailableCategories[0] || 'ผงเครื่องดื่ม / ชา / กาแฟ',
      unit: ing.unit || 'กรัม',
      currentStock: ing.currentStock.toString(),
      minStock: ing.minStock.toString(),
      costPerUnit: ing.costPerUnit ? ing.costPerUnit.toString() : '0',
      status: ing.status,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const viewIngredientDetails = async (id: number) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/ingredients/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSelectedDetail(json.ingredient);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  // Instant Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const isEditing = Boolean(editingIngredient);
      const url = isEditing ? `/api/ingredients/${editingIngredient!.id}` : '/api/ingredients';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      const returned: IngredientItem = json.ingredient;

      if (isEditing) {
        setIngredients((prev) =>
          prev.map((item) => (item.id === returned.id ? returned : item))
        );
        showToast(`อัปเดตวัตถุดิบ "${returned.name}" เรียบร้อยแล้ว`);
      } else {
        setIngredients((prev) => [returned, ...prev]);
        showToast(`เพิ่มวัตถุดิบใหม่ "${returned.name}" เข้าสู่ตารางเรียบร้อย`);
      }

      setModalOpen(false);
      setHighlightId(returned.id);
      setTimeout(() => setHighlightId(null), 2500);
      mutate();
      globalMutate('/api/notifications');
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Inactive
  const handleDelete = async (id: number, name: string) => {
    const isConfirmed = await confirmDeleteAlert({
      itemName: name,
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showErrorAlert('ไม่สามารถลบวัตถุดิบได้', json.message);
        return;
      }

      if (json.message.includes('ระงับการใช้งาน')) {
        setIngredients((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: 'INACTIVE' } : i))
        );
        await showSuccessAlert('ลบข้อมูลสำเร็จ', `ระงับการใช้งานวัตถุดิบ "${name}" เรียบร้อยแล้ว`);
      } else {
        setIngredients((prev) => prev.filter((i) => i.id !== id));
        await showSuccessAlert('ลบข้อมูลสำเร็จ', `ลบวัตถุดิบ "${name}" ออกจากระบบเรียบร้อยแล้ว`);
      }
      mutate();
      globalMutate('/api/notifications');
    } catch (error: any) {
      await showErrorAlert('เกิดข้อผิดพลาดในการลบ', error.message);
    }
  };

  // Metrics
  const totalCount = ingredients.length;
  let safeCount = 0;
  let lowCount = 0;
  let outCount = 0;
  let totalValue = 0;

  ingredients.forEach((ing) => {
    let s = Number(ing.currentStock);
    let isStockedInStore = true;
    if (!isCentral) {
      const b = selectedStoreBalancesMap.get(ing.id);
      s = b ? Number(b.expectedStock) : 0;
      isStockedInStore = Boolean(b?.hasStockHistory);
    }
    const m = Number(ing.minStock);
    const cost = Number(ing.costPerUnit || 0);
    totalValue += s * cost;

    if (!isCentral && !isStockedInStore) {
      // Store has never requested or stocked this item - don't count as low or out
      return;
    }

    if (s <= 0) outCount++;
    else if (s <= m) lowCount++;
    else safeCount++;
  });

  return (
    <div className="space-y-6">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            ติดตามสต็อกคงเหลือ สต็อกขั้นต่ำ (Min Stock) ต้นทุน และมูลค่ารวมในคลัง
          </p>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={() => loadIngredients(true)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            {isAdmin && (
              <>
                <Link
                  href="/admin/stock-in"
                  className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs transition-all"
                >
                  <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                  <span>รับเข้าสต็อก</span>
                </Link>

                <button
                  onClick={openAddModal}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มวัตถุดิบใหม่</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Store Selection Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto border border-slate-200">
          <div className="px-3 py-1.5 text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
            <Store className="w-4 h-4 text-emerald-700" />
            <span>เลือกร้านค้า:</span>
          </div>

          {staffStores.map((st) => {
            const isSelected = selectedStoreId === String(st.id);
            const storeLow = storeLowCountMap[st.id] || 0;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStoreId(String(st.id))}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>🏪 สต็อกร้าน: {st.name}</span>
                {storeLow > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isSelected
                        ? 'bg-rose-500 text-white ring-1 ring-white/30'
                        : 'bg-rose-600 text-white'
                    }`}
                    title={`สต็อกร้านนี้ต่ำกว่าเกณฑ์ขั้นต่ำ (Min) ${storeLow} รายการ (ต้องซื้อเพิ่ม)`}
                  >
                    {storeLow}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Store Context Banner (when a store is selected) */}
        {currentSelectedStore && (
          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-emerald-950 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                กำลังดูสต็อกหน้าร้าน: <strong>{currentSelectedStore.name}</strong> (@{currentSelectedStore.username}) —
                คำนวณจากสูตร: <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-900">ยอดยกมา + รับเข้า (ซื้อมา) - ตัดขาย POS</code>
              </span>
            </div>
            <Link
              href={`/admin/stock-in?storeId=${currentSelectedStore.id}`}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>+ บันทึกรับเข้า (ซื้อมาให้ร้านนี้)</span>
            </Link>
          </div>
        )}

        {/* Staff Read-only Banner */}
        {!isAdmin && currentUser && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              <span>โหมดพนักงานขาย (Staff): คุณมีสิทธิ์ตรวจสอบสต็อกคงเหลือเท่านั้น ไม่สามารถเพิ่ม แก้ไข หรือลบวัตถุดิบได้</span>
            </div>
            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
              Read-Only
            </span>
          </div>
        )}

        {/* 5 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div
            onClick={() => setSelectedStockStatus('ALL')}
            className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs cursor-pointer hover:border-slate-300 transition-all"
          >
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">วัตถุดิบทั้งหมด</div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {totalCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div
            onClick={() => setSelectedStockStatus('SAFE')}
            className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs cursor-pointer hover:border-emerald-300 transition-all"
          >
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">สต็อกเพียงพอ</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {safeCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div
            onClick={() => setSelectedStockStatus('LOW')}
            className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs cursor-pointer hover:border-amber-300 transition-all"
          >
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">ใกล้หมด (ต่ำกว่าขั้นต่ำ)</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {lowCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div
            onClick={() => setSelectedStockStatus('OUT')}
            className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs cursor-pointer hover:border-red-300 transition-all"
          >
            <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">หมดสต็อก (0)</div>
            <div className="text-2xl font-black text-red-600 mt-1">
              {outCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              มูลค่าสต็อกร้าน: {currentSelectedStore?.name || ''}
            </div>
            <div className="text-2xl font-black text-blue-700 mt-1">
              ฿{totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหารหัส หรือชื่อวัตถุดิบ เช่น ผงไมโล, แก้ว..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Store Dropdown Filter */}
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-emerald-50/70 text-emerald-950 font-bold focus:outline-none cursor-pointer flex-1 md:flex-initial"
            >
              {staffStores.map((st) => (
                <option key={st.id} value={st.id}>
                  🏪 ร้าน: {st.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
            >
              <option value="ALL">ทุกหมวดหมู่ ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
            >
              <option value="ALL">ทุกสถานะสต็อก</option>
              <option value="SAFE">🟢 สต็อกเพียงพอ</option>
              <option value="LOW">🟠 ใกล้หมด (เหลือน้อยกว่าขั้นต่ำ)</option>
              <option value="OUT">🔴 หมดสต็อก (0)</option>
            </select>
          </div>
        </div>

        {/* Ingredients Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {initialLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">กำลังโหลดรายการคลังวัตถุดิบ...</span>
            </div>
          ) : filteredIngredients.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Layers className="w-10 h-10 text-slate-300" />
              <span>ไม่พบข้อมูลวัตถุดิบตรงกับเงื่อนไขการค้นหา</span>
              <button
                onClick={openAddModal}
                className="mt-2 text-emerald-600 font-bold underline cursor-pointer"
              >
                + เพิ่มวัตถุดิบใหม่ตัวแรก
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  {isCentral ? (
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                      <th className="py-3 px-3.5">รหัสวัตถุดิบ</th>
                      <th className="py-3 px-3.5">ชื่อวัตถุดิบ</th>
                      <th className="py-3 px-3.5">หมวดหมู่</th>
                      <th className="py-3 px-3.5 text-right">คงเหลือคลังกลาง</th>
                      <th className="py-3 px-3.5 text-right">สต็อกขั้นต่ำ (Min)</th>
                      <th className="py-3 px-3.5 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-3 px-3.5 text-right">มูลค่ารวม</th>
                      <th className="py-3 px-3.5 text-center">สถานะสต็อก</th>
                      <th className="py-3 px-3.5 text-center">ใช้ในเมนู</th>
                      <th className="py-3 px-3.5 text-center">จัดการ</th>
                    </tr>
                  ) : (
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                      <th className="py-3 px-3.5">รหัส/ชื่อวัตถุดิบ</th>
                      <th className="py-3 px-3.5">หมวดหมู่</th>
                      <th className="py-3 px-3 text-right">ยอดยกมา</th>
                      <th className="py-3 px-3 text-right">รับเข้า (+)</th>
                      <th className="py-3 px-3 text-right">ขาย POS (-)</th>
                      <th className="py-3 px-3.5 text-right text-slate-800">คงเหลือในร้าน</th>
                      <th className="py-3 px-3.5 text-right">ขั้นต่ำ (Min)</th>
                      <th className="py-3 px-3.5 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-3 px-3.5 text-right">มูลค่าในร้าน</th>
                      <th className="py-3 px-3.5 text-center">สถานะ</th>
                      <th className="py-3 px-3.5 text-center">จัดการ</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedIngredients.map((ing, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const isHighlighted = highlightId === ing.id;
                    const b = selectedStoreBalancesMap.get(ing.id);
                    const stock = isCentral ? Number(ing.currentStock) : (b ? Number(b.expectedStock) : 0);
                    const min = Number(ing.minStock);
                    const cost = Number(ing.costPerUnit || 0);
                    const totalIngValue = stock * cost;

                    const isOutOfStock = stock <= 0;
                    const isLowStock = !isOutOfStock && stock <= min;

                    return (
                      <tr
                        key={ing.id}
                        className={`transition-colors duration-500 ${
                          isHighlighted
                            ? 'bg-emerald-50 ring-2 ring-emerald-500/50'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {isCentral ? (
                          <>
                            {/* Sequence Row Number */}
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                              {rowNumber}
                            </td>

                            {/* Code */}
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-700 text-xs">
                              {ing.code}
                            </td>

                            {/* Name */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-slate-900 text-xs">{ing.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">หน่วย: {ing.unit}</div>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-3.5">
                              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                {ing.category}
                              </span>
                            </td>

                            {/* Current Stock */}
                            <td className="py-3 px-3.5 text-right font-bold text-xs">
                              <span
                                className={
                                  isOutOfStock
                                    ? 'text-red-600'
                                    : isLowStock
                                    ? 'text-amber-600'
                                    : 'text-slate-900'
                                }
                              >
                                {stock.toLocaleString()}
                              </span>{' '}
                              <span className="text-[11px] font-normal text-slate-500 ml-0.5">{ing.unit}</span>
                            </td>

                            {/* Min Stock */}
                            <td className="py-3 px-3.5 text-right font-mono text-slate-600 text-xs">
                              {min.toLocaleString()} {ing.unit}
                            </td>

                            {/* Cost Per Unit */}
                            <td className="py-3 px-3.5 text-right font-mono text-slate-700 text-xs font-medium">
                              ฿{cost.toFixed(2)}/{ing.unit}
                            </td>

                            {/* Total Value */}
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 text-xs">
                              ฿{totalIngValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Stock Status Pill */}
                            <td className="py-3 px-3.5 text-center">
                              {isOutOfStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-red-100 text-red-800 border border-red-200 shadow-2xs">
                                  <XCircle className="w-3 h-3 text-red-600" />
                                  หมดสต็อก
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  ใกล้หมด
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-100/70 text-emerald-800 border border-emerald-200 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  สต็อกเพียงพอ
                                </span>
                              )}
                            </td>

                            {/* Used in Recipes */}
                            <td className="py-3 px-3.5 text-center">
                              <button
                                onClick={() => viewIngredientDetails(ing.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-all cursor-pointer shadow-2xs"
                                title="ดูเมนูที่ใช้วัตถุดิบนี้"
                              >
                                <ChefHat className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{ing._count?.recipeItems || 0} เมนู</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3.5 text-center">
                              {isAdmin ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Stock-in quick link */}
                                  <Link
                                    href={`/admin/stock-in?code=${ing.code}`}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition-colors flex items-center gap-1 shadow-2xs"
                                    title="รับเข้าสต็อก"
                                  >
                                    <ArrowDownToLine className="w-3 h-3" />
                                    <span>รับเข้า</span>
                                  </Link>

                                  <button
                                    onClick={() => openEditModal(ing)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    title="แก้ไขวัตถุดิบ"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(ing.id, ing.name)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="ลบหรือระงับวัตถุดิบ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                                  ดูเท่านั้น
                                </span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Sequence Row Number */}
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                              {rowNumber}
                            </td>

                            {/* Store Mode: Name & Code */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-slate-900 text-xs">{ing.name}</div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">{ing.code}</div>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-3.5">
                              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                {ing.category}
                              </span>
                            </td>

                            {/* Opening */}
                            <td className="py-3 px-3 text-right font-mono text-slate-600 text-xs">
                              {(b ? Number(b.openingQuantity) : 0).toLocaleString()} <span className="text-[11px] text-slate-400">{ing.unit}</span>
                            </td>

                            {/* Inbound */}
                            <td className="py-3 px-3 text-right font-mono text-xs text-emerald-700 font-bold">
                              {(b && Number(b.inboundQuantity) > 0) ? `+${Number(b.inboundQuantity).toLocaleString()}` : '0'} <span className="text-[11px] text-slate-400">{ing.unit}</span>
                            </td>

                            {/* Sales */}
                            <td className="py-3 px-3 text-right font-mono text-xs text-red-700 font-bold">
                              {(b && Number(b.salesQuantity) > 0) ? `-${Number(b.salesQuantity).toLocaleString()}` : '0'} <span className="text-[11px] text-slate-400">{ing.unit}</span>
                            </td>

                            {/* Expected In-Store Stock */}
                            <td className="py-3 px-3.5 text-right bg-slate-50/60 font-bold text-xs font-mono">
                              <span
                                className={
                                  !b?.hasStockHistory
                                    ? 'text-slate-400 font-normal'
                                    : isOutOfStock
                                    ? 'text-red-600'
                                    : isLowStock
                                    ? 'text-amber-600'
                                    : 'text-slate-900'
                                }
                              >
                                {stock.toLocaleString()}
                              </span>{' '}
                              <span className="text-[11px] font-normal text-slate-500 ml-0.5">{ing.unit}</span>
                            </td>

                            {/* Min Stock */}
                            <td className="py-3 px-3.5 text-right font-mono text-slate-600 text-xs">
                              {min.toLocaleString()} {ing.unit}
                            </td>

                            {/* Cost */}
                            <td className="py-3 px-3.5 text-right font-mono text-slate-700 text-xs font-medium">
                              ฿{cost.toFixed(2)}
                            </td>

                            {/* Total Value */}
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 text-xs">
                              ฿{totalIngValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3.5 text-center">
                              {!b?.hasStockHistory ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs">
                                  ยังไม่เคยเบิก
                                </span>
                              ) : isOutOfStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-red-100 text-red-800 border border-red-200 shadow-2xs">
                                  <XCircle className="w-3 h-3 text-red-600" />
                                  ของหมด
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  ใกล้หมด
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-100/70 text-emerald-800 border border-emerald-200 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  พร้อมขาย
                                </span>
                              )}
                            </td>

                            {/* Actions in Store Mode: Quick stock-in button */}
                            <td className="py-3 px-3.5 text-center">
                              <Link
                                href={`/admin/stock-in?storeId=${selectedStoreId}&code=${ing.code}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                                title="บันทึกรับเข้า (ซื้อมาให้ร้านนี้)"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-700" />
                                <span>+ รับเข้า</span>
                              </Link>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination (10 items per page) */}
              <Pagination
                currentPage={currentPage}
                totalItems={filteredIngredients.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

      {/* Add / Edit Ingredient Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingIngredient ? 'แก้ไขข้อมูลวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}
                  </h3>
                  <p className="text-xs text-slate-400">กรอกข้อมูลวัตถุดิบและกำหนดสต็อกขั้นต่ำ</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสวัตถุดิบ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="เช่น ING-MILO001"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Unit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      หน่วยนับ <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setUnitMode(unitMode === 'SELECT' ? 'CUSTOM' : 'SELECT')}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      {unitMode === 'SELECT' ? '✍️ พิมพ์เอง' : '📋 เลือกจากรายการ'}
                    </button>
                  </div>

                  {unitMode === 'SELECT' ? (
                    <select
                      value={allAvailableUnits.includes(formData.unit) ? formData.unit : '__CUSTOM__'}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setUnitMode('CUSTOM');
                        } else {
                          setFormData({ ...formData, unit: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                    >
                      {allAvailableUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value="__CUSTOM__">✍️ พิมพ์หน่วยนับเอง...</option>
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="เช่น กรัม, มล., ใบ, ชิ้น, หลอด"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 pr-16"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUnitMode('SELECT');
                          if (!allAvailableUnits.includes(formData.unit)) {
                            setFormData({ ...formData, unit: allAvailableUnits[0] || 'กรัม' });
                          }
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                      >
                        เลือก
                      </button>
                    </div>
                  )}

                  {/* Quick unit chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['กรัม', 'มล.', 'กิโลกรัม', 'ลิตร', 'ใบ', 'ชิ้น', 'ขวด'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setFormData({ ...formData, unit: chip })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-all ${
                          formData.unit === chip
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อวัตถุดิบ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น ผงไมโลพรีเมียม, แก้ว 22oz"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      หมวดหมู่วัตถุดิบ
                    </label>
                    <button
                      type="button"
                      onClick={() => setCategoryMode(categoryMode === 'SELECT' ? 'CUSTOM' : 'SELECT')}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      {categoryMode === 'SELECT' ? '✍️ พิมพ์เอง' : '📋 เลือกจากรายการ'}
                    </button>
                  </div>

                  {categoryMode === 'SELECT' ? (
                    <select
                      value={allAvailableCategories.includes(formData.category) ? formData.category : '__CUSTOM__'}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setCategoryMode('CUSTOM');
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                    >
                      {allAvailableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__CUSTOM__">✍️ พิมพ์หมวดหมู่เอง...</option>
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="เช่น ผงเครื่องดื่ม, บรรจุภัณฑ์"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 pr-16"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryMode('SELECT');
                          if (!allAvailableCategories.includes(formData.category)) {
                            setFormData({
                              ...formData,
                              category: allAvailableCategories[0] || 'ผงเครื่องดื่ม / ชา / กาแฟ',
                            });
                          }
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                      >
                        เลือก
                      </button>
                    </div>
                  )}

                  {/* Quick category chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['ผงเครื่องดื่ม', 'นมและครีม', 'ไซรัป', 'ท็อปปิ้ง', 'บรรจุภัณฑ์'].map((chip) => {
                      const matched = formData.category.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            const fullCat = allAvailableCategories.find((c) => c.includes(chip)) || chip;
                            setFormData({ ...formData, category: fullCat });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-all ${
                            matched
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการใช้งาน
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                  >
                    <option value="ACTIVE">พร้อมใช้งาน (Active)</option>
                    <option value="INACTIVE">ระงับการใช้งาน (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Current Stock */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนคงเหลือ
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Min Stock (Safety Threshold) */}
                <div>
                  <label className="block text-xs font-bold text-amber-700 mb-1">
                    สต็อกขั้นต่ำ (Min) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    placeholder="เช่น 500"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-amber-50/30 font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <p className="mt-1 text-[10px] text-amber-700">
                    💡 ถ้ายอดคงเหลือลดลงมาแตะตัวเลขนี้ ระบบจะเตือนสีส้มว่าต้องสั่งของเพิ่ม
                  </p>
                </div>

                {/* Cost Per Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ต้นทุน/หน่วย (฿)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                    placeholder="0.25"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกวัตถุดิบ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ingredient Usage Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    เมนูสินค้าที่ใช้วัตถุดิบนี้
                  </h3>
                  <p className="text-xs text-slate-500">
                    วัตถุดิบ: <strong className="text-emerald-700">{selectedDetail.name}</strong> ({selectedDetail.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {selectedDetail.recipeItems?.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  ยังไม่มีสินค้าใดใช้วัตถุดิบนี้ในเมนู
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {selectedDetail.recipeItems?.map((ri: any) => (
                    <div key={ri.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/50">
                      <div>
                        <div className="font-bold text-slate-800">{ri.recipe?.product?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{ri.recipe?.product?.code}</div>
                      </div>
                      <div className="font-black text-slate-700">
                        {ri.quantity} <span className="font-normal text-slate-500">{ri.unit}</span> / แก้ว
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-end">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

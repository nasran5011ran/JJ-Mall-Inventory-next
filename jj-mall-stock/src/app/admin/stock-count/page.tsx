'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
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
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/stock-count');

  const stockCounts: StockCountRecord[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.stockCounts) ? swrData.stockCounts : [];
  }, [swrData]);

  const ingredients: Ingredient[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
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
  const [targetLocation, setTargetLocation] = useState<'WAREHOUSE' | 'STORE'>('WAREHOUSE');
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  const [countNote, setCountNote] = useState('');
  const [syncStock, setSyncStock] = useState(true);
  const [countInputs, setCountInputs] = useState<Record<number, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

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

  // Open New Stock Count Modal
  const openNewStockCount = () => {
    const initialInputs: Record<number, string> = {};
    ingredients.forEach((ing) => {
      initialInputs[ing.id] = String(Number(ing.currentStock));
    });
    setCountInputs(initialInputs);
    setTargetLocation('WAREHOUSE');
    setTargetStoreId(staffStores[0]?.id ? String(staffStores[0].id) : '');
    setCountNote('ตรวจนับสินค้าจริงประจำรอบ');
    setSyncStock(true);
    setSelectedCategory('ALL');
    setFormError(null);
    setModalOpen(true);
  };

  // Quick fill all inputs with current system stock
  const handleFillAllCurrent = () => {
    const updated: Record<number, string> = {};
    ingredients.forEach((ing) => {
      updated[ing.id] = String(Number(ing.currentStock));
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
      return true;
    });
  }, [ingredients, selectedCategory]);

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
          const system = Number(ing.currentStock);
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
  }, [ingredients, countInputs]);

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            ระบบตรวจนับสินค้าจริงในคลังและประจำแต่ละจุดขายหน้าร้าน (Physical Stock Count & Store Audit)
          </p>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
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

      {/* Search & Location Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ตรวจนับ, สาขา/ร้านค้า, ผู้ตรวจ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
          />
        </div>

        {/* Location Dropdown Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-600 shrink-0">จุดตรวจนับ:</label>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-bold focus:outline-none cursor-pointer w-full md:w-auto"
          >
            <option value="ALL">📦 ทุกจุดตรวจนับ (All Locations)</option>
            <option value="WAREHOUSE">🏢 คลังสินค้าส่วนกลาง JJ Mall</option>
            {staffStores.map((st) => (
              <option key={st.id} value={st.id}>
                🏪 {st.name} (@{st.username})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดประวัติการตรวจนับสต็อก...</span>
          </div>
        ) : filteredCounts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <ClipboardCheck className="w-12 h-12 text-slate-300" />
            <div className="font-bold text-slate-600 text-sm">ไม่พบรายการตรวจนับสต็อกจริงที่ตรงกับเงื่อนไข</div>
            <p className="max-w-md text-slate-400">
              กดปุ่ม <span className="text-emerald-700 font-bold">&quot;+ ทำรายการตรวจนับสต็อกจริงใหม่&quot;</span> ด้านบน เพื่อเริ่มนับสต็อกของแต่ละร้านค้าหรือคลังกลาง
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3 whitespace-nowrap">เลขที่ใบนับสต็อก</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">วันที่ & เวลาตรวจนับ</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">จุดตรวจนับ / ร้านค้า</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">ผู้ตรวจนับ</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">จำนวนวัตถุดิบ</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">สรุปผลต่าง (Variance)</th>
                  <th className="py-2.5 px-3">หมายเหตุ</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCounts.map((sc) => {
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            <Store className="w-3.5 h-3.5 text-amber-700" />
                            <span>จุดขาย: {sc.storeName?.split(' ')[0] || 'ร้านค้า'}</span>
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
          </div>
        )}
      </div>

      {/* Modal 1: Create New Physical Stock Count */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-6xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    บันทึกผลการตรวจนับสต็อกจริง (Physical Stock Count)
                  </h3>
                  <p className="text-xs text-slate-500">
                    เลือกร้านค้า/คลังที่ทำการนับ และกรอกจำนวนที่นับได้จริงของแต่ละวัตถุดิบ
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
              <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Store / Location Radio Selector */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shrink-0 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                เลือกจุดตรวจนับสต็อก (Location / Store) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                    targetLocation === 'WAREHOUSE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetLocation"
                    checked={targetLocation === 'WAREHOUSE'}
                    onChange={() => setTargetLocation('WAREHOUSE')}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">คลังสินค้าส่วนกลาง JJ Mall</div>
                    <div className="text-[10px] text-slate-400">Warehouse Center</div>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                    targetLocation === 'STORE'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetLocation"
                    checked={targetLocation === 'STORE'}
                    onChange={() => setTargetLocation('STORE')}
                    className="sr-only"
                  />
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">จุดขายหน้าร้าน (Store / Kiosk)</div>
                    <div className="text-[10px] text-slate-400">ระบุเคาน์เตอร์ขายประจำร้าน</div>
                  </div>
                </label>
              </div>

              {/* If Store Selected, pick specific staff shop */}
              {targetLocation === 'STORE' && (
                <div className="pt-2 animate-in fade-in duration-150">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    เลือกร้านค้าที่ทำการตรวจนับสต็อก <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetStoreId}
                    onChange={(e) => setTargetStoreId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    {staffStores.map((st) => (
                      <option key={st.id} value={st.id}>
                        🏪 {st.name} (@{st.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Filter & Actions Bar */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
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

              {/* Quick Helper Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleFillAllCurrent}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                  title="ใส่ค่ายอดคงเหลือในระบบลงทุกช่อง"
                >
                  ใส่ค่ายอดปัจจุบันทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  ล้างค่าทั้งหมด
                </button>
              </div>
            </div>

            {/* Count Input Table (Scrollable) */}
            <div className="mt-3 flex-1 overflow-y-auto border border-slate-200 rounded-2xl scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-3 px-3.5">รหัส / ชื่อวัตถุดิบ</th>
                    <th className="py-3 px-3 text-right">สต็อกในระบบ</th>
                    <th className="py-3 px-3 text-center w-36">ยอดนับได้จริง *</th>
                    <th className="py-3 px-3 text-right">ผลต่าง (Variance)</th>
                    <th className="py-3 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredModalIngredients.map((ing) => {
                    const systemQty = Number(ing.currentStock);
                    const inputValue = countInputs[ing.id] ?? '';
                    const actualQty = parseFloat(inputValue);
                    const hasInput = inputValue.trim() !== '' && !isNaN(actualQty);
                    const diff = hasInput ? actualQty - systemQty : 0;

                    let statusBadge = (
                      <span className="text-slate-300 text-[11px]">-</span>
                    );
                    if (hasInput) {
                      if (diff === 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" /> สต็อกตรง
                          </span>
                        );
                      } else if (diff < 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <TrendingDown className="w-3 h-3" /> ขาด {Math.abs(diff)}
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <TrendingUp className="w-3 h-3" /> เกิน +{diff}
                          </span>
                        );
                      }
                    }

                    return (
                      <tr key={ing.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-slate-800">{ing.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {ing.code} {ing.category ? `• ${ing.category}` : ''}
                          </div>
                        </td>

                        {/* System Stock */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {systemQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{ing.unit}</span>
                        </td>

                        {/* Actual Input */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={inputValue}
                              onChange={(e) =>
                                setCountInputs((prev) => ({
                                  ...prev,
                                  [ing.id]: e.target.value,
                                }))
                              }
                              placeholder={String(systemQty)}
                              className="w-24 px-2.5 py-1 text-xs text-right font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white"
                            />
                            <span className="text-[10px] text-slate-400 w-8 text-left truncate">{ing.unit}</span>
                          </div>
                        </td>

                        {/* Diff */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {hasInput ? (
                            diff === 0 ? (
                              <span className="text-emerald-600">0</span>
                            ) : diff < 0 ? (
                              <span className="text-red-600">
                                {diff.toLocaleString()} {ing.unit}
                              </span>
                            ) : (
                              <span className="text-blue-600">
                                +{diff.toLocaleString()} {ing.unit}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">{statusBadge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary & Form Settings */}
            <form onSubmit={handleSubmitCount} className="mt-4 space-y-3 shrink-0">
              {/* Live Metric Ribbon */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    หมายเหตุการตรวจนับ
                  </label>
                  <input
                    type="text"
                    value={countNote}
                    onChange={(e) => setCountNote(e.target.value)}
                    placeholder="เช่น ตรวจนับสต็อกกะเช้า, ตรวจนับประจำเดือน..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="pt-2 sm:pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncStock}
                      onChange={(e) => setSyncStock(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      🔄 อัปเดตยอดคงเหลือในระบบให้ตรงกับยอดนับจริงทันที (Auto-sync)
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-400 ml-6">
                    หากติ๊กถูก ระบบจะปรับยอดสต็อกและบันทึกประวัติความเคลื่อนไหว (Physical Count) ให้อัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || modalSummary.totalItemsCounted === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
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
      {selectedCount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    ใบบันทึกผลตรวจนับสินค้าจริง #{selectedCount.countNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    วันที่ {new Date(selectedCount.countDate || selectedCount.createdAt).toLocaleString('th-TH')} น.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCount(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meta Info */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shrink-0">
              <div>
                <span className="text-slate-400">จุดตรวจนับ / ร้านค้า:</span>
                <div className="font-bold text-emerald-800">
                  {selectedCount.location === 'STORE' || selectedCount.storeId
                    ? `🏪 ${selectedCount.storeName || 'จุดขายหน้าร้าน'}`
                    : '🏢 คลังสินค้าส่วนกลาง JJ Mall'}
                </div>
              </div>
              <div>
                <span className="text-slate-400">ผู้ทำการตรวจนับ:</span>
                <div className="font-bold text-slate-800">
                  {selectedCount.createdBy?.name} (@{selectedCount.createdBy?.username})
                </div>
              </div>
              <div>
                <span className="text-slate-400">หมายเหตุ:</span>
                <div className="font-medium text-slate-700 truncate">{selectedCount.note || '-'}</div>
              </div>
            </div>

            {/* Itemized Detail Table */}
            <div className="mt-4 flex-1 overflow-y-auto border border-slate-200 rounded-2xl scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">รหัส / ชื่อวัตถุดิบ</th>
                    <th className="py-2.5 px-3 text-right">ยอดในระบบ</th>
                    <th className="py-2.5 px-3 text-right">ยอดนับจริง</th>
                    <th className="py-2.5 px-3 text-right">ผลต่าง</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedCount.items.map((item) => {
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
                            <span className="text-emerald-600">0</span>
                          ) : diff < 0 ? (
                            <span className="text-red-600">
                              {diff.toLocaleString()} {item.ingredient?.unit}
                            </span>
                          ) : (
                            <span className="text-blue-600">
                              +{diff.toLocaleString()} {item.ingredient?.unit}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.status === 'MATCH' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3" /> ตรงกัน
                            </span>
                          ) : item.status === 'SHORTAGE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <TrendingDown className="w-3 h-3" /> ขาดหาย
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <TrendingUp className="w-3 h-3" /> ยอดเกิน
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                <span>พิมพ์รายงานผลต่าง (ตามแบบฟอร์มทางการ)</span>
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto">
          {/* Top Control Toolbar (Hidden when printing) */}
          <div className="no-print w-full max-w-5xl bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex items-center justify-between mb-4 sticky top-2 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-700" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                  ตัวอย่างก่อนพิมพ์: รายงานผลต่างจากการตรวจนับสินค้า / ใบขออนุมัติปรับปรุงสต็อก
                </h4>
                <p className="text-[11px] text-slate-500">
                  ตัดคอลัมน์ที่ไม่มีตัวเลขออกตามที่กำหนด • จัดหน้ากระดาษ A4 แนวนอน (Landscape) อัตโนมัติ
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
            className="w-full max-w-5xl bg-white text-black p-4 sm:p-6 print:p-0 shadow-2xl rounded-xl border border-slate-300 font-sans text-[10.5px] leading-tight relative my-2 print:my-0 print:border-none print:shadow-none"
          >
            {/* Document Header */}
            <div className="relative pb-1 mb-2">
              {/* Top Right Reference Meta */}
              <div className="absolute top-0 right-0 text-right text-[10px] text-slate-600 font-mono leading-tight">
                <div>หน้า: &nbsp;&nbsp;&nbsp;&nbsp;1</div>
                <div>RTTR080ATHA.QRP</div>
              </div>

              {/* Company & Document Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  บริษัท เชสเตอร์ ฟู้ด จำกัด สาขา คอฟฟี่-เจเจ มอลล์(จตุจักร)
                </h2>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  รายงานผลต่างจากการตรวจนับสินค้า/ใบขออนุมัติปรับปรุงสต็อกสินค้า
                </h3>
              </div>

              {/* Sub-Header: Document Number, Date, Store */}
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium border-b border-slate-400 pb-1">
                <div>
                  <span className="font-bold">เลขที่เอกสาร </span>
                  <span className="font-mono font-bold ml-1">{printRecord.countNumber}</span>
                  {printRecord.storeName && (
                    <span className="ml-3 text-slate-700">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] leading-tight">
                <thead>
                  {/* Super Header Groups */}
                  <tr className="border-t border-b border-slate-800 text-slate-800 font-bold text-center">
                    <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 w-8 text-center">ลำดับ</th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300 w-24">รหัสสินค้า</th>
                    <th rowSpan={2} className="py-1 px-2 border-r border-slate-300 text-left">ชื่อสินค้า</th>
                    <th rowSpan={2} className="py-1 px-1 border-r border-slate-300 w-12 text-center">หน่วยนับ</th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300 w-14 text-right">ยกมา</th>
                    <th colSpan={1} className="py-0.5 px-1 border-r border-slate-300 bg-slate-50 text-center">
                      &lt;-- รายการรับ --&gt;
                    </th>
                    <th colSpan={2} className="py-0.5 px-1 border-r border-slate-300 bg-slate-50 text-center">
                      &lt;-- รายการจ่าย --&gt;
                    </th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300 text-right w-20">
                      คงเหลือจาก<br />การคำนวณ
                    </th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300 text-right w-20">
                      คงเหลือจาก<br />การตรวจนับ
                    </th>
                    <th rowSpan={2} className="py-1 px-1.5 border-r border-slate-300 text-right w-16">
                      ผลต่าง
                    </th>
                    <th rowSpan={2} className="py-1 px-1 text-right w-12">
                      DOH<br />(Day)
                    </th>
                  </tr>

                  {/* Sub Header Columns */}
                  <tr className="border-b border-slate-800 text-slate-800 font-bold text-center">
                    <th className="py-0.5 px-1 border-r border-slate-300 text-right w-16">ปรับปรุงเพิ่ม</th>
                    <th className="py-0.5 px-1 border-r border-slate-300 text-right w-14">ขาย</th>
                    <th className="py-0.5 px-1 border-r border-slate-300 text-right w-14">จ่ายทำลาย</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 font-mono text-[9.5px]">
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
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        {/* No. */}
                        <td className="py-0.5 px-1 text-center border-r border-slate-200 font-sans">
                          {idx + 1}
                        </td>

                        {/* Product Code */}
                        <td className="py-0.5 px-1.5 border-r border-slate-200 whitespace-nowrap text-slate-700">
                          {item.ingredient?.code}
                        </td>

                        {/* Product Name */}
                        <td className="py-0.5 px-2 border-r border-slate-200 font-sans font-medium text-slate-900 truncate max-w-[180px]">
                          {item.ingredient?.name}
                        </td>

                        {/* Unit */}
                        <td className="py-0.5 px-1 border-r border-slate-200 text-center font-sans text-slate-700">
                          {item.ingredient?.unit}
                        </td>

                        {/* ยกมา (Opening) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-slate-200 text-slate-700">
                          {openQty < 0 ? `(${Math.abs(openQty).toFixed(2)})` : openQty.toFixed(2)}
                        </td>

                        {/* ปรับปรุงเพิ่ม / รับเข้า */}
                        <td className="py-0.5 px-1 border-r border-slate-200 text-right text-slate-700">
                          {inQty > 0 ? inQty.toFixed(2) : '-'}
                        </td>

                        {/* ขาย (Sales) -> Formatted with parenthesis as deduction */}
                        <td className="py-0.5 px-1 border-r border-slate-200 text-right text-slate-700">
                          {saleQty > 0 ? `(${saleQty.toFixed(2)})` : '-'}
                        </td>

                        {/* จ่ายทำลาย (Waste) */}
                        <td className="py-0.5 px-1 border-r border-slate-200 text-right text-slate-700">
                          {wasteQty > 0 ? `(${wasteQty.toFixed(2)})` : '-'}
                        </td>

                        {/* คงเหลือจากการคำนวณ (System) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-slate-200 font-bold text-slate-800">
                          {sysQty.toFixed(2)}
                        </td>

                        {/* คงเหลือจากการตรวจนับ (Actual) */}
                        <td className="py-0.5 px-1.5 text-right border-r border-slate-200 font-bold text-slate-900">
                          {actQty.toFixed(2)}
                        </td>

                        {/* ผลต่าง (Variance) */}
                        <td className={`py-0.5 px-1.5 text-right border-r border-slate-200 font-bold ${
                          diff < 0 ? 'text-red-700' : diff > 0 ? 'text-blue-700' : 'text-slate-800'
                        }`}>
                          {diff === 0 ? '0.00' : diff < 0 ? `(${Math.abs(diff).toFixed(2)})` : `+${diff.toFixed(2)}`}
                        </td>

                        {/* DOH (Day) */}
                        <td className="py-0.5 px-1 text-right text-slate-800 font-bold">
                          {dohVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Note Section */}
            {printRecord.note && (
              <div className="mt-2 pt-1 border-t border-slate-300 text-[9.5px] text-slate-700">
                <span className="font-bold">หมายเหตุการตรวจนับ: </span>
                <span>{printRecord.note}</span>
              </div>
            )}

            {/* Bottom 3 Signature Blocks (Matching User Photo) */}
            <div className="print-signature-section mt-4 pt-2 grid grid-cols-3 gap-6 text-center text-[10px] font-sans">
              <div className="space-y-1">
                <div className="text-slate-500 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้ขออนุมัติ (ร้านค้า)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้อนุมัติ (ร้านค้า)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">
                  วันที่: ...... / ...... / ..........
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 font-mono text-[10px]">___________________________________</div>
                <div className="font-bold text-slate-800">ผู้อนุมัติ (บัญชี)</div>
                <div className="text-[9.5px] text-slate-500 font-mono">
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

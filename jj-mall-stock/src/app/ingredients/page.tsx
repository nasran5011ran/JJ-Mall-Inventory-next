'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/context/auth-context';
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
} from 'lucide-react';

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

export default function IngredientsPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState('ALL');

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

  const loadIngredients = async (isBackground = false) => {
    try {
      if (!isBackground) setInitialLoading(true);
      else setRefreshing(true);

      const res = await fetch('/api/ingredients');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setIngredients(json.ingredients);
        }
      }
    } catch (error) {
      console.error('Failed to load ingredients:', error);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  // Distinct Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((ing) => {
      if (ing.category) set.add(ing.category);
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

      const stock = Number(ing.currentStock);
      const min = Number(ing.minStock);

      let matchStock = true;
      if (selectedStockStatus === 'SAFE') {
        matchStock = stock > min;
      } else if (selectedStockStatus === 'LOW') {
        matchStock = stock > 0 && stock <= min;
      } else if (selectedStockStatus === 'OUT') {
        matchStock = stock <= 0;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [ingredients, search, selectedCategory, selectedStockStatus]);

  const openAddModal = () => {
    setEditingIngredient(null);
    setFormData({
      code: `ING-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'ผงเครื่องดื่ม',
      unit: 'กรัม',
      currentStock: '100',
      minStock: '20',
      costPerUnit: '0.10',
      status: 'ACTIVE',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (ing: IngredientItem) => {
    setEditingIngredient(ing);
    setFormData({
      code: ing.code,
      name: ing.name,
      category: ing.category || 'ทั่วไป',
      unit: ing.unit,
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
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Inactive
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`คุณต้องการลบหรือระงับการใช้งานวัตถุดิบ "${name}" ใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.message || 'ไม่สามารถลบวัตถุดิบได้');
        return;
      }

      if (json.message.includes('ระงับการใช้งาน')) {
        setIngredients((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: 'INACTIVE' } : i))
        );
        showToast(`เปลี่ยนสถานะ "${name}" เป็นระงับการใช้งานเรียบร้อย`);
      } else {
        setIngredients((prev) => prev.filter((i) => i.id !== id));
        showToast(`ลบวัตถุดิบ "${name}" ออกจากระบบเรียบร้อย`);
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    }
  };

  // Metrics
  const totalCount = ingredients.length;
  let safeCount = 0;
  let lowCount = 0;
  let outCount = 0;
  let totalValue = 0;

  ingredients.forEach((ing) => {
    const s = Number(ing.currentStock);
    const m = Number(ing.minStock);
    const cost = Number(ing.costPerUnit || 0);
    totalValue += s * cost;

    if (s <= 0) outCount++;
    else if (s <= m) lowCount++;
    else safeCount++;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-1.5">
              <Layers className="w-3.5 h-3.5" />
              ระบบคลังวัตถุดิบ (Raw Materials & Inventory)
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              จัดการคลังวัตถุดิบ
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ติดตามสต็อกคงเหลือ จุดสั่งซื้อใหม่ (Min Stock) ต้นทุนต่อหน่วย และมูลค่ารวมในคลัง
            </p>
          </div>

          <div className="flex items-center gap-2.5">
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
                  href="/stock-in"
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
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">วัตถุดิบทั้งหมด</div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {totalCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">สต็อกเพียงพอ</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {safeCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">ใกล้หมด (เตือนสั่งซื้อ)</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {lowCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">หมดสต็อก (0)</div>
            <div className="text-2xl font-black text-red-600 mt-1">
              {outCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">มูลค่าสต็อกในคลัง</div>
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
          <div className="flex items-center gap-2 w-full md:w-auto">
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
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">รหัสวัตถุดิบ</th>
                    <th className="py-3.5 px-4">ชื่อวัตถุดิบ</th>
                    <th className="py-3.5 px-4">หมวดหมู่</th>
                    <th className="py-3.5 px-4 text-right">คงเหลือในคลัง</th>
                    <th className="py-3.5 px-4 text-right">สต็อกขั้นต่ำ (Min)</th>
                    <th className="py-3.5 px-4 text-right">ต้นทุน/หน่วย</th>
                    <th className="py-3.5 px-4 text-right">มูลค่ารวม</th>
                    <th className="py-3.5 px-4 text-center">สถานะสต็อก</th>
                    <th className="py-3.5 px-4 text-center">สูตรที่ใช้</th>
                    <th className="py-3.5 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredIngredients.map((ing) => {
                    const isHighlighted = highlightId === ing.id;
                    const stock = Number(ing.currentStock);
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
                        {/* Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {ing.code}
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 text-sm">{ing.name}</div>
                          <div className="text-[11px] text-slate-400">หน่วย: {ing.unit}</div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                            {ing.category}
                          </span>
                        </td>

                        {/* Current Stock */}
                        <td className="py-3.5 px-4 text-right font-black text-sm">
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
                          <span className="text-xs font-normal text-slate-500">{ing.unit}</span>
                        </td>

                        {/* Min Stock */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                          {min.toLocaleString()} {ing.unit}
                        </td>

                        {/* Cost Per Unit */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                          ฿{cost.toFixed(2)}/{ing.unit}
                        </td>

                        {/* Total Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                          ฿{totalIngValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Stock Status Pill */}
                        <td className="py-3.5 px-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                              <XCircle className="w-3 h-3 text-red-600" />
                              หมดสต็อก
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              ใกล้หมด
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              สต็อกเพียงพอ
                            </span>
                          )}
                        </td>

                        {/* Used in Recipes */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => viewIngredientDetails(ing.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="ดูสูตรที่ใช้วัตถุดิบนี้"
                          >
                            <ChefHat className="w-3 h-3 text-slate-500" />
                            <span>{ing._count?.recipeItems || 0} สูตร</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          {isAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Stock-in quick link */}
                              <Link
                                href={`/stock-in?code=${ing.code}`}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition-colors flex items-center gap-1"
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
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(ing.id, ing.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                title="ลบหรือระงับวัตถุดิบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                              ดูเท่านั้น
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                  <p className="text-xs text-slate-400">กรอกข้อมูลวัตถุดิบและกำหนดจุดสั่งซื้อใหม่</p>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หน่วยนับ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="เช่น กรัม, มล., ใบ, ชิ้น, หลอด"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมวดหมู่วัตถุดิบ
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="เช่น ผงเครื่องดื่ม, บรรจุภัณฑ์"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
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

                {/* Min Stock (Reorder Point) */}
                <div>
                  <label className="block text-xs font-bold text-amber-700 mb-1">
                    จุดสั่งซื้อใหม่ (Min) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-amber-50/30 font-mono font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
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
                    สูตรสินค้าที่ใช้วัตถุดิบนี้
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
                  ยังไม่มีสินค้าใดใช้สูตรวัตถุดิบนี้
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
    </DashboardLayout>
  );
}

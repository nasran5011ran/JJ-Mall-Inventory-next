'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/context/auth-context';
import { confirmDeleteAlert, showSuccessAlert, showErrorAlert } from '@/lib/sweetalert';
import Pagination from '@/components/Pagination';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ArrowRight,
  Eye,
  Check,
  Sparkles,
  Store,
  Warehouse,
  Upload,
  Image as ImageIcon,
  Coffee,
} from 'lucide-react';

interface StaffStore {
  id: number;
  name: string;
  username: string;
}

interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number | null;
  minStock: number;
  image?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  storeId?: number | null;
  store?: {
    id: number;
    name: string;
    username: string;
  } | null;
  recipe: {
    id: number;
    description: string;
    items: Array<{
      id: number;
      quantity: number;
      unit: string;
      ingredient: {
        id: number;
        code: string;
        name: string;
        unit: string;
        costPerUnit: number;
      };
    }>;
  } | null;
}

export default function ProductsPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([]);

  // Instant SWR Cache: Shows cached products immediately & auto-refreshes in real-time
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/products', {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  useEffect(() => {
    if (swrData?.success && Array.isArray(swrData.products)) {
      setProducts(swrData.products);
    }
  }, [swrData]);

  const staffStores: StaffStore[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  const initialLoading = isLoading && products.length === 0;
  const refreshing = isValidating;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedStore, setSelectedStore] = useState('ALL');

  // Highlight updated or newly added row ID
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // View Recipe Modal
  const [recipeModalProduct, setRecipeModalProduct] = useState<ProductItem | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'เครื่องดื่มเย็น',
    unit: 'แก้ว',
    price: '',
    cost: '',
    minStock: '10',
    image: '',
    status: 'ACTIVE',
    storeId: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch products initially
  const loadProducts = async (_isBackground = false) => {
    await mutate();
  };

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP, GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ภาพต้องไม่เกิน 5 MB');
      return;
    }

    try {
      setUploadingImage(true);
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }

      setFormData((prev) => ({ ...prev, image: data.url }));
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Compute distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Fast client-side filtering (0ms latency, zero flickering)
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.store?.name && p.store.name.toLowerCase().includes(q));

      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
      const matchStore =
        selectedStore === 'ALL' ||
        (selectedStore === 'CENTRAL' && !p.storeId) ||
        String(p.storeId) === String(selectedStore);

      return matchSearch && matchCategory && matchStatus && matchStore;
    });
  }, [products, search, selectedCategory, selectedStatus, selectedStore]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedStatus, selectedStore]);

  // Paginated products (10 items per page)
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      code: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'เครื่องดื่มเย็น',
      unit: 'แก้ว',
      price: '',
      cost: '',
      minStock: '10',
      image: '',
      status: 'ACTIVE',
      storeId: selectedStore !== 'ALL' && selectedStore !== 'CENTRAL' ? selectedStore : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setFormData({
      code: p.code,
      name: p.name,
      category: p.category || 'เครื่องดื่มเย็น',
      unit: p.unit || 'แก้ว',
      price: p.price.toString(),
      cost: p.cost ? p.cost.toString() : '',
      minStock: p.minStock.toString(),
      image: p.image || '',
      status: p.status,
      storeId: p.storeId ? String(p.storeId) : '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Instant Submission & Direct Table Insertion
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const isEditing = Boolean(editingProduct);
      const url = isEditing ? `/api/products/${editingProduct!.id}` : '/api/products';
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

      const returnedProduct: ProductItem = json.product;

      // Update state instantly without refetching the whole table!
      if (isEditing) {
        setProducts((prev) =>
          prev.map((item) => (item.id === returnedProduct.id ? returnedProduct : item))
        );
        showToast(`อัปเดตสินค้า "${returnedProduct.name}" เรียบร้อยแล้ว`);
      } else {
        setProducts((prev) => [returnedProduct, ...prev]);
        showToast(`เพิ่มสินค้าใหม่ "${returnedProduct.name}" เข้าสู่ตารางเรียบร้อย`);
      }

      // Close modal immediately and highlight updated row
      setModalOpen(false);
      setHighlightId(returnedProduct.id);
      setTimeout(() => setHighlightId(null), 2500);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  // Instant Delete / Deactivation
  const handleDelete = async (id: number, name: string) => {
    const isConfirmed = await confirmDeleteAlert({
      itemName: name,
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showErrorAlert('ไม่สามารถลบสินค้าได้', json.message);
        return;
      }

      // If soft-deleted (status = INACTIVE) or hard-deleted:
      if (json.message.includes('ระงับการขาย')) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'INACTIVE' } : p))
        );
        await showSuccessAlert('ลบข้อมูลสำเร็จ', `ระงับการขาย "${name}" เรียบร้อยแล้ว`);
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        await showSuccessAlert('ลบข้อมูลสำเร็จ', `ลบสินค้า "${name}" ออกจากระบบเรียบร้อยแล้ว`);
      }
    } catch (error: any) {
      await showErrorAlert('เกิดข้อผิดพลาดในการลบ', error.message);
    }
  };

  // Summary Metrics
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.status === 'ACTIVE').length;
  const withRecipeCount = products.filter((p) => p.recipe && p.recipe.items?.length > 0).length;
  const missingRecipeCount = products.filter((p) => !p.recipe || !p.recipe.items || p.recipe.items.length === 0).length;

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
            รายการสินค้าทั้งหมด คำนวณต้นทุน และตรวจสอบความพร้อมของสูตร BOM
          </p>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={() => loadProducts(true)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            {isAdmin && (
              <button
                onClick={openAddModal}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มสินค้าใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Staff Mode Read-only Banner */}
        {!isAdmin && currentUser && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              <span>โหมดพนักงานขาย (Staff): คุณมีสิทธิ์ตรวจสอบราคาสินค้าเท่านั้น ไม่สามารถเพิ่ม แก้ไข หรือลบสินค้าได้</span>
            </div>
            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
              Read-Only
            </span>
          </div>
        )}

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">สินค้าทั้งหมด</div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {totalCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">เปิดจำหน่ายอยู่</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {activeCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">ผูกสูตร BOM แล้ว</div>
            <div className="text-2xl font-black text-blue-700 mt-1">
              {withRecipeCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">ยังไม่กำหนดสูตร</div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {missingRecipeCount} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
          </div>
        </div>

        {/* Store Tabs Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto border border-slate-200">
          <button
            type="button"
            onClick={() => setSelectedStore('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              selectedStore === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            ร้านค้าทั้งหมด ({products.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStore('CENTRAL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              selectedStore === 'CENTRAL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            เมนูส่วนกลาง ({products.filter((p) => !p.storeId).length})
          </button>

          {staffStores.map((st) => {
            const count = products.filter((p) => p.storeId === st.id).length;
            const isSelected = selectedStore === String(st.id);
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStore(String(st.id))}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                {st.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls (Instant Client-side) */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหารหัสสินค้า หรือชื่อสินค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Store Filter */}
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-emerald-50/50 text-emerald-900 font-bold focus:outline-none cursor-pointer flex-1 md:flex-initial"
            >
              <option value="ALL">🏪 ร้านค้าทั้งหมด ({staffStores.length + 1})</option>
              <option value="CENTRAL">🏬 ส่วนกลาง (ทุกร้านค้า)</option>
              {staffStores.map((st) => (
                <option key={st.id} value={st.id}>
                  🏪 {st.name}
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

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="ACTIVE">เปิดจำหน่าย (Active)</option>
              <option value="INACTIVE">ระงับการขาย (Inactive)</option>
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {initialLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">กำลังโหลดรายการสินค้า...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Package className="w-10 h-10 text-slate-300" />
              <span>ไม่พบข้อมูลสินค้าตรงกับเงื่อนไขการค้นหา</span>
              <button
                onClick={openAddModal}
                className="mt-2 text-emerald-600 font-bold underline cursor-pointer"
              >
                + เพิ่มสินค้าใหม่ทันที
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center">รูปภาพ</th>
                    <th className="py-3.5 px-4">รหัสสินค้า</th>
                    <th className="py-3.5 px-4">ชื่อสินค้า</th>
                    <th className="py-3.5 px-4">ร้านค้า</th>
                    <th className="py-3.5 px-4">หมวดหมู่</th>
                    <th className="py-3.5 px-4">หน่วยนับ</th>
                    <th className="py-3.5 px-4 text-right">ราคาขาย</th>
                    <th className="py-3.5 px-4 text-right">ต้นทุนสินค้า</th>
                    <th className="py-3.5 px-4 text-center">สูตรการผลิต (BOM)</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedProducts.map((p) => {
                    const isHighlighted = highlightId === p.id;
                    const hasRecipe = p.recipe && p.recipe.items && p.recipe.items.length > 0;
                    const bomCost = hasRecipe
                      ? p.recipe!.items.reduce(
                          (sum, item) => sum + item.quantity * Number(item.ingredient.costPerUnit || 0),
                          0
                        )
                      : null;

                    // Display user's edited cost if present, otherwise fallback to BOM cost
                    const displayCost =
                      p.cost !== null && p.cost !== undefined
                        ? Number(p.cost)
                        : bomCost !== null
                        ? bomCost
                        : null;

                    const margin = displayCost !== null ? Number(p.price) - displayCost : null;
                    const marginPercent =
                      margin !== null && Number(p.price) > 0
                        ? Math.round((margin / Number(p.price)) * 100)
                        : null;

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors duration-500 ${
                          isHighlighted
                            ? 'bg-emerald-50 ring-2 ring-emerald-500/50'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Product Image Thumbnail */}
                        <td className="py-2.5 px-4 text-center">
                          {p.image ? (
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-50 mx-auto flex items-center justify-center p-0.5">
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                              <Coffee className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                        </td>

                        {/* Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {p.code}
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                          {marginPercent !== null && (
                            <div className="text-[11px] text-emerald-600 font-semibold">
                              กำไรขั้นต้น: ~฿{margin?.toFixed(2)} ({marginPercent}%)
                            </div>
                          )}
                        </td>

                        {/* Store Badge */}
                        <td className="py-3.5 px-4">
                          {p.store ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Store className="w-3 h-3 text-emerald-700" />
                              <span>{p.store.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <Warehouse className="w-3 h-3 text-slate-400" />
                              <span>ส่วนกลาง</span>
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                            {p.category}
                          </span>
                        </td>

                        {/* Unit */}
                        <td className="py-3.5 px-4 text-slate-600 font-semibold">
                          {p.unit}
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                          ฿{Number(p.price).toFixed(2)}
                        </td>

                        {/* Cost Display: Shows exact edited cost, with BOM reference if available */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {displayCost !== null ? (
                            <div>
                              <div className="font-bold text-slate-800 text-sm">
                                ฿{displayCost.toFixed(2)}
                              </div>
                              {hasRecipe && bomCost !== null && p.cost !== null && p.cost !== undefined && (
                                <div className="text-[10px] text-slate-400">
                                  BOM: ฿{bomCost.toFixed(2)}
                                </div>
                              )}
                              {!p.cost && bomCost !== null && (
                                <div className="text-[10px] text-emerald-600 font-semibold">
                                  (คำนวณจากสูตร)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Recipe BOM Badge & Button */}
                        <td className="py-3.5 px-4 text-center">
                          {hasRecipe ? (
                            <button
                              onClick={() => setRecipeModalProduct(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="คลิกเพื่อดูสูตร BOM"
                            >
                              <ChefHat className="w-3.5 h-3.5" />
                              <span>{p.recipe!.items.length} วัตถุดิบ</span>
                              <Eye className="w-3 h-3 text-emerald-500" />
                            </button>
                          ) : (
                            <Link
                              href={`/recipes/new?productId=${p.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                            >
                              <span>+ เพิ่มสูตร</span>
                            </Link>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {p.status === 'ACTIVE' ? 'เปิดขาย' : 'ระงับการขาย'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          {isAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="แก้ไขสินค้าทันที"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id, p.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                title="ลบหรือระงับสินค้า"
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

              {/* Pagination (10 items per page) */}
              <Pagination
                currentPage={currentPage}
                totalItems={filteredProducts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
                  </h3>
                  <p className="text-xs text-slate-400">กรอกข้อมูลและบันทึก เพื่อแสดงผลในตารางทันที</p>
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
              {/* Product Image Upload Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>รูปภาพสินค้า / เมนู</span>
                  </span>
                  {formData.image && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="text-[11px] text-red-500 hover:underline font-bold cursor-pointer"
                    >
                      ลบรูปภาพออก
                    </button>
                  )}
                </label>

                {formData.image ? (
                  <div className="relative group w-full h-44 rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-slate-50 flex items-center justify-center">
                    <img
                      src={formData.image}
                      alt="Product preview"
                      className="w-full h-full object-contain p-2"
                    />
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer text-white text-xs font-bold">
                      <Upload className="w-4 h-4" />
                      <span>เปลี่ยนรูปภาพ</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                ) : (
                  <label
                    className={`w-full h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                      uploadingImage
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 bg-slate-50/60'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-emerald-700">กำลังอัปโหลดรูปภาพ...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800">คลิกเพื่ออัปโหลดรูปภาพสินค้า</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">รองรับไฟล์ JPG, PNG, WEBP, GIF (สูงสุด 5MB)</p>
                        </div>
                      </div>
                    )}
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="เช่น PRD-MILO01"
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
                    placeholder="เช่น แก้ว, ชิ้น, ขวด"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น น้ำไมโลเย็น 22oz"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Store Owner */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ร้านค้าเจ้าของเมนู / จุดขายประจำ
                </label>
                <select
                  value={formData.storeId}
                  onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white font-medium"
                >
                  <option value="">🏬 ส่วนกลาง (ใช้ได้ทุกร้านค้า)</option>
                  {staffStores.map((st) => (
                    <option key={st.id} value={st.id}>
                      🏪 {st.name} (@{st.username})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  เลือกเพื่อกำหนดว่าเมนูนี้เป็นของร้านค้าใด เช่น &quot;ร้าน กันเอง(Coffee)&quot; หรือเมนูส่วนกลาง
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมวดหมู่สินค้า
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="เช่น เครื่องดื่มเย็น"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการจำหน่าย
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                  >
                    <option value="ACTIVE">เปิดจำหน่าย (Active)</option>
                    <option value="INACTIVE">ระงับการขาย (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ราคาขาย (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="เช่น 35.00"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Cost */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      ต้นทุนสินค้า (บาท)
                    </label>
                    {editingProduct?.recipe && editingProduct.recipe.items?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const bomSum = editingProduct.recipe!.items.reduce(
                            (s, it) => s + it.quantity * Number(it.ingredient.costPerUnit || 0),
                            0
                          );
                          setFormData({ ...formData, cost: bomSum.toFixed(2) });
                        }}
                        className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                        title="คลิกเพื่อนำต้นทุนที่คำนวณจากสูตร BOM มาใส่"
                      >
                        ⚡ ใช้ต้นทุนจาก BOM
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="เช่น 12.00 หรือกำหนดเอง"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {editingProduct?.recipe && editingProduct.recipe.items?.length > 0 && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      สูตร BOM คำนวณได้ ~฿
                      {editingProduct.recipe.items
                        .reduce((s, it) => s + it.quantity * Number(it.ingredient.costPerUnit || 0), 0)
                        .toFixed(2)}
                    </span>
                  )}
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
                  disabled={submitting || uploadingImage}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Quick View Modal */}
      {recipeModalProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    สูตรการผลิต (BOM)
                  </h3>
                  <p className="text-xs text-slate-500">
                    สำหรับสินค้า: <strong className="text-emerald-700">{recipeModalProduct.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecipeModalProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">
                เมื่อขายสินค้า 1 {recipeModalProduct.unit} ระบบจะตัดวัตถุดิบดังนี้:
              </p>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                {recipeModalProduct.recipe?.items?.map((item, idx) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800">{item.ingredient.name}</span>
                    </div>
                    <div className="font-black text-slate-700">
                      {item.quantity} <span className="font-normal text-slate-500">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
              <Link
                href={`/recipes`}
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
              >
                <span>จัดการสูตร BOM ทั้งหมด</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setRecipeModalProduct(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
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

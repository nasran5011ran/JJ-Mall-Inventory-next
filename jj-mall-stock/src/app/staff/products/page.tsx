'use client';

import React, { useEffect, useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Store,
  DollarSign,
  Tag,
  Image as ImageIcon,
  Upload,
  Coffee,
  Layers,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';
import { confirmDeleteAlert, showSuccessAlert, showErrorAlert } from '@/lib/sweetalert';

interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number | null;
  image?: string | null;
  status: string;
  storeId?: number | null;
  store?: {
    id: number;
    name: string;
    username: string;
  } | null;
  recipe?: {
    id: number;
    description?: string | null;
    items: Array<{
      id: number;
      ingredientId: number;
      quantity: number;
      unit: string;
      ingredient: {
        id: number;
        code: string;
        name: string;
        unit: string;
        costPerUnit?: number;
        currentStock?: number;
        storeStock?: number;
      };
    }>;
  } | null;
}

interface AvailableIngredient {
  ingredientId: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  costPerUnit: number;
  expectedStock: number;
}

interface RecipeFormItem {
  ingredientId: string;
  quantity: string;
  unit: string;
  customName?: string;
}

export default function StaffProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Recipe State inside Modal
  const [recipeItems, setRecipeItems] = useState<RecipeFormItem[]>([]);
  const [recipeDescription, setRecipeDescription] = useState('');
  const [activeRecipeSearchIdx, setActiveRecipeSearchIdx] = useState<number | null>(null);
  const [recipeSearchTexts, setRecipeSearchTexts] = useState<Record<number, string>>({});

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'เครื่องดื่มเย็น',
    unit: 'แก้ว',
    price: '',
    cost: '',
    image: '',
    status: 'ACTIVE',
  });

  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/products', {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  useEffect(() => {
    if (swrData?.success && Array.isArray(swrData.products)) {
      setProducts(swrData.products);
    }
  }, [swrData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const availableIngredients: AvailableIngredient[] = useMemo(() => {
    if (swrData?.success && Array.isArray(swrData.ingredients)) {
      return swrData.ingredients;
    }
    return [];
  }, [swrData]);

  const previewRecipeCost = useMemo(() => {
    return recipeItems.reduce((acc, row) => {
      const ing = availableIngredients.find((i) => i.ingredientId === Number(row.ingredientId));
      if (!ing) return acc;
      const qty = parseFloat(row.quantity) || 0;
      return acc + qty * (Number(ing.costPerUnit) || 0);
    }, 0);
  }, [recipeItems, availableIngredients]);

  const addRecipeRow = () => {
    setRecipeItems((prev) => [
      ...prev,
      {
        ingredientId: '',
        quantity: '1',
        unit: 'หน่วย',
        customName: '',
      },
    ]);
  };

  const removeRecipeRow = (idx: number) => {
    setRecipeItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRecipeRow = (idx: number, field: keyof RecipeFormItem, value: any) => {
    setRecipeItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'ingredientId') {
        const found = availableIngredients.find((i) => i.ingredientId === Number(value));
        if (found) {
          copy[idx].unit = found.unit;
          copy[idx].customName = found.name;
        }
      }
      return copy;
    });
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Show products belonging to this staff store OR central
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      // Filter out products of other specific stores if needed
      const isMyStoreOrCentral = !p.storeId || p.storeId === user?.id;
      if (!isMyStoreOrCentral) return false;

      const matchSearch =
        !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory, user?.id]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

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
      image: '',
      status: 'ACTIVE',
    });
    setRecipeItems([]);
    setRecipeDescription('');
    setActiveRecipeSearchIdx(null);
    setRecipeSearchTexts({});
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
      price: String(p.price || ''),
      cost: p.cost ? String(p.cost) : '',
      image: p.image || '',
      status: p.status,
    });
    if (p.recipe?.items && p.recipe.items.length > 0) {
      setRecipeItems(
        p.recipe.items.map((it) => ({
          ingredientId: String(it.ingredientId),
          quantity: String(it.quantity),
          unit: it.unit || it.ingredient?.unit || 'หน่วย',
          customName: it.ingredient?.name || '',
        }))
      );
      setRecipeDescription(p.recipe.description || '');
    } else {
      setRecipeItems([]);
      setRecipeDescription('');
    }
    setActiveRecipeSearchIdx(null);
    setRecipeSearchTexts({});
    setFormError(null);
    setModalOpen(true);
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

    setUploadingImage(true);
    setFormError(null);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }

      setFormData((prev) => ({ ...prev, image: json.url }));
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const isEditing = Boolean(editingProduct);
      const url = isEditing ? `/api/products/${editingProduct!.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const validRecipeItems = recipeItems
        .filter((it) => it.ingredientId && parseFloat(it.quantity) > 0)
        .map((it) => ({
          ingredientId: Number(it.ingredientId),
          quantity: parseFloat(it.quantity),
          unit: it.unit,
        }));

      const payload = {
        ...formData,
        cost: previewRecipeCost > 0 ? previewRecipeCost : (Number(formData.cost) || 0),
        recipeItems: validRecipeItems,
        recipeDescription,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      await mutate();
      setModalOpen(false);
      showToast(isEditing ? `อัปเดตเมนู "${formData.name}" เรียบร้อยแล้ว` : `เพิ่มเมนูใหม่ "${formData.name}" สำเร็จ!`);
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const isConfirmed = await confirmDeleteAlert({
      itemName: name,
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showErrorAlert('ไม่สามารถลบเมนูได้', json.message);
        return;
      }
      await mutate();
      await showSuccessAlert('ลบข้อมูลสำเร็จ', `ลบเมนู "${name}" เรียบร้อยแล้ว`);
    } catch (error: any) {
      await showErrorAlert('เกิดข้อผิดพลาดในการลบ', error.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Package className="w-3.5 h-3.5" />
            รายการสินค้าและเมนูของร้าน
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ เพิ่มเมนูใหม่ของร้าน</span>
        </button>
      </div>

      {/* Search & Category Filter */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหารหัสสินค้า หรือชื่อเมนู..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
        >
          <option value="ALL">ทุกหมวดหมู่ ({categories.length})</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading && products.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดรายการสินค้า...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16 text-center">รูปภาพ</th>
                  <th className="py-3.5 px-4">รหัสสินค้า</th>
                  <th className="py-3.5 px-4">ชื่อเมนู</th>
                  <th className="py-3.5 px-4">หมวดหมู่</th>
                  <th className="py-3.5 px-4">สังกัดร้าน</th>
                  <th className="py-3.5 px-4">หน่วยนับ</th>
                  <th className="py-3.5 px-4 text-right">ราคาขายหน้าร้าน</th>
                  <th className="py-3.5 px-4 text-center">สถานะ</th>
                  <th className="py-3.5 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedProducts.map((p) => {
                  const isMyMenu = p.storeId === user?.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Product Image Thumbnail */}
                      <td className="py-2.5 px-4 text-center">
                        {p.image ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-50 mx-auto flex items-center justify-center">
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                            <Coffee className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {p.code}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">
                        <div className="font-bold text-sm">{p.name}</div>
                        <div className="mt-1">
                          {p.recipe && p.recipe.items.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Layers className="w-3 h-3 text-emerald-600" />
                              สูตร {p.recipe.items.length} รายการ • ต้นทุน ฿${Number(p.cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                              ยังไม่มีสูตร
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.store ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            <Store className="w-3 h-3 text-amber-700" />
                            <span>{p.store.name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            ทุกร้านค้า
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {p.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-base font-mono">
                        ฿{Number(p.price).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {p.status === 'ACTIVE' ? 'พร้อมขาย' : 'ระงับการขาย'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="แก้ไขเมนู"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="ลบ/ระงับเมนู"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingProduct ? 'แก้ไขเมนูของร้าน' : 'เพิ่มเมนูใหม่ของร้าน'}
                  </h3>
                  <p className="text-[11px] text-slate-400">บันทึกข้อมูลและอัปโหลดรูปภาพเพื่อใช้ขายหน้าร้าน POS</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Image Upload Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                    รูปภาพสินค้า (Product Image)
                  </span>
                  {formData.image && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> ลบรูปภาพออก
                    </button>
                  )}
                </label>

                {formData.image ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group flex items-center justify-center p-3">
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-full h-44 object-contain rounded-xl"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-2xl">
                      <label className="px-3.5 py-2 rounded-xl bg-white text-slate-800 text-xs font-bold shadow-md cursor-pointer hover:bg-slate-100 flex items-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{uploadingImage ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปภาพ'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                      uploadingImage
                        ? 'border-emerald-400 bg-emerald-50/50 cursor-wait'
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

              {/* Code & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="PRD-xxx"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หน่วยนับ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="เช่น แก้ว"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อเมนูเครื่องดื่ม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น ชาไทยเย็นพรีเมียม"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมวดหมู่
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="เครื่องดื่มเย็น"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
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
                    placeholder="35.00"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สถานะสินค้า
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
                >
                  <option value="ACTIVE">พร้อมขาย (Active)</option>
                  <option value="INACTIVE">ระงับการขายชั่วคราว (Inactive)</option>
                </select>
              </div>

              {/* Recipe (BOM) Section */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-800">สูตรการผลิตและตัดสต็อกวัตถุดิบ (BOM)</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {recipeItems.length} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ระบุวัตถุดิบและปริมาณที่ใช้ต่อ 1 {formData.unit || 'แก้ว'} เพื่อคำนวณต้นทุนและหักสต็อกอัตโนมัติเมื่อกดขายหน้าร้าน POS
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addRecipeRow}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มวัตถุดิบในสูตร</span>
                  </button>
                </div>

                {recipeItems.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    <Coffee className="w-8 h-8 text-slate-400 mx-auto mb-1.5 opacity-60" />
                    <p className="font-semibold text-slate-700">ยังไม่ได้กำหนดวัตถุดิบสำหรับเมนูนี้</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      หากไม่กำหนดสูตร ระบบจะไม่ตัดสต็อกวัตถุดิบเมื่อขายเมนูนี้
                    </p>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="mt-2.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เริ่มเพิ่มวัตถุดิบ</span>
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-visible bg-white">
                    <div className="overflow-x-auto overflow-y-visible">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                            <th className="py-2.5 px-2.5 text-center w-10">#</th>
                            <th className="py-2.5 px-3">เลือกวัตถุดิบ (คงเหลือในสต็อก)</th>
                            <th className="py-2.5 px-3 w-28 text-center">ปริมาณที่ใช้</th>
                            <th className="py-2.5 px-2 w-20 text-center">หน่วยนับ</th>
                            <th className="py-2.5 px-3 w-28 text-right">ต้นทุน (฿)</th>
                            <th className="py-2.5 px-2 w-10 text-center">ลบ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recipeItems.map((item, idx) => {
                            const selectedIng = availableIngredients.find(
                              (i) => i.ingredientId === Number(item.ingredientId)
                            );
                            const availStock = selectedIng ? Number(selectedIng.expectedStock || 0) : 0;
                            const usedQty = parseFloat(item.quantity) || 0;
                            const newStock = Number((availStock - usedQty).toFixed(4));
                            const lineCost = selectedIng ? usedQty * Number(selectedIng.costPerUnit || 0) : 0;

                            const isDuplicate = recipeItems.some(
                              (other, otherIdx) => otherIdx !== idx && other.ingredientId && other.ingredientId === item.ingredientId
                            );

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-2 text-center text-slate-400 font-bold align-top pt-4">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3 align-top">
                                  {/* Combobox Search / Selector */}
                                  <div className="relative">
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        value={item.customName || ''}
                                        onClick={() => setActiveRecipeSearchIdx(idx)}
                                        onChange={(e) => {
                                          updateRecipeRow(idx, 'customName', e.target.value);
                                          setActiveRecipeSearchIdx(idx);
                                        }}
                                        placeholder="พิมพ์ค้นหาหรือคลิกเลือกวัตถุดิบ..."
                                        className="w-full pl-3 pr-8 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveRecipeSearchIdx(activeRecipeSearchIdx === idx ? null : idx)
                                        }
                                        className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Dropdown Popover */}
                                    {activeRecipeSearchIdx === idx && (() => {
                                      const keyword = (item.customName || '').trim().toLowerCase();
                                      const filtered = availableIngredients.filter(
                                        (ing) =>
                                          !keyword ||
                                          ing.name.toLowerCase().includes(keyword) ||
                                          ing.code.toLowerCase().includes(keyword) ||
                                          (ing.category && ing.category.toLowerCase().includes(keyword))
                                      );

                                      return (
                                        <div className="absolute top-full left-0 mt-1.5 w-[380px] sm:w-[460px] max-w-[85vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col ring-4 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
                                            <span>รายการวัตถุดิบ ({filtered.length})</span>
                                            <button
                                              type="button"
                                              onClick={() => setActiveRecipeSearchIdx(null)}
                                              className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
                                            >
                                              ✕ ปิด
                                            </button>
                                          </div>
                                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                                            {filtered.length === 0 ? (
                                              <div className="p-4 text-center text-xs text-slate-500">
                                                ไม่พบวัตถุดิบ "{keyword}" ในระบบ
                                              </div>
                                            ) : (
                                              filtered.map((ing) => {
                                                const isSelected = item.ingredientId === String(ing.ingredientId);
                                                return (
                                                  <div
                                                    key={ing.ingredientId}
                                                    onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      updateRecipeRow(idx, 'ingredientId', String(ing.ingredientId));
                                                      setActiveRecipeSearchIdx(null);
                                                    }}
                                                    className={`p-2.5 hover:bg-emerald-50/80 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                                      isSelected ? 'bg-emerald-50/90 font-bold border-l-4 border-emerald-600' : ''
                                                    }`}
                                                  >
                                                    <div>
                                                      <div className="text-xs text-slate-900 font-bold">{ing.name}</div>
                                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                                        <span className="font-mono font-bold bg-slate-100 px-1 py-0.2 rounded text-slate-700">
                                                          {ing.code}
                                                        </span>
                                                        {ing.category && (
                                                          <span className="bg-emerald-50 text-emerald-800 px-1 py-0.2 rounded">
                                                            {ing.category}
                                                          </span>
                                                        )}
                                                        <span>ต้นทุน ฿{Number(ing.costPerUnit || 0).toFixed(2)}/{ing.unit}</span>
                                                      </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 shrink-0">
                                                      คงเหลือ: {Number(ing.expectedStock || 0).toLocaleString()} {ing.unit}
                                                    </span>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Live badges under selected ingredient (3 Badges identical to Admin) */}
                                    {selectedIng && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10.5px]">
                                        {/* 1. คงเหลือในสต็อก */}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                                          <span className="text-[9.5px] text-slate-500">คงเหลือในสต็อก:</span>
                                          <span className="font-mono font-bold text-slate-800">
                                            {availStock.toLocaleString()} {selectedIng.unit}
                                          </span>
                                        </span>

                                        {/* 2. จำนวนที่ใช้ไป */}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                                          <span className="text-[9.5px] text-amber-700">ใช้ไป:</span>
                                          <span className="font-mono font-bold text-amber-800">
                                            {usedQty > 0 ? `-${usedQty.toLocaleString()}` : '0'} {selectedIng.unit}
                                          </span>
                                        </span>

                                        <span className="text-slate-400 font-bold">→</span>

                                        {/* 3. จำนวนคงเหลือใหม่ */}
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                                            newStock < 0
                                              ? 'bg-red-50 border-red-300 text-red-700'
                                              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                          }`}
                                        >
                                          <span className="text-[9.5px]">คงเหลือใหม่:</span>
                                          <span className="font-mono font-bold">
                                            {newStock.toLocaleString()} {selectedIng.unit}
                                          </span>
                                        </span>
                                      </div>
                                    )}

                                    {isDuplicate && (
                                      <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                        ⚠️ มีวัตถุดิบนี้ในสูตรแล้ว
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 align-top pt-3">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.0001"
                                    required
                                    value={item.quantity}
                                    onChange={(e) => updateRecipeRow(idx, 'quantity', e.target.value)}
                                    placeholder="1"
                                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                  />
                                </td>
                                <td className="py-3 px-2 align-top pt-4 text-center font-semibold text-slate-600 text-xs">
                                  {item.unit || selectedIng?.unit || '-'}
                                </td>
                                <td className="py-3 px-3 align-top pt-4 text-right font-mono font-bold text-slate-700 text-xs">
                                  ฿{lineCost.toFixed(2)}
                                </td>
                                <td className="py-3 px-2 align-top pt-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeRecipeRow(idx)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="ลบวัตถุดิบแถวนี้"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50/80 border-t border-slate-200 font-bold text-slate-800 text-xs">
                            <td colSpan={4} className="py-3 px-4 text-right">
                              ต้นทุนวัตถุดิบรวมต่อ 1 {formData.unit || 'แก้ว'}:
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 text-sm">
                              ฿{previewRecipeCost.toFixed(2)}
                            </td>
                            <td />
                          </tr>
                          {parseFloat(formData.price) > 0 && (
                            <tr className="bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600">
                              <td colSpan={4} className="py-2 px-4 text-right font-medium">
                                กำไรส่วนต่างประมาณการ:
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                                ฿{(parseFloat(formData.price) - previewRecipeCost).toFixed(2)} (
                                {previewRecipeCost > 0
                                  ? `${(((parseFloat(formData.price) - previewRecipeCost) / parseFloat(formData.price)) * 100).toFixed(1)}%`
                                  : '100%'}
                                )
                              </td>
                              <td />
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    คำอธิบาย / ขั้นตอนวิธีชง (ถ้ามี)
                  </label>
                  <textarea
                    rows={2}
                    value={recipeDescription}
                    onChange={(e) => setRecipeDescription(e.target.value)}
                    placeholder="เช่น ชงใบชา 200ml เติมนมข้นหวาน 30ml..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer transition-all"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกเมนู'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

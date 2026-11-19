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
  Eye,
  BookOpen,
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
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
    dropUp: boolean;
  } | null>(null);

  const openSearchForIdx = (idx: number, el?: HTMLElement | null) => {
    const target = el || (typeof document !== 'undefined' ? document.getElementById('staff-recipe-ing-input-' + idx) : null);
    if (target) {
      const rect = target.getBoundingClientRect();
      const popoverHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropUp = spaceBelow < popoverHeight && rect.top > popoverHeight;

      const targetTop = dropUp ? Math.max(10, rect.top - popoverHeight - 6) : rect.bottom + 6;
      const targetWidth = Math.max(380, Math.min(460, rect.width * 1.5));
      const targetLeft = Math.max(12, Math.min(rect.left, window.innerWidth - targetWidth - 16));

      setDropdownPosition({
        top: targetTop,
        left: targetLeft,
        width: targetWidth,
        dropUp,
      });
    }
    setActiveRecipeSearchIdx(idx);
  };
  const [recipeSearchTexts, setRecipeSearchTexts] = useState<Record<number, string>>({});

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingRecipeProduct, setViewingRecipeProduct] = useState<ProductItem | null>(null);
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

  const removeRecipeRow = async (idx: number) => {
    const item = recipeItems[idx];
    const ing = availableIngredients.find((i) => i.ingredientId === Number(item?.ingredientId));
    const ingName = item?.customName || ing?.name || `วัตถุดิบรายการที่ ${idx + 1}`;

    const isConfirmed = await confirmDeleteAlert({
      title: 'ลบวัตถุดิบออกจากสูตรหรือไม่?',
      text: `คุณต้องการลบ "${ingName}" ออกจากสูตรสินค้านี้ใช่หรือไม่?`,
      confirmButtonText: 'ลบวัตถุดิบ',
      cancelButtonText: 'ยกเลิก',
    });

    if (!isConfirmed) return;

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
    setDropdownPosition(null);
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
      image: p.image && p.image !== 'null' ? p.image : '',
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

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'jfif', 'bmp'];
    const isImage = (file.type && file.type.startsWith('image/')) || validExts.includes(ext);

    if (!isImage) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP, GIF)');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('ขนาดไฟล์ภาพต้องไม่เกิน 10 MB');
      e.target.value = '';
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
      e.target.value = '';
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
                            <button
                              type="button"
                              onClick={() => setViewingRecipeProduct(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer shadow-2xs group/btn"
                              title="คลิกเพื่อดูรายละเอียดสูตรวัตถุดิบ"
                            >
                              <Layers className="w-3 h-3 text-emerald-600" />
                              <span>สูตร {p.recipe.items.length} รายการ • ต้นทุน ฿${Number(p.cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <Eye className="w-3 h-3 ml-0.5 text-emerald-500 group-hover/btn:text-emerald-700" />
                            </button>
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
                          {p.recipe && p.recipe.items.length > 0 && (
                            <button
                              onClick={() => setViewingRecipeProduct(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                              title="ดูรายละเอียดสูตรวัตถุดิบ"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="แก้ไขเมนูและสูตร"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div id="staff-product-modal-dialog" className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-150 max-h-[94vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingProduct ? 'แก้ไขเมนูและสูตรของร้าน' : 'เพิ่มเมนูและกำหนดสูตรใหม่'}
                  </h3>
                  <p className="text-[11px] text-slate-400">บันทึกข้อมูลสินค้าพร้อมสูตรการผลิตเพื่อตัดสต็อกอัตโนมัติเมื่อขายหน้าร้าน POS</p>
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
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-3.5 flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* 2 Columns Layout: Left = Product Info, Right = Recipe Builder (Visible side-by-side without scrolling!) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1 pb-1">
                
                {/* Left Column: Product Information (5 cols) */}
                <div className="lg:col-span-5 space-y-3 lg:border-r border-slate-200 lg:pr-5 pb-3 lg:pb-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ข้อมูลเมนูสินค้า</span>
                  </div>

                  {/* Compact Image Upload Box */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-emerald-600" />
                        รูปภาพเมนู
                      </span>
                      {formData.image && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: '' })}
                          className="text-[10px] text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" /> ลบรูป
                        </button>
                      )}
                    </label>

                    {formData.image ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group flex items-center justify-center p-2 h-32">
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="w-full h-full object-contain rounded-xl"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-2xl">
                          <label className="px-3 py-1.5 rounded-xl bg-white text-slate-800 text-[11px] font-bold shadow-md cursor-pointer hover:bg-slate-100 flex items-center gap-1 transition-colors">
                            <Upload className="w-3 h-3 text-emerald-600" />
                            <span>{uploadingImage ? 'อัปโหลด...' : 'เปลี่ยนรูป'}</span>
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
                        className={`border-2 border-dashed rounded-2xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors h-28 ${
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
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-bold text-emerald-700">กำลังอัปโหลด...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <Upload className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700">คลิกอัปโหลดรูปภาพ</span>
                            <span className="text-[9px] text-slate-400">JPG, PNG, WEBP (ไม่เกิน 5MB)</span>
                          </div>
                        )}
                      </label>
                    )}
                  </div>

                  {/* Code & Unit */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        รหัสสินค้า <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="PRD-xxx"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        หน่วยนับ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="เช่น แก้ว"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ชื่อเมนูเครื่องดื่ม <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="เช่น ชาไทยเย็นพรีเมียม"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>

                  {/* Category & Price */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        หมวดหมู่
                      </label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="เครื่องดื่มเย็น"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
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
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      สถานะสินค้า
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
                    >
                      <option value="ACTIVE">พร้อมขาย (Active)</option>
                      <option value="INACTIVE">ระงับการขายชั่วคราว (Inactive)</option>
                    </select>
                  </div>

                  {/* Recipe Description / Brew steps */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      คำอธิบาย / ขั้นตอนวิธีชง (ถ้ามี)
                    </label>
                    <textarea
                      rows={2}
                      value={recipeDescription}
                      onChange={(e) => setRecipeDescription(e.target.value)}
                      placeholder="เช่น ชงใบชา 200ml เติมนมข้นหวาน 30ml..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                    />
                  </div>
                </div>

                {/* Right Column: Recipe Builder (7 cols) - Visible immediately side-by-side without scrolling! */}
                <div className="lg:col-span-7 flex flex-col space-y-2.5 overflow-visible pb-16 lg:pb-24">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 shrink-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-slate-800">สูตรการผลิตและตัดสต็อกวัตถุดิบ (BOM)</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {recipeItems.length} รายการ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ระบุวัตถุดิบและปริมาณต่อ 1 {formData.unit || 'แก้ว'} เพื่อตัดสต็อกอัตโนมัติเมื่อกดขายหน้าร้าน POS
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ เพิ่มวัตถุดิบ</span>
                    </button>
                  </div>

                  {recipeItems.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500 flex flex-col items-center justify-center my-auto">
                      <Coffee className="w-9 h-9 text-slate-400 mb-2 opacity-60" />
                      <p className="font-bold text-slate-700 text-sm">ยังไม่ได้กำหนดวัตถุดิบสำหรับเมนูนี้</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        หากไม่กำหนดสูตร ระบบจะไม่ตัดสต็อกวัตถุดิบเมื่อขายเมนูนี้หน้าร้าน POS
                      </p>
                      <button
                        type="button"
                        onClick={addRecipeRow}
                        className="mt-3 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เริ่มเพิ่มวัตถุดิบในสูตร</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-visible bg-white flex flex-col flex-1 min-h-[300px]">
                      <div className="overflow-x-auto overflow-y-visible">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                              <th className="py-2 px-2 text-center w-8">#</th>
                              <th className="py-2 px-2.5">เลือกวัตถุดิบ (คงเหลือในสต็อก)</th>
                              <th className="py-2 px-2 w-24 text-center">ปริมาณ</th>
                              <th className="py-2 px-1.5 w-16 text-center">หน่วย</th>
                              <th className="py-2 px-2.5 w-24 text-right">ต้นทุน (฿)</th>
                              <th className="py-2 px-1.5 w-8 text-center">ลบ</th>
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
                                  <td className="py-2.5 px-2 text-center text-slate-400 font-bold align-top pt-3 text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-2.5 align-top">
                                    {/* Combobox Search / Selector */}
                                    <div className="relative">
                                      <div className="relative flex items-center">
                                        <input
                                          id={`staff-recipe-ing-input-${idx}`}
                                          type="text"
                                          value={item.customName || ''}
                                          onClick={(e) => openSearchForIdx(idx, e.currentTarget)}
                                          onFocus={(e) => openSearchForIdx(idx, e.currentTarget)}
                                          onChange={(e) => {
                                            updateRecipeRow(idx, 'customName', e.target.value);
                                            openSearchForIdx(idx, e.currentTarget);
                                          }}
                                          placeholder="พิมพ์ค้นหาหรือคลิกเลือกวัตถุดิบ..."
                                          className="w-full pl-2.5 pr-7 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium bg-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            if (activeRecipeSearchIdx === idx) {
                                              setActiveRecipeSearchIdx(null);
                                            } else {
                                              openSearchForIdx(idx, e.currentTarget);
                                            }
                                          }}
                                          className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Live badges under selected ingredient (3 Badges identical to Admin) */}
                                      {selectedIng && (
                                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                            <span className="text-slate-500">สต็อก:</span>
                                            <span className="font-mono font-bold">{availStock.toLocaleString()} {selectedIng.unit}</span>
                                          </span>

                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                                            <span>ใช้:</span>
                                            <span className="font-mono font-bold">{usedQty > 0 ? `-${usedQty.toLocaleString()}` : '0'}</span>
                                          </span>

                                          <span
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-medium ${
                                              newStock < 0
                                                ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                                                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                            }`}
                                          >
                                            <span>เหลือใหม่:</span>
                                            <span className="font-mono font-bold">{newStock.toLocaleString()} {selectedIng.unit}</span>
                                          </span>
                                        </div>
                                      )}

                                      {isDuplicate && (
                                        <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                          ⚠️ มีวัตถุดิบนี้ในสูตรแล้ว
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 align-top pt-2">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.0001"
                                      required
                                      value={item.quantity}
                                      onChange={(e) => updateRecipeRow(idx, 'quantity', e.target.value)}
                                      placeholder="1"
                                      className="w-full px-2 py-1 text-xs rounded-xl border border-slate-300 font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    />
                                  </td>
                                  <td className="py-2 px-1.5 align-top pt-2.5 text-center font-semibold text-slate-600 text-[11px]">
                                    {item.unit || selectedIng?.unit || '-'}
                                  </td>
                                  <td className="py-2 px-2.5 align-top pt-2.5 text-right font-mono font-bold text-slate-700 text-xs">
                                    ฿{lineCost.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-1.5 align-top pt-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeRecipeRow(idx)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
                            <tr className="bg-emerald-50/90 border-t border-slate-200 font-bold text-slate-800 text-xs">
                              <td colSpan={4} className="py-2.5 px-3 text-right">
                                ต้นทุนวัตถุดิบรวมต่อ 1 {formData.unit || 'แก้ว'}:
                              </td>
                              <td className="py-2.5 px-2.5 text-right font-mono font-black text-emerald-800 text-sm">
                                ฿{previewRecipeCost.toFixed(2)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setDropdownPosition(null);
                    setActiveRecipeSearchIdx(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer transition-all"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกเมนูและสูตร'}
                </button>
              </div>
            </form>

            {/* Floating Fixed Dropdown Popover (Positioned outside table & scroll so it is 100% visible and NEVER clipped!) */}
            {activeRecipeSearchIdx !== null && dropdownPosition && (() => {
              const currentItem = recipeItems[activeRecipeSearchIdx];
              const keyword = (currentItem?.customName || '').trim().toLowerCase();
              const filtered = availableIngredients.filter(
                (ing) =>
                  !keyword ||
                  ing.name.toLowerCase().includes(keyword) ||
                  ing.code.toLowerCase().includes(keyword) ||
                  (ing.category && ing.category.toLowerCase().includes(keyword))
              );

              return (
                <>
                  {/* Backdrop click outside to close */}
                  <div
                    className="fixed inset-0 z-[99998]"
                    onClick={() => {
                      setActiveRecipeSearchIdx(null);
                      setDropdownPosition(null);
                    }}
                  />

                  <div
                    style={{
                      position: 'fixed',
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      zIndex: 99999,
                    }}
                    className="bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col ring-4 ring-black/15 animate-in fade-in duration-100 max-w-[92vw]"
                  >
                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 shrink-0">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>รายการวัตถุดิบในระบบ ({filtered.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRecipeSearchIdx(null);
                          setDropdownPosition(null);
                        }}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold text-xs px-2 py-0.5 rounded-lg hover:bg-slate-200"
                      >
                        ✕ ปิด
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 [scrollbar-width:thin]">
                      {filtered.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          ไม่พบวัตถุดิบ "{keyword}" ในระบบ
                        </div>
                      ) : (
                        filtered.map((ing) => {
                          const isSelected = currentItem?.ingredientId === String(ing.ingredientId);
                          return (
                            <div
                              key={ing.ingredientId}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                updateRecipeRow(activeRecipeSearchIdx, 'ingredientId', String(ing.ingredientId));
                                setActiveRecipeSearchIdx(null);
                                setDropdownPosition(null);
                              }}
                              className={`p-3 hover:bg-emerald-50/80 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                                isSelected ? 'bg-emerald-50/90 font-bold border-l-4 border-emerald-600' : ''
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs text-slate-900 font-bold truncate">{ing.name}</div>
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
                              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                                คงเหลือ: {Number(ing.expectedStock || 0).toLocaleString()} {ing.unit}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* View Recipe Modal (กดดูสูตร 1 รายการ) */}
      {viewingRecipeProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    รายละเอียดสูตร: {viewingRecipeProduct.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                      {viewingRecipeProduct.code}
                    </span>
                    <span>หมวด: {viewingRecipeProduct.category || '-'}</span>
                    <span>•</span>
                    <span className="font-bold text-emerald-700 font-mono">ราคา ฿{Number(viewingRecipeProduct.price).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingRecipeProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Product Info Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                {viewingRecipeProduct.image ? (
                  <img
                    src={viewingRecipeProduct.image}
                    alt={viewingRecipeProduct.name}
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                    <Coffee className="w-7 h-7" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800">{viewingRecipeProduct.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    หน่วยจำหน่าย: <strong className="text-slate-700">{viewingRecipeProduct.unit || 'แก้ว'}</strong>
                  </div>
                  {viewingRecipeProduct.recipe?.description && (
                    <div className="mt-1 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                      <strong className="text-slate-700">วิธีชง/ขั้นตอน:</strong> {viewingRecipeProduct.recipe.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Recipe Ingredients Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>รายการวัตถุดิบในสูตร ({viewingRecipeProduct.recipe?.items?.length || 0} รายการ)</span>
                  </h4>
                </div>

                {(!viewingRecipeProduct.recipe?.items || viewingRecipeProduct.recipe.items.length === 0) ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    เมนูนี้ยังไม่มีการกำหนดสูตรวัตถุดิบ
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                          <th className="py-2 px-2.5 text-center w-8">#</th>
                          <th className="py-2 px-3">ชื่อวัตถุดิบ</th>
                          <th className="py-2 px-3 text-center w-28">ปริมาณที่ใช้</th>
                          <th className="py-2 px-3 text-right w-28">ต้นทุนโดยประมาณ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingRecipeProduct.recipe.items.map((it, idx) => {
                          const mIng = availableIngredients.find((a) => a.ingredientId === it.ingredientId);
                          const cost = Number(it.ingredient?.costPerUnit ?? mIng?.costPerUnit ?? 0);
                          const lineCost = Number(it.quantity || 0) * cost;
                          const currentStock = Number(mIng?.expectedStock ?? it.ingredient?.storeStock ?? it.ingredient?.currentStock ?? 0);

                          return (
                            <tr key={it.id || idx} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-2.5 text-center text-slate-400 font-bold text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{it.ingredient?.name || mIng?.name || 'วัตถุดิบ'}</div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">
                                    {it.ingredient?.code || mIng?.code}
                                  </span>
                                  <span>สต็อกคงเหลือในร้าน: <strong className="text-slate-700">{currentStock.toLocaleString()} {it.unit || it.ingredient?.unit}</strong></span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-mono font-bold text-slate-800 text-xs">
                                  {Number(it.quantity).toLocaleString()}
                                </span>{' '}
                                <span className="text-slate-500 text-[11px]">{it.unit || it.ingredient?.unit}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 text-xs">
                                ฿{lineCost.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/90 border-t border-slate-200 font-bold text-slate-800 text-xs">
                          <td colSpan={3} className="py-2.5 px-3 text-right">
                            ต้นทุนวัตถุดิบรวมต่อ 1 {viewingRecipeProduct.unit || 'แก้ว'}:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800 text-sm">
                            ฿{Number(viewingRecipeProduct.cost || 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 mt-3">
              <button
                type="button"
                onClick={() => {
                  const p = viewingRecipeProduct;
                  setViewingRecipeProduct(null);
                  openEditModal(p);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>แก้ไขสูตร / เมนูนี้</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingRecipeProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
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
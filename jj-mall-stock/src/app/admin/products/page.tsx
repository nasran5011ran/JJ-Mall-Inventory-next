'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { useAuth } from '@/context/auth-context';
import { confirmDeleteAlert, showSuccessAlert, showErrorAlert } from '@/lib/sweetalert';
import Pagination from '@/components/Pagination';
import AutocompleteSuggest from '@/components/ui/autocomplete-suggest';
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
  Layers,
  Calculator,
  ChevronDown,
} from 'lucide-react';

const PRESET_UNITS = [
  'กรัม',
  'กิโลกรัม',
  'มิลลิลิตร',
  'ลิตร',
  'ชิ้น',
  'ใบ',
  'ฟอง',
  'แก้ว',
  'ขวด',
  'กระป๋อง',
  'ซอง',
  'ถุง',
  'แพ็ค',
  'กล่อง',
];

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
  const { mutate: globalMutate } = useSWRConfig();
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

  // Inline Recipe Editor Modal
  const { data: ingredientsData } = useSWR('/api/ingredients');
  const allIngredients: any[] = useMemo(() => {
    return ingredientsData?.success && Array.isArray(ingredientsData.ingredients) ? ingredientsData.ingredients : [];
  }, [ingredientsData]);

  const [editRecipeProduct, setEditRecipeProduct] = useState<ProductItem | null>(null);
  const [recipeStoreId, setRecipeStoreId] = useState<number | null>(null);

  // Lock background page scrollbar when any modal is open
  useEffect(() => {
    const anyModalOpen = modalOpen || Boolean(recipeModalProduct) || Boolean(editRecipeProduct);
    if (!anyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen, recipeModalProduct, editRecipeProduct]);

  const currentRecipeStore = useMemo(() => {
    if (!recipeStoreId) return null;
    return staffStores.find((s) => s.id === recipeStoreId) || null;
  }, [recipeStoreId, staffStores]);

  const recipeStoreBalancesMap = useMemo(() => {
    const map = new Map<number, { expectedStock: number; hasStockHistory: boolean; warehouseStock: number }>();
    if (!recipeStoreId || !ingredientsData?.storeBalances) return map;
    const list = ingredientsData.storeBalances[recipeStoreId] || [];
    list.forEach((b: any) =>
      map.set(Number(b.ingredientId), {
        expectedStock: Number(b.expectedStock || 0),
        hasStockHistory: Boolean(b.hasStockHistory),
        warehouseStock: Number(b.warehouseStock || 0),
      })
    );
    return map;
  }, [recipeStoreId, ingredientsData]);

  const getRecipeIngredientStock = (ing: any) => {
    if (!ing) return 0;
    const numId = Number(ing.id);
    const storeItem = recipeStoreBalancesMap.get(numId);
    return storeItem ? storeItem.expectedStock : 0;
  };

  const [activeRecipeSearchIdx, setActiveRecipeSearchIdx] = useState<number | null>(null);

  // Close recipe ingredient suggestions popover when clicking anywhere outside or pressing Escape
  useEffect(() => {
    if (activeRecipeSearchIdx === null) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const activeCombobox = document.querySelector(`[data-recipe-combobox="${activeRecipeSearchIdx}"]`);
      if (activeCombobox && activeCombobox.contains(target)) {
        return;
      }
      setActiveRecipeSearchIdx(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveRecipeSearchIdx(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeRecipeSearchIdx]);
  const [recipeItems, setRecipeItems] = useState<
    Array<{
      ingredientId: string;
      customName?: string;
      quantity: string;
      unit: string;
    }>
  >([]);
  const [recipeDescription, setRecipeDescription] = useState('');
  const [recipeUpdateCost, setRecipeUpdateCost] = useState(true);
  const [recipeSubmitting, setRecipeSubmitting] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const recipeTableContainerRef = React.useRef<HTMLDivElement>(null);
  const [highlightRowIdx, setHighlightRowIdx] = useState<number | null>(null);

  const openRecipeEditor = (product: ProductItem) => {
    setRecipeModalProduct(null);
    setEditRecipeProduct(product);
    const targetStoreId = (selectedStore && selectedStore !== 'ALL' ? Number(selectedStore) : null) || product.storeId || product.store?.id || (staffStores[0]?.id || null);
    setRecipeStoreId(targetStoreId);
    setRecipeDescription(product.recipe?.description || '');
    setRecipeUpdateCost(true);
    setRecipeError(null);
    setActiveRecipeSearchIdx(null);

    if (product.recipe && product.recipe.items && product.recipe.items.length > 0) {
      setRecipeItems(
        product.recipe.items.map((it) => ({
          ingredientId: it.ingredient.id.toString(),
          customName: it.ingredient.name,
          quantity: it.quantity.toString(),
          unit: it.unit || it.ingredient.unit || '',
        }))
      );
    } else {
      setRecipeItems([
        {
          ingredientId: '',
          customName: '',
          quantity: '',
          unit: '',
        },
      ]);
    }
  };

  const addRecipeRow = () => {
    const newIdx = recipeItems.length;
    setRecipeItems((prev) => [
      ...prev,
      {
        ingredientId: '',
        customName: '',
        quantity: '',
        unit: '',
      },
    ]);
    setHighlightRowIdx(newIdx);

    // เลื่อนหน้าจอไปยังรายการใหม่ที่เพิ่งเพิ่ม (ไม่เปิดกล่องค้นหา ให้ผู้ใช้กดเอง)
    setTimeout(() => {
      const rowEl = document.getElementById('product-recipe-row-' + newIdx);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const updateRecipeRow = (
    index: number,
    field: 'ingredientId' | 'customName' | 'quantity' | 'unit',
    value: string
  ) => {
    setRecipeItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'ingredientId') {
        const found = allIngredients.find((ing: any) => ing.id.toString() === value);
        if (found) {
          copy[index].customName = found.name;
          copy[index].unit = found.unit;
        } else {
          copy[index].unit = '';
        }
      }
      return copy;
    });
  };

  const mergeRowWithEarlier = (fromIdx: number, toIdx: number) => {
    setRecipeItems((prev) => {
      const copy = [...prev];
      const addedQty = Number(copy[fromIdx]?.quantity || 0);
      const oldQty = Number(copy[toIdx]?.quantity || 0);
      copy[toIdx] = {
        ...copy[toIdx],
        quantity: Number((oldQty + addedQty).toFixed(4)).toString(),
      };
      copy.splice(fromIdx, 1);
      return copy;
    });
    setHighlightRowIdx(toIdx);
    setTimeout(() => setHighlightRowIdx(null), 2000);
  };

  const removeRecipeRow = (index: number) => {
    if (recipeItems.length <= 1) {
      setRecipeItems([{ ingredientId: '', customName: '', quantity: '', unit: '' }]);
      return;
    }
    setRecipeItems((prev) => prev.filter((_, i) => i !== index));
    if (activeRecipeSearchIdx === index) {
      setActiveRecipeSearchIdx(null);
    }
  };

  const previewBOMCost = useMemo(() => {
    return recipeItems.reduce((sum, item) => {
      if (!item.quantity) return sum;
      let ing = item.ingredientId ? allIngredients.find((i: any) => i.id.toString() === item.ingredientId) : null;
      if (!ing && item.customName) {
        ing = allIngredients.find((i: any) => i.name.trim().toLowerCase() === item.customName!.trim().toLowerCase());
      }
      const cost = Number(ing?.costPerUnit || 0);
      const qty = Number(item.quantity || 0);
      return sum + qty * cost;
    }, 0);
  }, [recipeItems, allIngredients]);

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecipeProduct) return;
    setRecipeError(null);

    // ตรวจสอบข้อมูลวัตถุดิบ (ทั้งที่มีรหัสในระบบ หรือที่พิมพ์ชื่อเอง)
    const filledItems = recipeItems.filter(
      (it) => (it.ingredientId && it.ingredientId.trim() !== '') || (it.customName && it.customName.trim() !== '')
    );

    if (filledItems.length === 0) {
      setRecipeError('กรุณาเลือกหรือพิมพ์ชื่อวัตถุดิบ และระบุปริมาณอย่างน้อย 1 รายการ');
      return;
    }

    const invalidQtyItem = filledItems.find(
      (it) => !it.quantity || isNaN(Number(it.quantity)) || Number(it.quantity) <= 0
    );
    if (invalidQtyItem) {
      setRecipeError('กรุณาระบุปริมาณที่ใช้ให้ถูกต้อง (มากกว่า 0)');
      return;
    }

    setRecipeSubmitting(true);

    try {
      const isEditing = Boolean(editRecipeProduct.recipe?.id);
      const url = isEditing ? `/api/recipes/${editRecipeProduct.recipe!.id}` : '/api/recipes';
      const method = isEditing ? 'PUT' : 'POST';

      // รวมยอดวัตถุดิบที่ซ้ำกัน (ของเก่า + ที่เพิ่มใหม่)
      const combinedMap = new Map<string, { ingredientId?: number; name?: string; quantity: number; unit: string }>();
      for (const it of filledItems) {
        const key = it.ingredientId ? `id:${it.ingredientId}` : `name:${it.customName?.trim().toLowerCase()}`;
        const qty = Number(it.quantity);
        if (combinedMap.has(key)) {
          const prev = combinedMap.get(key)!;
          prev.quantity = Number((prev.quantity + qty).toFixed(4));
        } else {
          combinedMap.set(key, {
            ingredientId: it.ingredientId ? Number(it.ingredientId) : undefined,
            name: it.customName ? it.customName.trim() : undefined,
            quantity: qty,
            unit: it.unit || 'กรัม',
          });
        }
      }

      const payload = {
        productId: editRecipeProduct.id,
        description: recipeDescription,
        updateProductCost: recipeUpdateCost,
        items: Array.from(combinedMap.values()),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'บันทึกสูตรการผลิตไม่สำเร็จ');
      }

      await mutate();
      globalMutate('/api/recipes');
      globalMutate('/api/ingredients');
      setEditRecipeProduct(null);
      setHighlightId(editRecipeProduct.id);
      setTimeout(() => setHighlightId(null), 2500);

      await showSuccessAlert(
        isEditing ? 'อัปเดตสูตรสำเร็จ' : 'บันทึกสูตรสำเร็จ',
        `สูตรการผลิตของสินค้า "${editRecipeProduct.name}" ถูกบันทึกเรียบร้อยแล้ว`
      );
    } catch (err: any) {
      setRecipeError(err.message || 'เกิดข้อผิดพลาดในการบันทึกสูตร');
    } finally {
      setRecipeSubmitting(false);
    }
  };

  // Form Fields
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    unit: '',
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

  // Distinct suggestions for Autocomplete / Combobox
  const existingProductNames = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.name?.trim()) set.add(p.name.trim());
    });
    return Array.from(set);
  }, [products]);

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    ['เครื่องดื่มเย็น', 'เครื่องดื่มร้อน', 'เบเกอรี่', 'ของหวาน', 'ของทานเล่น', 'อาหารจานเดียว', 'สินค้าทั่วไป'].forEach(
      (c) => set.add(c)
    );
    return Array.from(set);
  }, [products]);

  const existingUnits = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.unit?.trim()) set.add(p.unit.trim());
    });
    ['แก้ว', 'ขวด', 'ชิ้น', 'กล่อง', 'ถุง', 'จาน', 'ชุด', 'กิโลกรัม', 'กรัม', 'ลิตร', 'มิลลิลิตร', 'กระป๋อง', 'ซอง', 'แพ็ค'].forEach(
      (u) => set.add(u)
    );
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
        String(p.storeId) === String(selectedStore) ||
        !p.storeId; // เมนูส่วนกลาง ให้แสดงในทุกร้านค้าด้วย

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
      category: '',
      unit: '',
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
      category: p.category || '',
      unit: p.unit || '',
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

    const isEditing = Boolean(editingProduct);
    const trimmedName = formData.name.trim();
    const trimmedCode = formData.code.trim().toUpperCase();
    const targetStoreId = formData.storeId ? String(formData.storeId) : '';

    // Check duplicate code
    const duplicateCode = products.find(
      (p) => p.code.toUpperCase() === trimmedCode && (!isEditing || p.id !== editingProduct!.id)
    );
    if (duplicateCode) {
      setFormError(`รหัสสินค้า "${trimmedCode}" มีอยู่ในระบบแล้ว (${duplicateCode.name}) กรุณาใช้รหัสอื่น`);
      return;
    }

    // Check duplicate name
    const duplicateName = products.find(
      (p) =>
        p.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (!isEditing || p.id !== editingProduct!.id) &&
        (!targetStoreId || !p.storeId || String(p.storeId) === targetStoreId)
    );
    if (duplicateName) {
      setFormError(`ชื่อสินค้า "${trimmedName}" มีอยู่ในระบบแล้ว (รหัส: ${duplicateName.code}) ไม่สามารถเพิ่มซ้ำได้`);
      return;
    }

    setSubmitting(true);

    try {
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
      } else {
        setProducts((prev) => [returnedProduct, ...prev]);
      }

      // Close modal immediately and highlight updated row
      setModalOpen(false);
      setHighlightId(returnedProduct.id);
      setTimeout(() => setHighlightId(null), 2500);

      await showSuccessAlert(
        isEditing ? 'อัปเดตสินค้าสำเร็จ' : 'เพิ่มสินค้าสำเร็จ',
        isEditing
          ? `อัปเดตข้อมูลสินค้า "${returnedProduct.name}" เรียบร้อยแล้ว`
          : `เพิ่มสินค้าใหม่ "${returnedProduct.name}" เข้าสู่ระบบเรียบร้อยแล้ว`
      );
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
        <div className="flex">
          <div className="w-fit max-w-full inline-flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto border border-slate-200">
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
              const count = products.filter((p) => p.storeId === st.id || !p.storeId).length;
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
              <option value="ALL">ร้านค้าทั้งหมด ({staffStores.length + 1})</option>
              <option value="CENTRAL">ส่วนกลาง (ทุกร้านค้า)</option>
              {staffStores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
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
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-900 font-bold text-xs">
                    <th className="py-3.5 px-3 text-center w-12 text-slate-900 font-bold">#</th>
                    <th className="py-3.5 px-4 text-center font-bold">รูปภาพ</th>
                    <th className="py-3.5 px-4 font-bold">รหัสสินค้า</th>
                    <th className="py-3.5 px-4 font-bold">ชื่อสินค้า</th>
                    <th className="py-3.5 px-4 font-bold">ร้านค้า</th>
                    <th className="py-3.5 px-4 font-bold">หมวดหมู่</th>
                    <th className="py-3.5 px-4 font-bold">หน่วยนับ</th>
                    <th className="py-3.5 px-4 text-right font-bold">ราคาขาย</th>
                    <th className="py-3.5 px-4 text-right font-bold">ต้นทุนสินค้า</th>
                    <th className="py-3.5 px-4 text-center font-bold">สูตรการผลิต (BOM)</th>
                    <th className="py-3.5 px-4 text-center font-bold">สถานะ</th>
                    <th className="py-3.5 px-4 text-center font-bold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-600">
                  {paginatedProducts.map((p, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
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

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors duration-500 ${
                          isHighlighted
                            ? 'bg-emerald-50 ring-2 ring-emerald-500/50'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Sequence Row Number */}
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                          {rowNumber}
                        </td>

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

                        {/* Code */}
                        <td className="py-3 px-4 font-mono text-slate-600 text-xs">
                          {p.code}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="text-slate-700 text-xs sm:text-sm font-normal">{p.name}</div>
                        </td>

                        {/* Store Badge */}
                        <td className="py-3 px-4">
                          {p.store ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <Store className="w-3 h-3 text-emerald-600" />
                              <span>{p.store.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal bg-slate-100 text-slate-600 border border-slate-200">
                              <Warehouse className="w-3 h-3 text-slate-400" />
                              <span>ส่วนกลาง</span>
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-normal bg-slate-100 text-slate-600">
                            {p.category}
                          </span>
                        </td>

                        {/* Unit */}
                        <td className="py-3 px-4 text-slate-600 font-normal">
                          {p.unit}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right text-slate-700 text-xs sm:text-sm font-normal tabular-nums">
                          ฿{Number(p.price).toFixed(2)}
                        </td>

                        {/* Cost Display: Shows exact edited cost, with BOM reference if available */}
                        <td className="py-3 px-4 text-right font-mono">
                          {displayCost !== null ? (
                            <div>
                              <div className="text-slate-700 text-xs sm:text-sm font-normal tabular-nums">
                                ฿{displayCost.toFixed(2)}
                              </div>
                              {hasRecipe && bomCost !== null && p.cost !== null && p.cost !== undefined && (
                                <div className="text-[10px] text-slate-400 font-normal">
                                  BOM: ฿{bomCost.toFixed(2)}
                                </div>
                              )}
                              {!p.cost && bomCost !== null && (
                                <div className="text-[10px] text-emerald-600 font-normal">
                                  (คำนวณจากสูตร)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Recipe BOM Badge & Button */}
                        <td className="py-3 px-4 text-center">
                          {hasRecipe ? (
                            <button
                              onClick={() => setRecipeModalProduct(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="คลิกเพื่อดูรายการวัตถุดิบและแก้ไขสูตร"
                            >
                              <ChefHat className="w-3.5 h-3.5" />
                              <span>{p.recipe!.items.length} วัตถุดิบ</span>
                              <Eye className="w-3 h-3 text-emerald-500" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openRecipeEditor(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-normal bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>เพิ่มสูตร</span>
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-normal ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {p.status === 'ACTIVE' ? 'เปิดขาย' : 'ระงับการขาย'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
                  </h3>
                  <p className="text-[11px] text-slate-400">กรอกข้อมูลและบันทึก เพื่อแสดงผลในตารางทันที</p>
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
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Column: Image Upload & Store */}
                <div className="md:col-span-5 space-y-3">
                  {/* Image Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>รูปภาพสินค้า / เมนู</span>
                      </span>
                      {formData.image && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: '' })}
                          className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                        >
                          ลบรูปภาพ
                        </button>
                      )}
                    </label>

                    {formData.image ? (
                      <div className="relative group w-full h-36 rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-slate-50 flex items-center justify-center">
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
                        className={`w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all text-center cursor-pointer ${
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
                          <div className="flex flex-col items-center gap-1.5 py-2">
                            <div className="w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[11px] font-bold text-emerald-700">กำลังอัปโหลด...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 p-2">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                              <Upload className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800">อัปโหลดรูปภาพ</span>
                              <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP (สูงสุด 5MB)</p>
                            </div>
                          </div>
                        )}
                      </label>
                    )}
                  </div>

                  {/* Store Owner */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ร้านค้าเจ้าของเมนู
                    </label>
                    <select
                      value={formData.storeId}
                      onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white font-medium"
                    >
                      <option value="">ส่วนกลาง (ทุกร้าน)</option>
                      {staffStores.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right Column: Fields */}
                <div className="md:col-span-7 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
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
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>

                    {/* Unit */}
                    <AutocompleteSuggest
                      label="หน่วยนับ"
                      required
                      value={formData.unit}
                      onChange={(val) => setFormData({ ...formData, unit: val })}
                      suggestions={existingUnits}
                      placeholder="เช่น แก้ว, ชิ้น, ขวด"
                    />
                  </div>

                  {/* Name */}
                  <AutocompleteSuggest
                    label="ชื่อสินค้า"
                    required
                    value={formData.name}
                    onChange={(val) => setFormData({ ...formData, name: val })}
                    suggestions={existingProductNames}
                    placeholder="เช่น น้ำไมโลเย็น 22oz"
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Category */}
                    <AutocompleteSuggest
                      label="หมวดหมู่สินค้า"
                      direction="up"
                      value={formData.category}
                      onChange={(val) => setFormData({ ...formData, category: val })}
                      suggestions={existingCategories}
                      placeholder="เช่น เครื่องดื่มเย็น"
                    />

                    {/* Status */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        สถานะการจำหน่าย
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
                      >
                        <option value="ACTIVE">เปิดจำหน่าย</option>
                        <option value="INACTIVE">ระงับการขาย</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
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
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="เช่น 35.00"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            ⚡ จาก BOM
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        placeholder="เช่น 12.00"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3.5 border-t border-slate-100 mt-4 flex items-center justify-end gap-2.5">
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
                {recipeModalProduct.recipe?.items?.map((item, idx) => {
                  const targetStoreId = (selectedStore && selectedStore !== 'ALL' ? Number(selectedStore) : null) || recipeModalProduct.storeId || recipeModalProduct.store?.id || (staffStores[0]?.id || null);
                  const storeList = (targetStoreId && ingredientsData?.storeBalances?.[targetStoreId]) || [];
                  const storeItem = storeList.find((b: any) => b.ingredientId === item.ingredient.id);
                  const inStoreStock = storeItem ? Number(storeItem.expectedStock) : 0;
                  const storeObj = staffStores.find((s) => s.id === targetStoreId);

                  return (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-800">{item.ingredient.name}</div>
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            คงเหลือ: {inStoreStock.toLocaleString()} {item.unit || item.ingredient.unit}
                          </div>
                        </div>
                      </div>
                      <div className="font-black text-slate-700">
                        {item.quantity} <span className="font-normal text-slate-500">{item.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => openRecipeEditor(recipeModalProduct)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>แก้ไขสูตรสินค้านี้</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
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

      {/* Inline Recipe Editor Modal (No page jump!) */}
      {editRecipeProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="bg-white rounded-3xl max-w-3xl lg:max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editRecipeProduct.recipe?.id ? `แก้ไขสูตร: ${editRecipeProduct.name}` : `กำหนดสูตรสินค้าใหม่: ${editRecipeProduct.name}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    ระบุวัตถุดิบและปริมาณที่ต้องตัดสต็อกต่อการขาย 1 {editRecipeProduct.unit || 'แก้ว'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditRecipeProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {recipeError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{recipeError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveRecipe} className="mt-5 space-y-4">
              {/* Product Info Card */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {editRecipeProduct.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      รหัส: {editRecipeProduct.code} {editRecipeProduct.category ? `• หมวดหมู่: ${editRecipeProduct.category}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Store Badge / Selector */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-semibold text-emerald-800 shadow-2xs">
                    <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-slate-500 font-normal">ร้านค้า:</span>
                    {staffStores.length > 1 ? (
                      <select
                        value={recipeStoreId || ''}
                        onChange={(e) => setRecipeStoreId(Number(e.target.value))}
                        className="bg-transparent font-bold text-emerald-900 border-none outline-none cursor-pointer pr-1"
                      >
                        {staffStores.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} (@{st.username})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-emerald-900">
                        {currentRecipeStore?.name || 'หน้าร้าน'}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">ราคาขาย</div>
                    <div className="font-bold text-emerald-700 font-mono text-sm">
                      ฿{Number(editRecipeProduct.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  คำอธิบายสูตร (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={recipeDescription}
                  onChange={(e) => setRecipeDescription(e.target.value)}
                  placeholder="เช่น สูตรมาตรฐาน หวานปกติ"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Ingredients Section Container */}
              <div className="space-y-3 pt-1">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span>วัตถุดิบและปริมาณต่อ 1 {editRecipeProduct.unit || 'แก้ว'}</span>
                        <span className="text-red-500 font-bold">*</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        ระบุวัตถุดิบและปริมาณที่จะตัดสต็อกอัตโนมัติเมื่อขายสินค้านี้
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addRecipeRow}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มวัตถุดิบ</span>
                  </button>
                </div>

                {/* Table Column Headers (Desktop) */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-bold text-slate-500 bg-slate-100 rounded-xl shrink-0">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-6">วัตถุดิบ (เลือกวัตถุดิบ)</div>
                  <div className="col-span-2 text-right">ปริมาณที่ใช้ (ต่อ 1 {editRecipeProduct.unit || 'แก้ว'})</div>
                  <div className="col-span-2 text-right">ต้นทุน BOM (฿)</div>
                  <div className="col-span-1 text-center">ลบ</div>
                </div>

                {/* Items Container (Card List) */}
                <div
                  ref={recipeTableContainerRef}
                  className="space-y-2.5 overflow-visible"
                >
                  {recipeItems.map((item, idx) => {
                    const selectedIng = allIngredients.find(
                      (i: any) => (item.ingredientId && i.id.toString() === item.ingredientId) ||
                                  (item.customName && i.name.trim().toLowerCase() === item.customName.trim().toLowerCase())
                    );
                    const displayName = typeof item.customName === 'string'
                      ? item.customName
                      : (selectedIng ? selectedIng.name : '');
                    const itemCost = Number(item.quantity || 0) * Number(selectedIng?.costPerUnit || 0);

                    // ตรวจสอบว่าวัตถุดิบนี้ซ้ำกับรายการก่อนหน้าในตารางหรือไม่
                    const currentKey = item.ingredientId ? `id:${item.ingredientId}` : (item.customName ? `name:${item.customName.trim().toLowerCase()}` : '');
                    const earlierIdx = recipeItems.findIndex(
                      (other, otherIdx) => {
                        if (otherIdx >= idx || !currentKey) return false;
                        const otherKey = other.ingredientId ? `id:${other.ingredientId}` : (other.customName ? `name:${other.customName.trim().toLowerCase()}` : '');
                        return otherKey === currentKey;
                      }
                    );
                    const isDuplicateOfEarlier = earlierIdx !== -1 && Boolean(currentKey);
                    const earlierItem = isDuplicateOfEarlier ? recipeItems[earlierIdx] : null;
                    const earlierQty = earlierItem ? Number(earlierItem.quantity || 0) : 0;
                    const currentQty = Number(item.quantity || 0);
                    const combinedQty = Number((earlierQty + currentQty).toFixed(4));
                    const inStoreStock = selectedIng ? getRecipeIngredientStock(selectedIng) : 0;

                    return (
                      <div
                        key={idx}
                        id={'product-recipe-row-' + idx}
                        className={`p-3 rounded-2xl bg-white border transition-all text-xs shadow-2xs space-y-2.5 relative ${
                          activeRecipeSearchIdx === idx ? 'z-50 ring-2 ring-emerald-500/30' : 'z-0'
                        } ${
                          highlightRowIdx === idx
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                            : isDuplicateOfEarlier
                            ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2.5 sm:items-center">
                          {/* Number Index */}
                          <div className="hidden sm:flex col-span-1 justify-center">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                          </div>

                          {/* Searchable & Writeable Combobox */}
                          <div className="col-span-6 relative" data-recipe-combobox={idx}>
                            <label className="block sm:hidden text-[10px] font-bold text-slate-500 mb-1">
                              วัตถุดิบ #{idx + 1}
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                value={displayName}
                                title={displayName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const exactMatch = allIngredients.find(
                                    (ing: any) =>
                                      ing.name.trim().toLowerCase() === val.trim().toLowerCase() ||
                                      ing.code.trim().toLowerCase() === val.trim().toLowerCase()
                                  );
                                  if (exactMatch) {
                                    setRecipeItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = {
                                        ...copy[idx],
                                        ingredientId: String(exactMatch.id),
                                        customName: exactMatch.name,
                                        unit: exactMatch.unit || copy[idx].unit || 'กรัม',
                                      };
                                      return copy;
                                    });
                                  } else {
                                    setRecipeItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = {
                                        ...copy[idx],
                                        ingredientId: '',
                                        customName: val,
                                        unit: copy[idx].unit || 'กรัม',
                                      };
                                      return copy;
                                    });
                                  }
                                  setActiveRecipeSearchIdx(idx);
                                }}
                                onFocus={() => setActiveRecipeSearchIdx(idx)}
                                placeholder="พิมพ์ชื่อวัตถุดิบ หรือคลิกเลือกจากระบบ..."
                                className={`w-full pl-8 pr-14 py-2 text-xs rounded-xl border font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 ${
                                  isDuplicateOfEarlier
                                    ? 'border-amber-400 bg-amber-50/30 focus:ring-amber-500/30'
                                    : 'border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-600'
                                }`}
                              />

                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {item.customName && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRecipeItems((prev) => {
                                        const copy = [...prev];
                                        copy[idx] = { ...copy[idx], ingredientId: '', customName: '', unit: '', quantity: '' };
                                        return copy;
                                      });
                                    }}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                    title="ล้างข้อมูล"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActiveRecipeSearchIdx(activeRecipeSearchIdx === idx ? null : idx)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  title="แสดงรายการวัตถุดิบในระบบ"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Status Indicator: Only show tag when creating new custom ingredient */}
                            {!selectedIng && item.customName && item.customName.trim() ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                  <Sparkles className="w-3 h-3 text-blue-600" />
                                  <span>วัตถุดิบใหม่: &ldquo;{item.customName.trim()}&rdquo;</span>
                                </span>
                                <select
                                  value={item.unit || 'กรัม'}
                                  onChange={(e) => updateRecipeRow(idx, 'unit', e.target.value)}
                                  className="text-[10px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
                                >
                                  {PRESET_UNITS.map((u) => (
                                    <option key={u} value={u}>หน่วย: {u}</option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {/* Dropdown Suggestions Popover */}
                            {activeRecipeSearchIdx === idx && (() => {
                              const q = (item.customName || '').trim().toLowerCase();
                              const filtered = allIngredients.filter(
                                (ing: any) =>
                                  !q ||
                                  ing.name.toLowerCase().includes(q) ||
                                  ing.code.toLowerCase().includes(q) ||
                                  (ing.category && ing.category.toLowerCase().includes(q))
                              );
                              const isExactExisting = allIngredients.some(
                                (ing: any) => ing.name.trim().toLowerCase() === q
                              );

                              return (
                                <div className="absolute top-full left-0 w-[420px] sm:w-[500px] max-w-[90vw] mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[99] max-h-64 sm:max-h-72 overflow-y-auto divide-y divide-slate-100 ring-4 ring-black/5">
                                  {/* Option to use custom name */}
                                  {q && !isExactExisting && (
                                    <div
                                      onClick={() => {
                                        setRecipeItems((prev) => {
                                          const copy = [...prev];
                                          copy[idx] = {
                                            ...copy[idx],
                                            ingredientId: '',
                                            customName: item.customName!.trim(),
                                            unit: copy[idx].unit || 'กรัม',
                                          };
                                          return copy;
                                        });
                                        setActiveRecipeSearchIdx(null);
                                      }}
                                      className="p-2.5 bg-emerald-50/90 hover:bg-emerald-100 transition-colors flex items-center justify-between gap-2 cursor-pointer border-b border-emerald-200"
                                    >
                                      <div>
                                        <div className="font-bold text-xs text-emerald-900 flex items-center gap-1">
                                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>ใช้ชื่อนี้:</span>
                                          <span className="underline decoration-emerald-500 font-black">"{item.customName}"</span>
                                        </div>
                                        <div className="text-[10px] text-emerald-700 mt-0.5">
                                          จะบันทึกเป็นวัตถุดิบใหม่เข้าระบบอัตโนมัติเมื่อกดบันทึกสูตร
                                        </div>
                                      </div>
                                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-1 rounded-lg shrink-0">
                                        + ใช้ชื่อนี้
                                      </span>
                                    </div>
                                  )}

                                  {/* Header */}
                                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                                    <span>วัตถุดิบในระบบ ({filtered.length})</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveRecipeSearchIdx(null)}
                                      className="text-slate-400 hover:text-slate-600 font-bold"
                                    >
                                      ปิด ✕
                                    </button>
                                  </div>

                                  {/* List */}
                                  {filtered.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-slate-400">
                                      ไม่พบวัตถุดิบในระบบที่ตรงกับ &ldquo;{item.customName}&rdquo;
                                      <div className="text-[11px] text-emerald-700 font-bold mt-1">
                                        คลิก "+ ใช้ชื่อนี้" ด้านบนเพื่อเพิ่มวัตถุดิบใหม่เข้าระบบ
                                      </div>
                                    </div>
                                  ) : (
                                    filtered.map((ing: any) => {
                                      const stock = getRecipeIngredientStock(ing);
                                      const isSelected = item.ingredientId === ing.id.toString();
                                      const existingInOtherRow = recipeItems.find(
                                        (r, rIdx) => rIdx !== idx && r.ingredientId === ing.id.toString()
                                      );

                                      return (
                                        <div
                                          key={ing.id}
                                          onClick={() => {
                                            updateRecipeRow(idx, 'ingredientId', ing.id.toString());
                                            setActiveRecipeSearchIdx(null);
                                          }}
                                          className={`p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                            isSelected ? 'bg-emerald-50/70' : ''
                                          }`}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="font-bold text-xs sm:text-sm text-slate-900 break-words whitespace-normal leading-snug">
                                              {ing.name}
                                              {isSelected && (
                                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full ml-2">
                                                  ✓ เลือกอยู่
                                                </span>
                                              )}
                                              {existingInOtherRow && (
                                                <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold shrink-0 ml-1.5">
                                                  มีในสูตรแล้ว
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                                              {ing.category && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium border border-emerald-200/60 text-[10px]">
                                                  {ing.category}
                                                </span>
                                              )}
                                              <span className="text-slate-500 text-[10px]">
                                                ต้นทุน ฿{Number(ing.costPerUnit || 0).toFixed(2)} / {ing.unit}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0 pt-0.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                              ในร้าน: {stock.toLocaleString()} {ing.unit}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Quantity with Unit */}
                          <div className="col-span-2">
                            <label className="block sm:hidden text-[10px] font-bold text-slate-500 mb-1">
                              ปริมาณที่ใช้ (ต่อ 1 {editRecipeProduct.unit || 'แก้ว'})
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                required
                                placeholder="0"
                                value={item.quantity}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => updateRecipeRow(idx, 'quantity', e.target.value)}
                                className={`w-full px-3 py-2 pr-14 text-xs text-right font-mono font-bold rounded-xl border bg-white focus:outline-none focus:ring-2 text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  isDuplicateOfEarlier
                                    ? 'border-amber-400 bg-amber-50/30 focus:ring-amber-500/30'
                                    : 'border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-600'
                                }`}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none truncate max-w-[45px]">
                                {item.unit || selectedIng?.unit || '-'}
                              </span>
                            </div>
                          </div>

                          {/* Line Cost */}
                          <div className="col-span-2 text-right">
                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                              <span className="sm:hidden text-[10px] text-slate-400">ต้นทุน:</span>
                              <div className="font-mono text-xs font-bold text-emerald-700">
                                ฿{itemCost.toFixed(2)}
                              </div>
                            </div>
                            <div className="hidden sm:block text-[10px] text-slate-400">
                              ต่อ 1 {editRecipeProduct.unit || 'แก้ว'}
                            </div>
                          </div>

                          {/* Remove button */}
                          <div className="col-span-1 text-center flex sm:justify-center justify-end">
                            <button
                              type="button"
                              onClick={() => removeRecipeRow(idx)}
                              disabled={recipeItems.length <= 1}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 transition-colors cursor-pointer"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </div>

                        {/* Card Bottom Strip: Stock info & Duplicate helper strip */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 -mx-3 -mb-3 px-3 py-1.5 rounded-b-2xl text-[11px]">
                          {selectedIng ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                              <span>หมวด: <span className="font-semibold text-slate-600">{selectedIng.category || 'ทั่วไป'}</span></span>
                              <span>•</span>
                              <span>คงเหลือในสต็อก:</span>
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {inStoreStock.toLocaleString()} {selectedIng.unit}
                              </span>
                              <span>•</span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                ต้นทุนเฉลี่ย: ฿{Number(selectedIng.costPerUnit || 0).toFixed(2)}/{selectedIng.unit}
                              </span>
                            </div>
                          ) : item.customName && item.customName.trim() ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                (กำหนดใหม่ - บันทึกเป็นวัตถุดิบใหม่อัตโนมัติเมื่อกดบันทึก)
                              </span>
                            </div>
                          ) : (
                            <div className="text-slate-400 italic">
                              กรุณาเลือกหรือพิมพ์ชื่อวัตถุดิบและระบุปริมาณที่ใช้
                            </div>
                          )}

                          {isDuplicateOfEarlier && (
                            <div className="w-full mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                              <div className="flex items-start sm:items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                                <div>
                                  <span className="font-semibold text-amber-800">
                                    ซ้ำกับรายการ #{earlierIdx + 1} (ของเก่ามี {earlierQty} {item.unit || selectedIng?.unit})
                                  </span>
                                  {currentQty > 0 ? (
                                    <span className="block sm:inline sm:ml-1 text-emerald-800 font-bold">
                                      → ยอดรวมจะเป็น {combinedQty.toLocaleString()} {item.unit || selectedIng?.unit} (ของเก่า {earlierQty} + เพิ่มใหม่ {currentQty})
                                    </span>
                                  ) : (
                                    <span className="block sm:inline sm:ml-1 text-slate-500">
                                      (กรอกจำนวนที่เพิ่มใหม่ ระบบจะรวมยอดให้)
                                    </span>
                                  )}
                                </div>
                              </div>
                              {currentQty > 0 && (
                                <button
                                  type="button"
                                  onClick={() => mergeRowWithEarlier(idx, earlierIdx)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-[10px] shrink-0 transition-all cursor-pointer shadow-xs"
                                  title="รวมยอดเข้ากับรายการเดิมทันที"
                                >
                                  รวมยอดทันที
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total BOM Calculation Summary inside Card */}
                <div className="p-3 rounded-xl bg-emerald-100/70 border border-emerald-300/80 flex items-center justify-between text-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold">
                      ต้นทุนวัตถุดิบ BOM รวม ({recipeItems.length} รายการ):
                    </span>
                  </div>
                  <div className="text-base font-black font-mono text-emerald-800">
                    ฿{previewBOMCost.toFixed(2)} / {editRecipeProduct.unit || 'แก้ว'}
                  </div>
                </div>
              </div>

              {/* Checkbox: Auto-update Product Cost */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recipeUpdateCost}
                  onChange={(e) => setRecipeUpdateCost(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>อัปเดตต้นทุนสินค้า (Cost) ในหน้านี้ให้ตรงกับต้นทุน BOM นี้อัตโนมัติ</span>
              </label>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditRecipeProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={recipeSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {recipeSubmitting ? 'กำลังบันทึก...' : 'บันทึกสูตรการผลิต'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useAuth } from '@/context/auth-context';
import { confirmDeleteAlert, showSuccessAlert, showErrorAlert } from '@/lib/sweetalert';
import Pagination from '@/components/Pagination';
import {
  ChefHat,
  Search,
  Plus,
  Edit2,
  Trash2,
  Coffee,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  X,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Calculator,
  DollarSign,
  PackageCheck,
  Check,
  Sparkles,
  ChevronDown,
  Info,
} from 'lucide-react';

interface RecipeItemDetail {
  id: number;
  ingredientId: number;
  quantity: number;
  unit: string;
  ingredient: {
    id: number;
    code: string;
    name: string;
    unit: string;
    currentStock: number;
    costPerUnit: number;
    category?: string;
  };
}

interface RecipeData {
  id: number;
  productId: number;
  description: string | null;
  product: {
    id: number;
    code: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    cost: number | null;
  };
  items: RecipeItemDetail[];
  totalBOMCost: number;
  margin: number;
  marginPercent: number;
  maxCupsAvailable: number;
  limitingIngredient: {
    name: string;
    code: string;
    currentStock: number;
    qtyPerCup: number;
    unit: string;
  } | null;
}

function RecipesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramProductId = searchParams.get('productId');
  const paramAction = searchParams.get('action');
  const returnUrl = searchParams.get('returnUrl');
  const autoOpenedRef = useRef(false);

  const handleCloseModal = () => {
    setModalOpen(false);
    if (paramProductId || returnUrl) {
      router.push(returnUrl || '/admin/products');
    }
  };

  const { user: currentUser, isAdmin } = useAuth();
  const { mutate: globalMutate } = useSWRConfig();
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // Instant SWR Cache: Shows cached recipes immediately upon clicking
  const swrUrl = selectedStoreId ? `/api/recipes?storeId=${selectedStoreId}` : '/api/recipes';
  const { data: swrData, isLoading, isValidating, mutate } = useSWR(swrUrl);

  const staffStores: any[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.staffStores) ? swrData.staffStores : [];
  }, [swrData]);

  useEffect(() => {
    if (staffStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(String(staffStores[0].id));
    }
  }, [staffStores, selectedStoreId]);

  useEffect(() => {
    if (swrData?.success && Array.isArray(swrData.recipes)) {
      setRecipes(swrData.recipes);
    }
  }, [swrData]);

  const productsWithoutRecipe: any[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.productsWithoutRecipe) ? swrData.productsWithoutRecipe : [];
  }, [swrData]);
  const allProductsList: any[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.allProducts) ? swrData.allProducts : [];
  }, [swrData]);
  const allIngredients: any[] = useMemo(() => {
    return swrData?.success && Array.isArray(swrData.ingredients) ? swrData.ingredients : [];
  }, [swrData]);

  const initialLoading = isLoading && recipes.length === 0;
  const refreshing = isValidating;
  const [search, setSearch] = useState('');

  // Highlight updated or newly added recipe
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [updateProductCost, setUpdateProductCost] = useState(true);
  const [recipeFormItems, setRecipeFormItems] = useState<
    Array<{ ingredientId: string; customName?: string; quantity: string; unit: string }>
  >([
    { ingredientId: '', customName: '', quantity: '', unit: '' },
  ]);

  // Derived selected product info for header/card
  const currentSelectedProduct = useMemo(() => {
    if (editingRecipe) return editingRecipe.product;
    if (!selectedProductId) return null;
    const foundInWithout = productsWithoutRecipe.find((p) => p.id?.toString() === selectedProductId);
    if (foundInWithout) return foundInWithout;
    const foundInAll = allProductsList.find((p) => p.id?.toString() === selectedProductId);
    if (foundInAll) return foundInAll;
    const foundInRecipes = recipes.find((r) => r.productId?.toString() === selectedProductId);
    if (foundInRecipes) return foundInRecipes.product;
    return null;
  }, [editingRecipe, selectedProductId, productsWithoutRecipe, allProductsList, recipes]);

  const currentActiveStoreId = useMemo(() => {
    return Number(selectedStoreId || currentSelectedProduct?.storeId || staffStores[0]?.id || 0);
  }, [selectedStoreId, currentSelectedProduct, staffStores]);

  const activeStoreName = useMemo(() => {
    if (!currentActiveStoreId) return null;
    return staffStores.find((s) => s.id === currentActiveStoreId)?.name || currentSelectedProduct?.store?.name || null;
  }, [currentActiveStoreId, staffStores, currentSelectedProduct]);

  const storeBalancesMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!currentActiveStoreId || !swrData?.storeBalances) return map;
    const list = swrData.storeBalances[currentActiveStoreId] || [];
    list.forEach((b: any) => map.set(Number(b.ingredientId), Number(b.expectedStock || 0)));
    return map;
  }, [currentActiveStoreId, swrData]);

  const getEffectiveStock = (ing: any) => {
    if (!ing) return 0;
    const numId = Number(ing.id);
    return storeBalancesMap.get(numId) ?? 0;
  };


  // Recipe Modal Scrolling, Highlighting & Active Combobox Index
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [highlightRowIdx, setHighlightRowIdx] = useState<number | null>(null);
  const [activeRecipeSearchIdx, setActiveRecipeSearchIdx] = useState<number | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');

  const updateSearchDirection = (idx: number, el?: HTMLElement | null) => {
    const target = el || (typeof document !== 'undefined' ? document.getElementById('recipe-ing-input-' + idx) : null);
    if (target) {
      const rect = target.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If space below is less than 300px and space above is greater, open upwards (Drop-up)
      if (spaceBelow < 300 && rect.top > spaceBelow) {
        setDropdownDirection('up');
      } else {
        setDropdownDirection('down');
      }
    } else {
      setDropdownDirection(idx > 0 ? 'up' : 'down');
    }
  };

  const openSearchForIdx = (idx: number, el?: HTMLElement | null) => {
    updateSearchDirection(idx, el);
    setActiveRecipeSearchIdx(idx);
  };

  // Simulation Tool Modal
  const [simRecipe, setSimRecipe] = useState<RecipeData | null>(null);
  const [simCups, setSimCups] = useState<number>(10);

  // Prevent background page scroll when modal is open (removes double scrollbars)
  useEffect(() => {
    if (modalOpen || simRecipe) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [modalOpen, simRecipe]);

  // Auto scroll row into view when search dropdown opens
  useEffect(() => {
    if (activeRecipeSearchIdx !== null) {
      updateSearchDirection(activeRecipeSearchIdx);
      const el = document.getElementById('recipe-ing-input-' + activeRecipeSearchIdx);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeRecipeSearchIdx]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadRecipes = async (_isBackground = false) => {
    await mutate();
  };

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => {
      const matchProduct =
        r.product.name.toLowerCase().includes(q) ||
        r.product.code.toLowerCase().includes(q);
      const matchIngredient = r.items.some((it) =>
        it.ingredient.name.toLowerCase().includes(q)
      );
      return matchProduct || matchIngredient;
    });
  }, [recipes, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Paginated recipes (10 items per page)
  const paginatedRecipes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecipes.slice(start, start + pageSize);
  }, [filteredRecipes, currentPage, pageSize]);

  // Open Add Modal
  const openAddModal = (defaultProdId?: number) => {
    setEditingRecipe(null);
    setSelectedProductId(defaultProdId ? defaultProdId.toString() : '');
    setDescription('');
    setUpdateProductCost(true);
    setRecipeFormItems([
      { ingredientId: '', customName: '', quantity: '', unit: '' },
    ]);
    setFormError(null);
    setHighlightRowIdx(null);
    setActiveRecipeSearchIdx(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (r: RecipeData) => {
    setEditingRecipe(r);
    setSelectedProductId(r.productId.toString());
    setDescription(r.description || '');
    setUpdateProductCost(true);
    setRecipeFormItems(
      r.items && r.items.length > 0
        ? r.items.map((it) => ({
            ingredientId: it.ingredientId.toString(),
            customName: it.ingredient.name,
            quantity: it.quantity.toString(),
            unit: it.unit || it.ingredient.unit || '',
          }))
        : [{ ingredientId: '', customName: '', quantity: '', unit: '' }]
    );
    setFormError(null);
    setHighlightRowIdx(null);
    setActiveRecipeSearchIdx(null);
    setModalOpen(true);
  };

  // Auto-open modal if productId query parameter is present (e.g. from admin/products)
  useEffect(() => {
    if (!paramProductId || autoOpenedRef.current || !swrData?.success) return;
    const prodIdNum = Number(paramProductId);
    if (!prodIdNum) return;

    const existing = swrData.recipes?.find((r: RecipeData) => r.productId === prodIdNum);
    if (existing && paramAction !== 'new') {
      openEditModal(existing);
      autoOpenedRef.current = true;
    } else {
      openAddModal(prodIdNum);
      autoOpenedRef.current = true;
    }
  }, [swrData, paramProductId, paramAction]);

  // Dynamic Item row controls
  const addIngredientRow = () => {
    const newIdx = recipeFormItems.length;
    setRecipeFormItems((prev) => [
      ...prev,
      { ingredientId: '', customName: '', quantity: '', unit: '' },
    ]);
    setHighlightRowIdx(newIdx);

    // เลื่อนหน้าจอลงมาแสดงแถววัตถุดิบล่าสุดทันที
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: tableContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 100);

    setTimeout(() => {
      setHighlightRowIdx(null);
    }, 2000);
  };

  const removeIngredientRow = (index: number) => {
    if (recipeFormItems.length <= 1) {
      setRecipeFormItems([{ ingredientId: '', customName: '', quantity: '', unit: '' }]);
      return;
    }
    setRecipeFormItems((prev) => prev.filter((_, i) => i !== index));
    if (activeRecipeSearchIdx === index) {
      setActiveRecipeSearchIdx(null);
    }
  };

  const updateIngredientRow = (
    index: number,
    field: 'ingredientId' | 'customName' | 'quantity' | 'unit',
    value: string
  ) => {
    const updated = [...recipeFormItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill unit & customName if ingredientId changed
    if (field === 'ingredientId') {
      const selectedIng = allIngredients.find((ing) => ing.id.toString() === value);
      if (selectedIng) {
        updated[index].customName = selectedIng.name;
        updated[index].unit = selectedIng.unit;
      } else {
        updated[index].unit = '';
      }
    }
    setRecipeFormItems(updated);
  };

  // Live modal BOM cost preview
  const previewModalCost = useMemo(() => {
    return recipeFormItems.reduce((sum, item) => {
      let ing = item.ingredientId ? allIngredients.find((i) => i.id.toString() === item.ingredientId) : null;
      if (!ing && item.customName) {
        ing = allIngredients.find((i) => i.name.trim().toLowerCase() === item.customName!.trim().toLowerCase());
      }
      const costPerUnit = Number(ing?.costPerUnit || 0);
      const qty = Number(item.quantity || 0);
      return sum + qty * costPerUnit;
    }, 0);
  }, [recipeFormItems, allIngredients]);

  // Submit Recipe (Instant in-memory update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const isEditing = Boolean(editingRecipe);
      const url = isEditing ? `/api/recipes/${editingRecipe!.id}` : '/api/recipes';
      const method = isEditing ? 'PUT' : 'POST';

      // ตรวจสอบว่าวัตถุดิบทุกแถวต้องเป็นวัตถุดิบที่มีอยู่ในระบบเท่านั้น (ห้ามสร้างใหม่หน้านี้เด็ดขาด)
      const invalidRow = recipeFormItems.find(
        (it) => (it.customName || it.quantity) && (!it.ingredientId || !allIngredients.some((ing: any) => ing.id.toString() === it.ingredientId))
      );
      if (invalidRow) {
        const errorMsg = invalidRow.customName
          ? `วัตถุดิบ "${invalidRow.customName}" ไม่มีในระบบ ไม่สามารถบันทึกได้! กรุณาเลือกวัตถุดิบที่มีในระบบเท่านั้น`
          : 'กรุณาเลือกวัตถุดิบจากระบบให้ครบถ้วน';
        setFormError(errorMsg);
        await showErrorAlert('ไม่สามารถบันทึกได้', errorMsg);
        setSubmitting(false);
        return;
      }

      const filledItems = recipeFormItems.filter(
        (it) => it.ingredientId && Number(it.quantity) > 0
      );
      if (filledItems.length === 0) {
        throw new Error('กรุณาระบุวัตถุดิบและปริมาณที่ใช้อย่างน้อย 1 รายการ');
      }

      const payload = {
        productId: Number(selectedProductId),
        description,
        updateProductCost,
        items: filledItems.map((it) => ({
          ingredientId: it.ingredientId ? Number(it.ingredientId) : undefined,
          name: it.customName ? it.customName.trim() : undefined,
          customName: it.customName ? it.customName.trim() : undefined,
          quantity: Number(it.quantity),
          unit: it.unit || 'กรัม',
        })),
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

      // Re-fetch in background to refresh relationships & calculations
      await loadRecipes(true);
      globalMutate('/api/products');
      globalMutate('/api/ingredients');

      setModalOpen(false);
      setHighlightId(json.recipe.id);
      setTimeout(() => setHighlightId(null), 2500);

      await showSuccessAlert(
        isEditing ? 'อัปเดตสูตรสำเร็จ' : 'บันทึกสูตรสำเร็จ',
        isEditing ? 'อัปเดตสูตรการผลิตเรียบร้อยแล้ว' : 'สร้างสูตรการผลิตใหม่เรียบร้อยแล้ว'
      );

      if (paramProductId || returnUrl) {
        router.push(returnUrl || '/admin/products');
      }
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Recipe
  const handleDelete = async (id: number, prodName: string) => {
    const isConfirmed = await confirmDeleteAlert({
      itemName: `สูตร ${prodName}`,
    });
    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        await showErrorAlert('ไม่สามารถลบสูตรได้', json.message);
        return;
      }

      setRecipes((prev) => prev.filter((r) => r.id !== id));
      await showSuccessAlert('ลบข้อมูลสำเร็จ', `ลบสูตรสินค้า "${prodName}" เรียบร้อยแล้ว`);
      loadRecipes(true);
      globalMutate('/api/products');
      globalMutate('/api/ingredients');
    } catch (err: any) {
      await showErrorAlert('เกิดข้อผิดพลาดในการลบ', err.message);
    }
  };

  return (
    <div className="space-y-6">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 hidden sm:block">
            กำหนดสัดส่วนวัตถุดิบและคำนวณต้นทุนมาตรฐาน (BOM) ต่อหน่วยสินค้า
          </p>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={() => loadRecipes(true)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => openAddModal()}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ กำหนดสูตรสินค้าใหม่</span>
              </button>
            )}
          </div>
        </div>

        {/* Products Without Recipe Banner (If any) */}
        {productsWithoutRecipe.length > 0 && (
          <div className="p-4 rounded-3xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <span className="font-bold">มีสินค้า {productsWithoutRecipe.length} รายการ ที่ยังไม่ได้กำหนดสูตรวัตถุดิบ:</span>{' '}
                <span className="text-amber-800">
                  {productsWithoutRecipe.map((p) => p.name).join(', ')}
                </span>
              </div>
            </div>
            <button
              onClick={() => openAddModal(productsWithoutRecipe[0]?.id)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs self-start sm:self-auto cursor-pointer shadow-xs"
            >
              + เพิ่มสูตรให้ {productsWithoutRecipe[0]?.name}
            </button>
          </div>
        )}

        {/* Search & Store Filter Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาสูตรตามชื่อสินค้า, รหัสสินค้า, หรือชื่อวัตถุดิบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Store Dropdown Filter */}
            {staffStores.length > 0 && (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-emerald-50/70 text-emerald-950 font-bold focus:outline-none cursor-pointer"
              >
                {staffStores.map((st) => (
                  <option key={st.id} value={st.id}>
                    ร้าน: {st.name}
                  </option>
                ))}
              </select>
            )}

            <div className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              ทั้งหมด {filteredRecipes.length} สูตร
            </div>
          </div>
        </div>

        {/* Recipes Grid */}
        {initialLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 bg-white rounded-3xl border border-slate-200">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดสูตรการผลิต (BOM)...</span>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200 flex flex-col items-center gap-2">
            <ChefHat className="w-12 h-12 text-slate-300" />
            <span className="font-medium">ไม่พบสูตรการผลิตสินค้าที่ตรงกับการค้นหา</span>
            <button
              onClick={() => openAddModal()}
              className="mt-2 text-emerald-600 font-bold underline cursor-pointer"
            >
              + กำหนดสูตรสินค้าใหม่ตัวแรก
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="columns-1 xl:columns-2 gap-6 [column-fill:balance]">
              {paginatedRecipes.map((recipe) => {
              const isHighlighted = highlightId === recipe.id;

              return (
                <div
                  key={recipe.id}
                  className={`w-full break-inside-avoid mb-6 bg-white rounded-3xl border shadow-2xs overflow-hidden flex flex-col transition-all duration-300 ${
                    isHighlighted
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Card Header (Option 3: Clean Standard Recipe Sheet) */}
                  <div className="p-5 sm:p-5.5 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            {recipe.product.code}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600">
                            {recipe.product.category}
                          </span>
                          {activeStoreName && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ร้าน: {activeStoreName}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mt-1 flex items-center gap-2">
                          <span>{recipe.product.name}</span>
                        </h3>
                        {recipe.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{recipe.description}</p>
                        )}
                      </div>

                      {/* Selling Price */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">ราคาขาย</span>
                        <div className="text-xl font-black text-emerald-700">
                          ฿{Number(recipe.product.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients Table (Option 3: Standard Recipe Table with BOM Summary Footer) */}
                  <div className="p-5 sm:p-5.5">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>วัตถุดิบในสูตรต่อ 1 {recipe.product.unit} ({recipe.items.length} รายการ):</span>
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
                      {recipe.items.map((item, idx) => {
                        const itemCost = Number(item.quantity) * Number(item.ingredient.costPerUnit || 0);

                        return (
                          <div
                            key={item.id}
                            className={`p-3 flex items-center justify-between transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-slate-800">{item.ingredient.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  รหัส: {item.ingredient.code}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-bold text-slate-800 text-xs">
                                {Number(item.quantity).toLocaleString()} {item.unit}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ฿{itemCost.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Standard Recipe Table Footer: Total BOM Cost */}
                      <div className="p-3.5 bg-emerald-50/70 border-t-2 border-emerald-500/20 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          <span className="font-bold text-emerald-950">
                            รวมต้นทุนวัตถุดิบ BOM (ต่อ 1 {recipe.product.unit}):
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-emerald-800 font-mono">
                            ฿{recipe.totalBOMCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 sm:px-5.5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      สูตรมาตรฐาน (Master Recipe)
                    </span>

                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(recipe)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          title="แก้ไขสูตร BOM"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>แก้ไขสูตร</span>
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id, recipe.product.name)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title="ลบสูตรนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                        ดูสูตรเท่านั้น
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            {/* Pagination (10 items per page) */}
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredRecipes.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}

      {/* Add / Edit Recipe Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl lg:max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {editingRecipe ? `แก้ไขสูตร: ${editingRecipe.product.name}` : 'กำหนดสูตรสินค้าใหม่ (BOM)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    ระบุวัตถุดิบและปริมาณที่ต้องตัดสต็อกต่อการขาย 1 {currentSelectedProduct?.unit || 'แก้ว'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="ปิดหน้าต่างและกลับไปหน้าสินค้า"
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
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เลือกสินค้าที่ต้องการผูกสูตร <span className="text-red-500">*</span>
                </label>
                {paramProductId && currentSelectedProduct ? (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {currentSelectedProduct.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          รหัส: {currentSelectedProduct.code} {currentSelectedProduct.category ? `• หมวดหมู่: ${currentSelectedProduct.category}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">ราคาขาย</div>
                      <div className="font-bold text-emerald-700 font-mono text-sm">
                        ฿{Number(currentSelectedProduct.price || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : editingRecipe ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span>{editingRecipe.product.name} ({editingRecipe.product.code})</span>
                    <span className="text-emerald-700">฿{Number(editingRecipe.product.price).toFixed(2)}</span>
                  </div>
                ) : (
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white font-medium"
                  >
                    <option value="">-- กรุณาเลือกสินค้า --</option>
                    {productsWithoutRecipe.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) - ฿{Number(p.price).toFixed(2)}
                      </option>
                    ))}
                    {selectedProductId && !productsWithoutRecipe.some((p) => p.id?.toString() === selectedProductId) && (
                      <option value={selectedProductId}>
                        สินค้าที่เลือก (#{selectedProductId})
                      </option>
                    )}
                  </select>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  คำอธิบายสูตร (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น สูตรมาตรฐานแก้ว 22oz หวานปกติ"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Ingredients Section */}
              <div className="space-y-3 pt-2">
                {/* Header */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <span>วัตถุดิบและปริมาณต่อ 1 {currentSelectedProduct?.unit || 'แก้ว'}</span>
                        <span className="text-red-500 font-bold">*</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        ระบุวัตถุดิบและปริมาณที่จะตัดสต็อกอัตโนมัติเมื่อขายสินค้านี้
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addIngredientRow}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มวัตถุดิบ</span>
                  </button>
                </div>

                {/* Ingredients Table */}
                <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-visible relative">
                  {/* Backdrop for closing search dropdown */}
                  {activeRecipeSearchIdx !== null && (
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setActiveRecipeSearchIdx(null)}
                    />
                  )}
                  <div className="overflow-visible min-h-[160px]">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100/95 text-slate-700 font-bold text-[11px] border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                          <th className="py-2.5 px-3">เลือกวัตถุดิบ (คงเหลือ)</th>
                          <th className="py-2.5 px-3 w-28 text-center">ปริมาณที่ใช้</th>
                          <th className="py-2.5 px-3 w-28 text-center">หน่วยนับ</th>
                          <th className="py-2.5 px-3 w-24 text-right">ต้นทุน</th>
                          <th className="py-2.5 px-3 w-12 text-center">ลบ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recipeFormItems.map((item, idx) => {
                          const selectedIng = allIngredients.find(
                            (i: any) =>
                              (item.ingredientId && i.id.toString() === item.ingredientId) ||
                              (item.customName && i.name.trim().toLowerCase() === item.customName.trim().toLowerCase())
                          );
                          const displayName = typeof item.customName === 'string'
                            ? item.customName
                            : (selectedIng ? selectedIng.name : '');
                          const itemCost = Number(item.quantity || 0) * Number(selectedIng?.costPerUnit || 0);

                          return (
                            <tr
                              key={idx}
                              className={`transition-all duration-200 ${
                                activeRecipeSearchIdx === idx ? 'relative z-40 bg-emerald-50/40' : 'relative z-0'
                              } ${
                                highlightRowIdx === idx
                                  ? 'bg-emerald-50 ring-2 ring-emerald-500/30 font-bold'
                                  : 'hover:bg-slate-50/70'
                              }`}
                            >
                              {/* Row Number */}
                              <td className="py-3 px-3 text-center font-bold text-slate-400 align-top pt-3.5">
                                {idx + 1}
                              </td>

                              {/* Searchable & Writeable Combobox */}
                              <td className="py-2.5 px-3 align-top relative min-w-[280px]">
                                <div className="relative flex items-center">
                                  <input
                                    id={'recipe-ing-input-' + idx}
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
                                        setRecipeFormItems((prev) => {
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
                                        setRecipeFormItems((prev) => {
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
                                      openSearchForIdx(idx, e.currentTarget);
                                    }}
                                    onFocus={(e) => openSearchForIdx(idx, e.currentTarget)}
                                    placeholder="พิมพ์ชื่อวัตถุดิบเพื่อค้นหาในระบบ..."
                                    className="w-full pl-8 pr-14 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                  />

                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {(item.customName || item.ingredientId) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRecipeFormItems((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = { ...copy[idx], ingredientId: '', customName: '', unit: '', quantity: '' };
                                            return copy;
                                          });
                                          openSearchForIdx(idx);
                                        }}
                                        className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                                        title="ล้างข้อมูลเพื่อเลือกใหม่"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        if (activeRecipeSearchIdx === idx) {
                                          setActiveRecipeSearchIdx(null);
                                        } else {
                                          openSearchForIdx(idx, e.currentTarget);
                                        }
                                      }}
                                      className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                                      title="แสดงรายการวัตถุดิบในระบบ"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Dropdown Suggestions Popover (Attached to input with Smart Up/Down Direction) */}
                                  {activeRecipeSearchIdx === idx && (() => {
                                    const hasExactIdMatch = Boolean(item.ingredientId && selectedIng && item.customName === selectedIng.name);
                                    const searchKeyword = hasExactIdMatch ? '' : (item.customName || '').trim().toLowerCase();

                                    const filtered = allIngredients.filter(
                                      (ing: any) =>
                                        !searchKeyword ||
                                        ing.name.toLowerCase().includes(searchKeyword) ||
                                        ing.code.toLowerCase().includes(searchKeyword) ||
                                        (ing.category && ing.category.toLowerCase().includes(searchKeyword))
                                    );
                                    const isExactExisting = allIngredients.some(
                                      (ing: any) => ing.name.trim().toLowerCase() === searchKeyword
                                    );

                                    return (
                                      <div
                                        className={'absolute ' +
                                          (dropdownDirection === 'up'
                                            ? 'bottom-full mb-1.5 origin-bottom'
                                            : 'top-full mt-1.5 origin-top') +
                                          ' left-0 w-[460px] sm:w-[540px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-4 ring-black/5'}
                                      >
                                        {/* Header */}
                                        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600 flex items-center justify-between shrink-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-slate-700">รายการวัตถุดิบในระบบ</span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                                              {filtered.length} รายการ
                                            </span>
                                            {searchKeyword && (
                                              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]">
                                                (ค้นหา: "{searchKeyword}")
                                              </span>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setActiveRecipeSearchIdx(null)}
                                            className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded cursor-pointer text-[11px]"
                                          >
                                            ✕ ปิด
                                          </button>
                                        </div>

                                        {/* Scrollable list of ingredients (Comfortable compact height) */}
                                        <div className="max-h-48 sm:max-h-52 overflow-y-auto divide-y divide-slate-100 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full">
                                          {filtered.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                                              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 shadow-2xs">
                                                <AlertCircle className="w-5 h-5" />
                                              </div>
                                              <div className="font-bold text-slate-800 text-sm">
                                                ไม่มีชื่อวัตถุดิบนี้ในระบบ
                                              </div>
                                              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                                                ไม่พบวัตถุดิบ &ldquo;<strong className="text-slate-700">{item.customName || searchKeyword}</strong>&rdquo; ในระบบ (ไม่สามารถเพิ่มวัตถุดิบใหม่จากหน้านี้ได้)
                                              </p>
                                            </div>
                                          ) : (
                                            filtered.map((ing: any) => {
                                              const inStoreStock = getEffectiveStock(ing);
                                              const isSelected = item.ingredientId === ing.id.toString();
                                              return (
                                                <div
                                                  key={ing.id}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    updateIngredientRow(idx, 'ingredientId', ing.id.toString());
                                                    setActiveRecipeSearchIdx(null);
                                                  }}
                                                  className={'p-2.5 sm:p-3 hover:bg-emerald-50/80 transition-colors flex items-start justify-between gap-3 cursor-pointer ' +
                                                    (isSelected ? 'bg-emerald-50/90 border-l-4 border-emerald-600' : '')}
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    {/* Full Name */}
                                                    <div className="font-bold text-xs sm:text-sm text-slate-900 break-words whitespace-normal leading-snug">
                                                      {ing.name}
                                                    </div>

                                                    {/* Code, Category & Cost Badges */}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                                                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                                        {ing.code}
                                                      </span>
                                                      {ing.category && (
                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium border border-emerald-200/60 text-[10px]">
                                                          {ing.category}
                                                        </span>
                                                      )}
                                                      <span className="text-slate-500 text-[10px]">
                                                        ต้นทุน ฿{Number(ing.costPerUnit || 0).toFixed(2)} / {ing.unit}
                                                      </span>
                                                      {isSelected && (
                                                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full ml-auto">
                                                          ✓ เลือกอยู่
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Current Stock */}
                                                  <div className="text-right shrink-0 pt-0.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                      คงเหลือ: {inStoreStock.toLocaleString()} {ing.unit}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Status Indicator with FULL NAME */}
                                {selectedIng ? (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs break-words max-w-full">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                      <span className="leading-snug">ในระบบ: <strong className="text-emerald-950 font-black">{selectedIng.name}</strong> ({selectedIng.code})</span>
                                    </span>
                                  </div>
                                ) : item.customName && item.customName.trim() ? (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs">
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                      <span>ไม่มีชื่อวัตถุดิบนี้ในระบบ (กรุณาเลือกวัตถุดิบที่มีในระบบ)</span>
                                    </span>
                                  </div>
                                ) : null}
                              </td>

                              {/* Quantity */}
                              <td className="py-2.5 px-3 w-28 align-middle">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0.001"
                                  required
                                  placeholder="0"
                                  value={item.quantity}
                                  onChange={(e) => updateIngredientRow(idx, 'quantity', e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                              </td>

                              {/* Unit */}
                              <td className="py-2.5 px-3 w-24 text-center align-middle">
                                <span className="font-semibold text-slate-700 text-xs">
                                  {item.unit || selectedIng?.unit || '-'}
                                </span>
                              </td>

                              {/* Cost */}
                              <td className="py-2.5 px-3 w-24 text-right align-middle">
                                <span className="font-mono text-xs font-bold text-emerald-700">
                                  ฿{itemCost.toFixed(2)}
                                </span>
                              </td>

                              {/* Delete button */}
                              <td className="py-2.5 px-3 w-12 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => removeIngredientRow(idx)}
                                  disabled={recipeFormItems.length <= 1}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 transition-colors cursor-pointer"
                                  title="ลบรายการนี้"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total BOM Calculation Summary */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold">
                      ต้นทุนวัตถุดิบ BOM รวม ({recipeFormItems.length} รายการ):
                    </span>
                  </div>
                  <div className="text-base font-black font-mono text-emerald-800">
                    ฿{previewModalCost.toFixed(2)} / {currentSelectedProduct?.unit || 'แก้ว'}
                  </div>
                </div>
              </div>

              {/* Checkbox: Auto-update Product Cost */}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateProductCost}
                  onChange={(e) => setUpdateProductCost(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>อัปเดตต้นทุนสินค้า (Cost) ในหน้าจัดการสินค้าให้ตรงกับต้นทุน BOM นี้อัตโนมัติ</span>
              </label>

              {/* Submit Buttons */}
              {(() => {
                const hasInvalidIngredient = recipeFormItems.some(
                  (it) => it.customName && (!it.ingredientId || !allIngredients.some((ing: any) => ing.id.toString() === it.ingredientId))
                );

                return (
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                    {hasInvalidIngredient ? (
                      <span className="text-xs text-rose-600 font-bold flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>มีวัตถุดิบที่ไม่มีในระบบ กรุณาเลือกวัตถุดิบในระบบก่อนบันทึก</span>
                      </span>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2.5 ml-auto">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || hasInvalidIngredient}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={hasInvalidIngredient ? 'มีวัตถุดิบที่ไม่มีในระบบ ไม่สามารถบันทึกได้' : undefined}
                      >
                        {submitting ? 'กำลังบันทึก...' : 'บันทึกสูตรการผลิต'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Stock Cut Simulation Modal */}
      {simRecipe && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    จำลองการคำนวณตัดสต็อกตามสูตร (Simulation)
                  </h3>
                  <p className="text-xs text-slate-500">
                    เมนู: <strong className="text-emerald-700">{simRecipe.product.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSimRecipe(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Cup count input */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    สมมุติว่าขายสินค้าจำนวน:
                  </label>
                  <p className="text-[11px] text-slate-400">ระบบจะคูณสัดส่วนวัตถุดิบและเช็คสต็อก</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={simCups}
                    onChange={(e) => setSimCups(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-3 py-1.5 text-sm font-black font-mono text-center rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <span className="text-xs font-bold text-slate-700">{simRecipe.product.unit}</span>
                </div>
              </div>

              {/* Calculated Ingredients Deduction List */}
              <div>
                <div className="text-xs font-bold text-slate-700 mb-2">
                  ปริมาณวัตถุดิบที่ต้องใช้รวมสำหรับ {simCups} {simRecipe.product.unit}:
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                  {simRecipe.items.map((item) => {
                    const requiredQty = Number(item.quantity) * simCups;
                    const recStoreList = (currentActiveStoreId && swrData?.storeBalances?.[currentActiveStoreId]) || [];
                    const recStoreItem = recStoreList.find((b: any) => b.ingredientId === item.ingredient.id);
                    const stock = recStoreItem ? Number(recStoreItem.expectedStock) : 0;
                    const isEnough = stock >= requiredQty;
                    const diff = stock - requiredQty;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 flex items-center justify-between ${
                          !isEnough ? 'bg-red-50/70' : 'bg-white'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-800">{item.ingredient.name}</div>
                          <div className="text-[11px] text-slate-500">
                            (ใช้ {Number(item.quantity)} {item.unit} × {simCups} {simRecipe.product.unit})
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black text-slate-800 text-sm">
                            ตัดสต็อก {requiredQty.toLocaleString()} {item.unit}
                          </div>
                          <div
                            className={`text-[11px] font-semibold ${
                              isEnough ? 'text-emerald-600' : 'text-red-600 font-bold'
                            }`}
                          >
                            {isEnough
                              ? `สต็อกพอ (เหลือ ~${diff.toLocaleString()} ${item.unit})`
                              : `สต็อกไม่พอ! ขาดอีก ${Math.abs(diff).toLocaleString()} ${item.unit}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total simulated sales */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 font-bold">
                <span>ยอดขายรวมที่ได้รับ:</span>
                <span className="text-sm font-black font-mono text-emerald-800">
                  ฿{(Number(simRecipe.product.price) * simCups).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-end">
              <button
                onClick={() => setSimRecipe(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
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

export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">กำลังเตรียมระบบจัดการสูตร BOM...</p>
        </div>
      }
    >
      <RecipesContent />
    </Suspense>
  );
}

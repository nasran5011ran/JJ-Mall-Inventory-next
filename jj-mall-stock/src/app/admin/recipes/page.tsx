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
    Array<{ ingredientId: string; quantity: string; unit: string }>
  >([
    { ingredientId: '', quantity: '1', unit: 'กรัม' },
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

  // Simulation Tool Modal
  const [simRecipe, setSimRecipe] = useState<RecipeData | null>(null);
  const [simCups, setSimCups] = useState<number>(10);

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
    setSelectedProductId(defaultProdId ? defaultProdId.toString() : (productsWithoutRecipe[0]?.id?.toString() || ''));
    setDescription('');
    setUpdateProductCost(true);
    setRecipeFormItems([
      { ingredientId: allIngredients[0]?.id?.toString() || '', quantity: '1', unit: allIngredients[0]?.unit || 'กรัม' },
    ]);
    setFormError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (r: RecipeData) => {
    setEditingRecipe(r);
    setSelectedProductId(r.productId.toString());
    setDescription(r.description || '');
    setUpdateProductCost(true);
    setRecipeFormItems(
      r.items.map((it) => ({
        ingredientId: it.ingredientId.toString(),
        quantity: it.quantity.toString(),
        unit: it.unit,
      }))
    );
    setFormError(null);
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
    setRecipeFormItems([
      ...recipeFormItems,
      { ingredientId: allIngredients[0]?.id?.toString() || '', quantity: '1', unit: allIngredients[0]?.unit || 'กรัม' },
    ]);
  };

  const removeIngredientRow = (index: number) => {
    if (recipeFormItems.length <= 1) return;
    setRecipeFormItems(recipeFormItems.filter((_, i) => i !== index));
  };

  const updateIngredientRow = (index: number, field: string, value: string) => {
    const updated = [...recipeFormItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill unit if ingredientId changed
    if (field === 'ingredientId') {
      const selectedIng = allIngredients.find((ing) => ing.id.toString() === value);
      if (selectedIng) {
        updated[index].unit = selectedIng.unit;
      }
    }
    setRecipeFormItems(updated);
  };

  // Live modal BOM cost preview
  const previewModalCost = useMemo(() => {
    return recipeFormItems.reduce((sum, item) => {
      const ing = allIngredients.find((i) => i.id.toString() === item.ingredientId);
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

      const payload = {
        productId: Number(selectedProductId),
        description,
        updateProductCost,
        items: recipeFormItems.map((it) => ({
          ingredientId: Number(it.ingredientId),
          quantity: Number(it.quantity),
          unit: it.unit,
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
            กำหนดสัดส่วนวัตถุดิบต่อ 1 แก้ว คำนวณต้นทุน และตรวจสอบความพร้อมผลิตจากสต็อก
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
              const isReady = recipe.maxCupsAvailable > 0;

              return (
                <div
                  key={recipe.id}
                  className={`w-full break-inside-avoid mb-6 bg-white rounded-3xl border shadow-2xs overflow-hidden flex flex-col transition-all duration-300 ${
                    isHighlighted
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Card Header */}
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
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">ราคาขาย</span>
                        <div className="text-xl font-black text-emerald-700">
                          ฿{Number(recipe.product.price).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Financial & Stock Readiness Bar */}
                    <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-slate-200/60 text-xs">
                      {/* BOM Cost */}
                      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">ต้นทุนวัตถุดิบ BOM</div>
                        <div className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                          ฿{recipe.totalBOMCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">ต่อ 1 {recipe.product.unit}</div>
                      </div>

                      {/* Profit Margin */}
                      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/80">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase">กำไรขั้นต้น (Margin)</div>
                        <div className="text-sm font-black text-emerald-700 mt-0.5">
                          ~฿{recipe.margin.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-600">
                          {recipe.marginPercent}% กำไร
                        </div>
                      </div>

                      {/* Stock Readiness */}
                      <div className={`p-2.5 rounded-2xl border ${
                        recipe.maxCupsAvailable === 0
                          ? 'bg-red-50/80 border-red-200 text-red-900'
                          : recipe.maxCupsAvailable <= 20
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      }`}>
                        <div className="text-[10px] font-bold uppercase">ความพร้อมผลิตสต็อก</div>
                        <div className="text-sm font-black mt-0.5">
                          {recipe.maxCupsAvailable.toLocaleString()} {recipe.product.unit}
                        </div>
                        <div className="text-[10px] truncate" title={recipe.limitingIngredient ? `คอขวด: ${recipe.limitingIngredient.name}` : ''}>
                          {recipe.limitingIngredient
                            ? `คอขวด: ${recipe.limitingIngredient.name}`
                            : 'วัตถุดิบพร้อม'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients Table */}
                  <div className="p-5 sm:p-5.5">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>วัตถุดิบที่ต้องตัดสต็อกต่อ 1 {recipe.product.unit} ({recipe.items.length} รายการ):</span>
                      {activeStoreName && (
                        <span className="text-[11px] font-semibold text-emerald-700">ร้าน: {activeStoreName}</span>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden text-xs">
                      {recipe.items.map((item, idx) => {
                        const itemCost = Number(item.quantity) * Number(item.ingredient.costPerUnit || 0);
                        const recStoreId = Number(selectedStoreId || currentActiveStoreId || staffStores[0]?.id || 0);
                        const recStoreList = (recStoreId && swrData?.storeBalances?.[recStoreId]) || [];
                        const recStoreItem = recStoreList.find((b: any) => b.ingredientId === item.ingredient.id);
                        const inStoreStock = recStoreItem ? Number(recStoreItem.expectedStock) : 0;
                        const isShortage = inStoreStock < Number(item.quantity);
                        const storeObj = staffStores.find((s: any) => s.id === recStoreId);

                        return (
                          <div
                            key={item.id}
                            className={`p-3 flex items-center justify-between transition-colors ${
                              isShortage ? 'bg-red-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-slate-800">{item.ingredient.name}</div>
                                <div className="text-[10px] text-emerald-700 font-semibold font-mono">
                                  คงเหลือ: {inStoreStock.toLocaleString()} {item.ingredient.unit}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="font-black text-slate-800 text-xs">
                                {Number(item.quantity).toLocaleString()} {item.unit}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ฿{itemCost.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 sm:px-5.5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSimRecipe(recipe);
                        setSimCups(10);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                      <span>จำลองคำนวณตัดสต็อก</span>
                    </button>

                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(recipe)}
                          className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="แก้ไขสูตร BOM"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id, recipe.product.name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
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
          <div className="bg-white rounded-3xl max-w-3xl lg:max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
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

              {/* Ingredients Section Container */}
              <div className="rounded-2xl border-2 border-emerald-500/20 bg-slate-50/80 p-3.5 sm:p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
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
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100/90 text-slate-700 font-bold text-[11px] border-b border-slate-200 sticky top-0 z-10">
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
                          const selectedIng = allIngredients.find((i) => i.id.toString() === item.ingredientId);
                          const itemCost = Number(item.quantity || 0) * Number(selectedIng?.costPerUnit || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              {/* Row Number */}
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400 align-middle">
                                {idx + 1}
                              </td>

                              {/* Ingredient Select */}
                              <td className="py-2.5 px-3 align-middle">
                                <select
                                  required
                                  value={item.ingredientId}
                                  onChange={(e) => updateIngredientRow(idx, 'ingredientId', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800"
                                >
                                  <option value="">-- กรุณาเลือกวัตถุดิบ --</option>
                                  {allIngredients.map((ing) => {
                                    const inStoreStock = getEffectiveStock(ing);
                                    return (
                                      <option key={ing.id} value={ing.id}>
                                        {ing.name} ({ing.code}) — คงเหลือ {inStoreStock.toLocaleString()} {ing.unit}
                                      </option>
                                    );
                                  })}
                                </select>
                                {selectedIng && (() => {
                                  const inStoreStock = getEffectiveStock(selectedIng);
                                  return (
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pl-0.5">
                                      <span className="font-bold text-slate-800">{selectedIng.name}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                        คงเหลือ: {inStoreStock.toLocaleString()} {selectedIng.unit}
                                      </span>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-slate-400 font-mono text-[10px]">
                                        ต้นทุน: ฿{Number(selectedIng.costPerUnit || 0).toFixed(2)}/{selectedIng.unit}
                                      </span>
                                    </div>
                                  );
                                })()}
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

                              {/* Unit: Read-only, NO box! (หน่วยนับ แก้ไม่ได้ ไม่ต้องทำกล่อง) */}
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

                {/* Total BOM Calculation Summary inside Card */}
                <div className="p-3 rounded-xl bg-emerald-100/70 border border-emerald-300/80 flex items-center justify-between text-xs text-emerald-950">
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
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกสูตรการผลิต'}
                </button>
              </div>
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

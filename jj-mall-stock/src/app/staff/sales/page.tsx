'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { useAuth } from '@/context/auth-context';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Coffee,
  DollarSign,
  Receipt,
  Printer,
  Sparkles,
  Layers,
  ArrowRight,
  Clock,
  User,
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
} from 'lucide-react';

interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number | null;
  status: string;
  recipe?: {
    id: number;
    items: Array<{
      id: number;
      quantity: number;
      unit: string;
      ingredient: {
        id: number;
        code: string;
        name: string;
        unit: string;
        currentStock: number;
      };
    }>;
  };
}

interface CartItem {
  product: ProductItem;
  quantity: number;
}

export default function SalesPage() {
  const { user } = useAuth();

  // Instant SWR Cache for POS: Instant products catalog
  const { data: swrData, isLoading } = useSWR('/api/products');
  const products: ProductItem[] = useMemo(() => {
    if (!swrData?.success || !Array.isArray(swrData.products)) return [];
    return swrData.products.filter((p: ProductItem) => p.status === 'ACTIVE');
  }, [swrData]);

  const loading = isLoading && products.length === 0;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR' | 'CARD'>('CASH');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Receipt Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  // Distinct Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  // Cart operations
  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setErrorMessage(null);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMessage(null);
  };

  // Cart totals
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  // BOM Ingredient Requirements in cart preview
  const bomRequirements = useMemo(() => {
    const map = new Map<number, { name: string; requiredQty: number; unit: string; currentStock: number }>();
    cart.forEach((cartItem) => {
      if (cartItem.product.recipe?.items) {
        cartItem.product.recipe.items.forEach((rItem) => {
          const ing = rItem.ingredient;
          const needed = Number(rItem.quantity) * cartItem.quantity;
          const existing = map.get(ing.id) || {
            name: ing.name,
            requiredQty: 0,
            unit: rItem.unit,
            currentStock: Number(ing.currentStock),
          };
          existing.requiredQty += needed;
          map.set(ing.id, existing);
        });
      }
    });
    return Array.from(map.values());
  }, [cart]);

  // Check if any ingredient is short
  const hasShortage = bomRequirements.some((ing) => ing.currentStock < ing.requiredQty);

  // Handle Checkout Submit
  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    if (user?.role === 'ADMIN') {
      setErrorMessage('ผู้ดูแลระบบ (Admin) ไม่มีหน้าที่ขายสินค้าหน้าร้าน บัญชีเจ้าหน้าที่ขายประจำร้าน (Staff) เท่านั้นที่สามารถทำรายการขายได้');
      return;
    }
    setProcessing(true);
    setErrorMessage(null);

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethod,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'บันทึกการขายไม่สำเร็จ');
      }

      setCompletedSale({
        ...json.sale,
        deductions: json.deductions,
      });
      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการขาย');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row gap-5">
        {/* Left Column: Product Selection Grid */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Top Bar inside Left Column */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
                <ShoppingCart className="w-3 h-3" />
                จุดขายหน้าร้าน (POS)
              </div>
              <h1 className="text-xl font-black text-slate-800">
                เลือกสินค้าเพื่อขาย
              </h1>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือรหัสสินค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-slate-50"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              ทั้งหมด ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Items Grid */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">กำลังโหลดรายการสินค้า...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                ไม่พบสินค้าในหมวดหมู่นี้
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((prod) => {
                  const inCart = cart.find((it) => it.product.id === prod.id);
                  const hasRecipe = prod.recipe && prod.recipe.items?.length > 0;

                  return (
                    <button
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className={`p-3.5 rounded-2xl border text-left transition-all duration-150 flex flex-col justify-between group relative cursor-pointer ${
                        inCart
                          ? 'border-emerald-500 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Badge if in cart */}
                      {inCart && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                          {inCart.quantity}
                        </span>
                      )}

                      <div>
                        <div className="text-[10px] font-mono font-bold text-slate-400">
                          {prod.code}
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-1 leading-snug group-hover:text-emerald-700 transition-colors">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {prod.category}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black text-emerald-700">
                          ฿{Number(prod.price).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          /{prod.unit}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Cart & Checkout */}
        <div className="w-full lg:w-96 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">ตะกร้าการขาย</h2>
                <span className="text-[10px] text-slate-400 font-medium">
                  พนักงาน: <strong className="text-slate-700">{user?.name}</strong>
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ล้างตะกร้า</span>
              </button>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="m-3 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <ShoppingCart className="w-10 h-10 text-slate-300" />
                <span>ยังไม่มีสินค้าในตะกร้า</span>
                <span className="text-[11px] text-slate-400">
                  คลิกที่รายการสินค้าทางซ้ายเพื่อเริ่มขาย
                </span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-slate-800 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      ฿{Number(item.product.price).toFixed(2)} × {item.quantity} ={' '}
                      <strong className="text-emerald-700">
                        ฿{(Number(item.product.price) * item.quantity).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-black font-mono text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-red-500 cursor-pointer ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* BOM Ingredients Deduction Real-time Check */}
          {cart.length > 0 && bomRequirements.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-[11px]">
              <div className="font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>วัตถุดิบที่จะถูกตัดอัตโนมัติ:</span>
                {hasShortage ? (
                  <span className="text-red-600 font-bold">สต็อกไม่พอ!</span>
                ) : (
                  <span className="text-emerald-600 font-bold">สต็อกพร้อมตัด</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {bomRequirements.map((ing, i) => {
                  const isOk = ing.currentStock >= ing.requiredQty;
                  return (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] border ${
                        isOk
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200 font-bold'
                      }`}
                    >
                      {ing.name}: {ing.requiredQty} {ing.unit}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checkout Panel */}
          <div className="p-4 border-t border-slate-200 bg-white space-y-3">
            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-colors ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span className="text-[10px]">เงินสด</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('QR')}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-colors ${
                  paymentMethod === 'QR'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="text-[10px]">สแกน QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-colors ${
                  paymentMethod === 'CARD'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[10px]">บัตรเครดิต</span>
              </button>
            </div>

            {/* Total Display */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold text-slate-500">จำนวนรวม:</span>
              <span className="font-bold text-slate-800">{totalItems} แก้ว/ชิ้น</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-black text-slate-700">ยอดรวมทั้งสิ้น:</span>
              <span className="text-2xl font-black text-emerald-700 font-mono">
                ฿{totalAmount.toFixed(2)}
              </span>
            </div>

            {/* Confirm Sale Button */}
            <button
              onClick={handleConfirmSale}
              disabled={cart.length === 0 || processing || hasShortage}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {processing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>กำลังตัดสต็อกและบันทึกการขาย...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ยืนยันการขาย (ตัดสต็อกทันที)</span>
                </>
              )}
            </button>
          </div>
        </div>

      {/* Sale Receipt & Deduction Success Modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Success Icon */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800">
                การขายสำเร็จ!
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เลขที่บิล: <strong className="font-mono text-emerald-700">{completedSale.saleNumber}</strong>
              </p>
            </div>

            {/* Bill Summary */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>พนักงานขาย:</span>
                <span className="font-bold text-slate-800">{completedSale.createdBy?.name || user?.name}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>วิธีชำระเงิน:</span>
                <span className="font-bold text-slate-800">
                  {completedSale.paymentMethod === 'CASH'
                    ? 'เงินสด'
                    : completedSale.paymentMethod === 'QR'
                    ? 'สแกน QR Code'
                    : 'บัตรเครดิต'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>เวลา:</span>
                <span className="text-slate-700">
                  {new Date(completedSale.createdAt).toLocaleTimeString('th-TH')} น.
                </span>
              </div>

              {/* Items Sold */}
              <div className="pt-3 border-t border-slate-100">
                <div className="font-bold text-slate-700 mb-1.5">รายการสินค้าที่ขาย:</div>
                <div className="space-y-1">
                  {completedSale.items?.map((it: any) => (
                    <div key={it.id} className="flex justify-between">
                      <span>{it.product?.name} × {it.quantity}</span>
                      <span className="font-mono font-bold text-slate-800">฿{Number(it.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Total */}
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-black text-slate-800">
                <span>ยอดรวมทั้งสิ้น:</span>
                <span className="text-lg font-mono text-emerald-700">
                  ฿{Number(completedSale.totalAmount).toFixed(2)}
                </span>
              </div>

              {/* Auto Deducted Raw Materials Banner */}
              {completedSale.deductions?.length > 0 && (
                <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ตัดสต็อกวัตถุดิบอัตโนมัติตามสูตร (BOM):</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    {completedSale.deductions.map((d: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>• {d.name}</span>
                        <span className="font-mono">
                          <strong className="text-red-600">-{d.quantityOut} {d.unit}</strong>{' '}
                          (เหลือ {d.remainingStock} {d.unit})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setCompletedSale(null)}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>เปิดบิลขายใหม่</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
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
  QrCode,
  Banknote,
  RotateCcw,
  X,
  Settings,
  Camera,
  UploadCloud,
  ShieldCheck,
} from 'lucide-react';

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

// Helper: สร้าง Official EMVCo Standard Payload สำหรับพร้อมเพย์ (PromptPay)
function generatePromptPayPayload(target: string, amount: number) {
  const cleanTarget = target.replace(/[^0-9]/g, '');
  const targetType = cleanTarget.length >= 13 ? '02' : '01';
  let targetVal = cleanTarget;
  if (targetType === '01') {
    if (targetVal.startsWith('0')) targetVal = targetVal.substring(1);
    targetVal = '0066' + targetVal;
  }
  const targetTag = targetType + ('00' + targetVal.length).slice(-2) + targetVal;
  const aid = '0016A000000677010111';
  const merchantInfo = aid + targetTag;
  const merchantTag = '29' + ('00' + merchantInfo.length).slice(-2) + merchantInfo;

  let payload = '000201010212' + merchantTag + '5303764';
  if (amount && amount > 0) {
    const amtStr = Number(amount).toFixed(2);
    payload += '54' + ('00' + amtStr.length).slice(-2) + amtStr;
  }
  payload += '5802TH6304';

  // CRC16-CCITT Checksum
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');
  return payload + crcStr;
}

// Helper: ปิดบังข้อมูลส่วนตัว (Mask) เช่น 081-xxx-5678 เพื่อความเป็นส่วนตัว
function maskPromptPay(id: string) {
  if (!id) return '';
  const clean = id.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    return clean.slice(0, 3) + '-xxx-' + clean.slice(7);
  } else if (clean.length === 13) {
    return clean.slice(0, 1) + '-xxxx-xxxxx-' + clean.slice(10, 12) + '-' + clean.slice(12);
  }
  return clean.slice(0, 3) + '***' + clean.slice(-2);
}

export default function SalesPage() {
  const { user } = useAuth();

  // Instant SWR Cache for POS: Instant products catalog
  const { data: swrData, isLoading } = useSWR('/api/products');
  const products: ProductItem[] = useMemo(() => {
    if (!swrData?.success || !Array.isArray(swrData.products)) return [];
    return swrData.products
      .filter((p: ProductItem) => p.status === 'ACTIVE')
      .filter((p: ProductItem) => !p.storeId || p.storeId === user?.id);
  }, [swrData, user?.id]);

  const loading = isLoading && products.length === 0;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR'>('CASH');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 2 Confirmation Modal State (ป้องกันกดผิด 2 ชั้น)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>('');

  // PromptPay configuration for store
  const [promptPayId, setPromptPayId] = useState<string>('0812345678');
  const [isEditingPromptPay, setIsEditingPromptPay] = useState(false);
  const [promptPayInput, setPromptPayInput] = useState<string>('0812345678');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    // Load saved PromptPay ID from localStorage
    const saved = typeof window !== 'undefined' ? localStorage.getItem('jjmall_promptpay_id') : null;
    if (saved) {
      setPromptPayId(saved);
      setPromptPayInput(saved);
    }
  }, []);

  const handleSavePromptPay = () => {
    const clean = promptPayInput.trim();
    if (clean) {
      setPromptPayId(clean);
      if (typeof window !== 'undefined') {
        localStorage.setItem('jjmall_promptpay_id', clean);
      }
      setIsEditingPromptPay(false);
    }
  };

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

  // Generate QR Code directly in-memory via QRCode library
  useEffect(() => {
    const target = promptPayId || '0812345678';
    const payload = generatePromptPayPayload(target, totalAmount);
    QRCode.toDataURL(payload, {
      width: 250,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR Generate Error:', err));
  }, [promptPayId, totalAmount, paymentMethod]);

  // Step 1: Open Confirmation Modal (ชั้นที่ 1)
  const handleOpenConfirm = () => {
    if (cart.length === 0) return;
    if (user?.role === 'ADMIN') {
      setErrorMessage('ผู้ดูแลระบบ (Admin) ไม่มีหน้าที่ขายสินค้าหน้าร้าน บัญชีเจ้าหน้าที่ขายประจำร้าน (Staff) เท่านั้นที่สามารถทำรายการขายได้');
      return;
    }
    setErrorMessage(null);
    setCashReceived('');
    setShowConfirmModal(true);
  };

  // Camera & Slip Verification State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [verifyingSlip, setVerifyingSlip] = useState(false);
  const [slipVerifiedSuccess, setSlipVerifiedSuccess] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Stop camera stream safely
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start camera stream
  const startCamera = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      setErrorMessage('ไม่สามารถเข้าถึงกล้องได้: ' + (err.message || 'กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์'));
    }
  };

  // Real-time frame scanner for camera
  const tickScan = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
          // Found QR on slip!
          stopCamera();
          handleVerifySlip(code.data);
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  // Process Slip File upload or paste
  const handleImageSlipUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพสลิปเท่านั้น');
      return;
    }
    setVerifyingSlip(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            handleVerifySlip(code.data);
            return;
          }
        }
        // Fallback: Send imageBase64 directly to API
        handleVerifySlip(undefined, dataUrl);
      };
      img.onerror = () => {
        setVerifyingSlip(false);
        setErrorMessage('ไม่สามารถอ่านไฟล์รูปภาพได้');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Verify slip with Backend API and Auto-Confirm
  const handleVerifySlip = async (qrData?: string, imageBase64?: string) => {
    setVerifyingSlip(true);
    setErrorMessage(null);
    setSlipVerifiedSuccess('กำลังตรวจสอบสลิปกับระบบธนาคาร...');

    try {
      const res = await fetch('/api/sales/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData,
          imageBase64,
          expectedAmount: totalAmount,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'สลิปไม่ถูกต้อง หรือไม่ผ่านการตรวจสอบ');
      }

      const { transRef, amount, verifiedBy } = json.data;
      setSlipVerifiedSuccess(`✓ เงินเข้าบัญชีจริงเรียบร้อย (฿${Number(amount).toFixed(2)})! กำลังยืนยันการขายอัตโนมัติ...`);

      // Auto-confirm sale without cashier having to press anything!
      setTimeout(async () => {
        await handleConfirmSale(`[SLIP_VERIFIED:${transRef}|AMOUNT:${amount}|VIA:${verifiedBy}]`);
        setSlipVerifiedSuccess(null);
      }, 700);
    } catch (err: any) {
      setSlipVerifiedSuccess(null);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป');
    } finally {
      setVerifyingSlip(false);
    }
  };

  // Paste Event Listener for Ctrl + V
  useEffect(() => {
    if (!showConfirmModal || paymentMethod !== 'QR') return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleImageSlipUpload(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showConfirmModal, paymentMethod, totalAmount]);

  // Clean up camera on modal close
  useEffect(() => {
    if (!showConfirmModal) {
      stopCamera();
      setSlipVerifiedSuccess(null);
      setVerifyingSlip(false);
    }
  }, [showConfirmModal]);

  // Step 2: Handle Checkout Submit (ชั้นที่ 2 กดยืนยันชำระเงินจริง)
  const handleConfirmSale = async (customNote?: string) => {
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
        note: customNote || null,
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

      const receivedNum = cashReceived ? parseFloat(cashReceived) : null;
      const changeNum =
        paymentMethod === 'CASH' && receivedNum && receivedNum >= totalAmount
          ? receivedNum - totalAmount
          : null;

      stopCamera();
      setShowConfirmModal(false);
      setCompletedSale({
        ...json.sale,
        receivedAmount: receivedNum,
        changeAmount: changeNum,
      });
      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการขาย');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="print:hidden h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row gap-5">
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
                        <span className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                          {inCart.quantity}
                        </span>
                      )}

                      {/* Product Image Thumbnail (Full View - No Crop) */}
                      {prod.image ? (
                        <div className="w-full h-32 sm:h-36 mb-2.5 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5">
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      ) : null}

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
                  ร้านค้า: <strong className="text-slate-700">{user?.name}</strong>
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

          {/* Checkout Panel */}
          <div className="p-4 border-t border-slate-200 bg-white space-y-3">
            {/* Payment Method Selector (เงินสด & สแกน QR) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2.5 px-2 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-colors ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px]">เงินสด</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('QR')}
                className={`py-2.5 px-2 rounded-xl font-bold flex flex-col items-center gap-1 border cursor-pointer transition-colors ${
                  paymentMethod === 'QR'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-4 h-4 text-sky-600" />
                <span className="text-[11px]">สแกน QR</span>
              </button>
            </div>

            {/* Total Display */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold text-slate-500">จำนวนรวม:</span>
              <span className="font-bold text-slate-800">{totalItems} แก้ว</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-black text-slate-700">ยอดรวมทั้งสิ้น:</span>
              <span className="text-2xl font-black text-emerald-700 font-mono">
                ฿{totalAmount.toFixed(2)}
              </span>
            </div>

            {/* Step 1 Button: Opens Step 2 Modal */}
            <button
              onClick={handleOpenConfirm}
              disabled={cart.length === 0 || processing}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <DollarSign className="w-5 h-5" />
              <span>ชำระเงิน (฿{totalAmount.toFixed(2)})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      {/* Step 2: Payment Confirmation Modal (ป้องกันการกดผิด ชั้นที่ 2) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    ยืนยันการชำระเงิน (ตรวจสอบก่อนบันทึก)
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตรวจสอบยอดและรับเงินจากลูกค้าก่อนกดยืนยันบิล
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Order Items Preview */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>รายการสินค้า ({totalItems} รายการ)</span>
                  <span className="text-slate-400">ราคา</span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {cart.map((it) => (
                    <div key={it.product.id} className="py-1.5 flex justify-between items-center">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-800">{it.product.name}</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">× {it.quantity}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-700">
                        ฿{(Number(it.product.price) * it.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-800">
                  <span>ยอดชำระสุทธิ:</span>
                  <span className="text-xl font-mono text-emerald-700">
                    ฿{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector in Modal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  วิธีชำระเงินของลูกค้า:
                </label>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setCashReceived('');
                    }}
                    className={`py-3 px-3 rounded-2xl font-bold flex flex-col items-center gap-1.5 border cursor-pointer transition-all ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-6 h-6 text-emerald-600" />
                    <span className="text-sm">เงินสด</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QR')}
                    className={`py-3 px-3 rounded-2xl font-bold flex flex-col items-center gap-1.5 border cursor-pointer transition-all ${
                      paymentMethod === 'QR'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-6 h-6 text-sky-600" />
                    <span className="text-sm">สแกน QR</span>
                  </button>
                </div>
              </div>

              {/* If CASH selected: Quick Cash & Change Calculator */}
              {paymentMethod === 'CASH' && (
                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-900">รับเงินสดมา (บาท):</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCashReceived(totalAmount.toString())}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        พอดี
                      </button>
                      {[100, 500, 1000].map(
                        (quick) =>
                          quick >= totalAmount && (
                            <button
                              key={quick}
                              type="button"
                              onClick={() => setCashReceived(quick.toString())}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 cursor-pointer"
                            >
                              ฿{quick}
                            </button>
                          )
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder={`ระบุจำนวนเงินที่รับ เช่น ${totalAmount}`}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800"
                  />
                  {cashReceived && parseFloat(cashReceived) >= totalAmount && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-amber-200">
                      <span className="font-bold text-amber-900">เงินทอนลูกค้า:</span>
                      <span className="text-base font-black font-mono text-emerald-700">
                        ฿{(parseFloat(cashReceived) - totalAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {cashReceived && parseFloat(cashReceived) < totalAmount && (
                    <p className="text-[11px] font-semibold text-red-600">
                      ⚠️ ยอดเงินที่รับมาน้อยกว่ายอดชำระ (ขาดอีก ฿{(totalAmount - parseFloat(cashReceived)).toFixed(2)})
                    </p>
                  )}
                </div>
              )}

              {/* If QR selected: PromptPay QR Code Display */}
              {paymentMethod === 'QR' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3 animate-in fade-in duration-150">
                  {/* Thai QR Header Banner */}
                  <div className="bg-[#003B64] text-white py-2 px-3 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-sky-300" />
                      <div className="text-left">
                        <div className="text-[11px] font-black tracking-wide">THAI QR PAYMENT</div>
                        <div className="text-[9px] text-sky-200">พร้อมเพย์ (PromptPay)</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-amber-300 truncate max-w-[140px]">
                        {user?.name || 'ร้านค้า JJ Mall'}
                      </div>
                    </div>
                  </div>

                  {/* QR Code Container (แสดง QR Code ทันที) */}
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/80 inline-block shadow-xs">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="PromptPay QR Code"
                          className="w-48 h-48 object-contain mx-auto"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                          กำลังสร้าง QR Code...
                        </div>
                      )}
                    </div>

                    <div className="bg-sky-50 rounded-xl p-3 border border-sky-200">
                      <div className="text-[11px] text-sky-800 font-semibold">ยอดเงินที่ต้องสแกนจ่าย:</div>
                      <div className="text-2xl font-black text-sky-900 font-mono">฿{totalAmount.toFixed(2)}</div>
                    </div>

                    {/* Discreet Settings Link for Staff */}
                    <div className="flex items-center justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPromptPayInput(promptPayId);
                          setIsEditingPromptPay(!isEditingPromptPay);
                        }}
                        className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>{isEditingPromptPay ? 'ซ่อนการตั้งค่าบัญชี' : 'ตั้งค่าบัญชีพร้อมเพย์ร้าน'}</span>
                      </button>
                    </div>

                    {/* Quick Edit PromptPay Number Drawer */}
                    {isEditingPromptPay && (
                      <div className="p-3 bg-white rounded-xl border border-sky-300 space-y-2 text-left animate-in fade-in duration-150">
                        <div className="text-[11px] font-bold text-slate-700">
                          ระบุเบอร์โทรศัพท์ หรือเลขประจำตัวพร้อมเพย์ของร้าน:
                        </div>
                        <div className="text-[10px] text-slate-500">
                          บัญชีปัจจุบัน: <strong className="font-mono text-slate-700">{maskPromptPay(promptPayId)}</strong>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="ระบุเบอร์ใหม่ เช่น 081xxxxxxx"
                            value={promptPayInput}
                            onChange={(e) => setPromptPayInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                          <button
                            type="button"
                            onClick={handleSavePromptPay}
                            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                          >
                            บันทึก
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400">
                    💡 ลูกค้าเปิดแอปธนาคารใดก็ได้ สแกน QR ด้านบน ยอดเงินจะขึ้นพอดี ฿{totalAmount.toFixed(2)} ทันที
                  </p>

                  {/* Anti-Fraud Slip Verification Section */}
                  <div className="mt-3 pt-3 border-t border-slate-200 text-left space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>ระบบยืนยันสลิปอัตโนมัติ (ป้องกันสลิปปลอม)</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        Auto-Confirm
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      เมื่อลูกค้าโอนเงินเสร็จ นำสลิปมาสแกนหน้ากล้อง หรือแนบรูปสลิป ระบบจะเช็คยอดเงินจริงกับธนาคารและ <strong>กดยืนยันการขายให้อัตโนมัติทันที</strong> โดยพนักงานไม่ต้องกดเอง
                    </p>

                    {/* Camera Viewfinder (when cameraActive) */}
                    {cameraActive && (
                      <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 aspect-video flex items-center justify-center shadow-md">
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 border-2 border-dashed border-emerald-400/80 m-6 rounded-xl pointer-events-none flex items-center justify-center">
                          <span className="text-white text-[11px] font-bold bg-black/60 px-2.5 py-1 rounded-lg">
                            เล็ง QR Code บนสลิปให้อยู่ในกรอบ
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Verifying Spinner or Success Alert */}
                    {verifyingSlip && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs font-bold text-emerald-800 animate-pulse">
                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>{slipVerifiedSuccess || 'กำลังตรวจสอบสลิปโอนเงินกับระบบธนาคาร...'}</span>
                      </div>
                    )}

                    {!verifyingSlip && slipVerifiedSuccess && (
                      <div className="p-3 bg-emerald-600 text-white rounded-xl flex items-center gap-2 text-xs font-bold shadow-md animate-in fade-in">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span>{slipVerifiedSuccess}</span>
                      </div>
                    )}

                    {/* Actions: Camera & Upload & Test Demo */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cameraActive ? stopCamera : startCamera}
                        disabled={verifyingSlip || processing}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                          cameraActive
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                        }`}
                      >
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>{cameraActive ? 'ปิดกล้องสแกน' : 'เปิดกล้องสแกนสลิป'}</span>
                      </button>

                      <label className="py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                        <UploadCloud className="w-4 h-4 text-sky-600" />
                        <span>แนบสลิป / Ctrl+V</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSlipUpload(file);
                            e.target.value = '';
                          }}
                          disabled={verifyingSlip || processing}
                        />
                      </label>
                    </div>

                    {/* Instant Demo Sandbox Button for testing */}
                    <div className="text-center pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const mockRef = `DEMO${Date.now()}`;
                          const mockQr = `00020101021229370016A000000677010111${mockRef}540${totalAmount.toFixed(2).length}${totalAmount.toFixed(2)}5802TH53037646304ABCD`;
                          handleVerifySlip(mockQr);
                        }}
                        disabled={verifyingSlip || processing}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>⚡ ทดสอบจำลอง: ลูกค้าโอนเงินสำเร็จเข้าธนาคาร (Auto-Confirm)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message inside modal */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Footer with 2 distinct actions */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={processing}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>ยกเลิก / แก้ไข</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSale()}
                disabled={
                  processing ||
                  (paymentMethod === 'CASH' && !!cashReceived && parseFloat(cashReceived) < totalAmount)
                }
                className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/25 disabled:opacity-50 transition-all cursor-pointer"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>กำลังบันทึกการขาย...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันการขาย & ออกบิล</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <span>ร้านค้า / จุดขาย:</span>
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

              {completedSale.receivedAmount != null && (
                <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>รับเงินสดมา:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ฿{Number(completedSale.receivedAmount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>เงินทอนลูกค้า:</span>
                    <span className="font-mono text-sm font-black">
                      ฿{Number(completedSale.changeAmount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบเสร็จ</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>เปิดบิลขายใหม่</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Official POS Thermal Receipt (สำหรับพิมพ์สลิป 80mm / 58mm ออกเครื่องพิมพ์ความร้อน) */}
      {completedSale && (
        <div id="official-pos-receipt" className="hidden print:block text-black bg-white">
          {/* Header */}
          <div className="text-center pb-2 border-b border-dashed border-black">
            <h1 className="text-sm font-black tracking-wider">ใบเสร็จรับเงิน</h1>
            <p className="text-xs font-bold text-black">{completedSale.createdBy?.name || user?.name || 'ร้านค้าหน้าร้าน'}</p>
            <p className="text-[10px] text-neutral-600">ศูนย์การค้าเจเจมอลล์ จตุจักร</p>
          </div>

          {/* Receipt Meta */}
          <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span>เลขที่บิล:</span>
              <span className="font-mono font-bold">{completedSale.saleNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>วันที่:</span>
              <span>
                {new Date(completedSale.createdAt).toLocaleDateString('th-TH')}{' '}
                {new Date(completedSale.createdAt).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                น.
              </span>
            </div>
            <div className="flex justify-between">
              <span>ร้านค้า:</span>
              <span className="font-bold">{completedSale.createdBy?.name || user?.name || 'ร้านค้าหน้าร้าน'}</span>
            </div>
            <div className="flex justify-between">
              <span>วิธีชำระ:</span>
              <span className="font-bold">
                {completedSale.paymentMethod === 'CASH'
                  ? 'เงินสด (CASH)'
                  : completedSale.paymentMethod === 'QR'
                  ? 'สแกน QR พร้อมเพย์'
                  : 'บัตรเครดิต'}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-2 border-b border-dashed border-black">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-black text-left font-bold">
                  <th className="py-1">รายการ</th>
                  <th className="py-1 text-center w-8">จน.</th>
                  <th className="py-1 text-right w-14">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-neutral-300">
                {completedSale.items?.map((it: any) => (
                  <tr key={it.id}>
                    <td className="py-1 pr-1 leading-tight">{it.product?.name}</td>
                    <td className="py-1 text-center font-mono">{it.quantity}</td>
                    <td className="py-1 text-right font-mono font-bold">
                      {Number(it.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
            <div className="flex justify-between">
              <span>รวมสินค้าทั้งหมด:</span>
              <span className="font-mono font-bold">{completedSale.totalItems} แก้ว</span>
            </div>
            <div className="flex justify-between text-xs font-black pt-1 border-t border-black">
              <span>ยอดรวมสุทธิ:</span>
              <span className="font-mono text-sm">฿{Number(completedSale.totalAmount).toFixed(2)}</span>
            </div>
            {completedSale.receivedAmount != null && (
              <>
                <div className="flex justify-between pt-1">
                  <span>รับเงินสด:</span>
                  <span className="font-mono">฿{Number(completedSale.receivedAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>เงินทอน:</span>
                  <span className="font-mono">฿{Number(completedSale.changeAmount || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer Note */}
          <div className="pt-3 text-center text-[9px] space-y-0.5">
            <p className="font-bold">** ขอบคุณที่ใช้บริการ **</p>
            <p className="text-[8px] text-neutral-500 pt-0.5">
              กรุณาตรวจสอบสินค้าและเงินทอนก่อนออกจากเคาน์เตอร์
            </p>
          </div>
        </div>
      )}
    </>
  );
}

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
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number | null;
  status: string;
  storeId?: number | null;
  store?: {
    id: number;
    name: string;
    username: string;
  } | null;
}

export default function StaffProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      code: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'เครื่องดื่มเย็น',
      unit: 'แก้ว',
      price: '',
      cost: '',
      status: 'ACTIVE',
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
      price: String(p.price || ''),
      cost: p.cost ? String(p.cost) : '',
      status: p.status,
    });
    setFormError(null);
    setModalOpen(true);
  };

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
    if (!confirm(`คุณต้องการลบหรือระงับการขายเมนู "${name}" ของร้านใช่หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.message || 'ไม่สามารถลบเมนูได้');
        return;
      }
      await mutate();
      showToast(`ลบหรือระงับเมนู "${name}" เรียบร้อยแล้ว`);
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
            <Store className="w-3.5 h-3.5 text-emerald-600" />
            จัดการเมนูร้านค้า: {user?.name || 'หน้าร้าน'}
          </div>
          <h1 className="text-2xl font-black text-slate-800">
            รายการสินค้าและเมนูของร้าน
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            เพิ่ม แก้ไข และจัดการเมนูเครื่องดื่มของร้านค้า (ข้อมูลจะอัปเดตไปยังระบบ Admin แบบ Real-time)
          </p>
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
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none cursor-pointer w-full sm:w-auto"
        >
          <option value="ALL">ทุกหมวดหมู่ ({categories.length})</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading && products.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดรายการเมนู...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <Package className="w-10 h-10 text-slate-300" />
            <span>ยังไม่มีรายการเมนูของร้าน หรือไม่พบเมนูที่ค้นหา</span>
            <button
              onClick={openAddModal}
              className="mt-2 text-emerald-600 font-bold underline cursor-pointer"
            >
              + เพิ่มเมนูแรกของร้านทันที
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
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
                {filteredProducts.map((p) => {
                  const isMyMenu = p.storeId === user?.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {p.code}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">
                        {p.name}
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            ส่วนกลาง
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
                            ? 'bg-emerald-100/70 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {p.status === 'ACTIVE' ? 'เปิดขาย' : 'ระงับการขาย'}
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
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingProduct ? 'แก้ไขเมนูของร้าน' : 'เพิ่มเมนูใหม่ของร้าน'}
                  </h3>
                  <p className="text-[11px] text-slate-400">บันทึกข้อมูลเพื่อใช้ขายหน้าร้าน POS ทันที</p>
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อเมนูเครื่องดื่ม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น ชาเขียวมัทฉะลาเต้"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

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
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-60 cursor-pointer"
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

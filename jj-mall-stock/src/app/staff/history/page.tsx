'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Search, Clock, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import Pagination from '@/components/Pagination';

export default function StaffSalesHistoryPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sales?myOnly=true&limit=200')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) {
          setSales(data.sales);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const paginatedSales = sales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCups = sales.reduce((sum, s) => sum + s.totalItems, 0);
  const totalMoney = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 mb-1">
            <ShoppingBag className="w-3.5 h-3.5" />
            ประวัติการขายของฉัน (My Sales Log)
          </div>
          <h1 className="text-2xl font-black text-slate-800">
            ประวัติบิลขายของร้าน: {user?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            รายการบิลขายที่คุณเป็นผู้ทำรายการ
          </p>
        </div>
      </div>

      {/* 2 Quick KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase">จำนวนแก้วที่ขายได้</div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {totalCups} <span className="text-sm font-semibold text-slate-500">แก้ว</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-emerald-600 uppercase">ยอดขายรวมของคุณ</div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            ฿{totalMoney.toFixed(2)}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดประวัติการขาย...</span>
          </div>
        ) : sales.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            ยังไม่มีประวัติการขายของคุณในระบบ
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">เลขที่ใบเสร็จ</th>
                    <th className="py-3.5 px-4">วันที่ / เวลา</th>
                    <th className="py-3.5 px-4">รายการสินค้า</th>
                    <th className="py-3.5 px-4 text-center">วิธีชำระ</th>
                    <th className="py-3.5 px-4 text-center">จำนวน</th>
                    <th className="py-3.5 px-4 text-right">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {sale.saleNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(sale.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {sale.items?.map((it: any) => `${it.product?.name} (${it.quantity})`).join(', ')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {sale.totalItems} แก้ว
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-slate-800 text-sm">
                        ฿{Number(sale.totalAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={sales.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

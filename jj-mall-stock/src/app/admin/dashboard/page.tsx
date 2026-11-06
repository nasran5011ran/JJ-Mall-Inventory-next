'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/context/auth-context';
import {
  DollarSign,
  Coffee,
  Package,
  Layers,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ShoppingCart,
  ArrowDownToLine,
  ClipboardCheck,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileEdit,
  Clock,
  Sparkles,
  Wheat,
  ChevronRight,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Instant SWR Cache: Shows cached data immediately upon clicking without blank/loading screen
  const { data: swrData, error, isLoading, isValidating, mutate } = useSWR('/api/dashboard', {
    revalidateOnMount: true,
  });

  const data = swrData?.success ? swrData.data : null;
  const isInitialLoading = isLoading && !data;

  useEffect(() => {
    if (user && user.role === 'STAFF') {
      router.replace('/sales');
      return;
    }
  }, [user, router]);

  const fetchDashboardData = () => {
    mutate();
  };

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">กำลังโหลดข้อมูล Dashboard แบบ Real-time...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const salesTrend = data?.salesTrend || [];
  const topProducts = data?.topSellingProducts || [];
  const topIngredients = data?.topIngredientsUsed || [];
  const lowStockList = data?.lowStockList || [];
  const recentSales = data?.recentSales || [];

  // Max value for sales trend bar chart scaling
  const maxSales = Math.max(...salesTrend.map((s: any) => s.total), 100);

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 hidden sm:block">
          ภาพรวมยอดขาย สต็อกสินค้า และสถานะคลังวัตถุดิบแบบเรียลไทม์
        </p>
        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={fetchDashboardData}
            disabled={isValidating}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-2 text-xs font-semibold cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <Link
            href="/admin/sales"
            prefetch={true}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>ตรวจสอบยอดขายแต่ละร้าน</span>
          </Link>

          <Link
            href="/admin/stock-in"
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
            <span>รับสินค้าเข้า</span>
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Grid (8 KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today Sales */}
        <Link
          href="/admin/reports/sales"
          className="group bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all block cursor-pointer"
          title="คลิกเพื่อดูรายงานวิเคราะห์ยอดขายประจำวัน"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-700 uppercase tracking-wider transition-colors">
              ยอดขายวันนี้
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
              ฿{Number(kpis.todaySalesAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>สรุปยอดขายทั้งหมดในวันนี้</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Link>

        {/* Card 2: Today Cups Sold */}
        <Link
          href="/admin/reports/sales"
          className="group bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all block cursor-pointer"
          title="คลิกเพื่อดูสรุปจำนวนแก้วและยอดขาย"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 group-hover:text-amber-700 uppercase tracking-wider transition-colors">
              จำนวนแก้วที่ขายวันนี้
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all flex items-center justify-center">
              <Coffee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 group-hover:text-amber-700 transition-colors">
              {Number(kpis.todayCupsSold || 0).toLocaleString()}{' '}
              <span className="text-sm font-semibold text-slate-500">แก้ว</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>รวมทุกเมนูเครื่องดื่ม</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Link>

        {/* Card 3: Total Products & Ingredients */}
        <Link
          href="/admin/products"
          className="group bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all block cursor-pointer"
          title="คลิกเพื่อจัดการสินค้าและวัตถุดิบ"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 group-hover:text-blue-700 uppercase tracking-wider transition-colors">
              สินค้า & วัตถุดิบ
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 group-hover:text-blue-700 transition-colors">
              {kpis.totalProducts} <span className="text-sm font-semibold text-slate-500">สินค้า</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>{kpis.totalIngredients} วัตถุดิบในระบบ</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Link>

        {/* Card 4: Low Stock Alert */}
        <Link
          href="/admin/reports/stock"
          className={`group p-5 rounded-3xl border shadow-2xs hover:shadow-md transition-all block cursor-pointer ${
            kpis.lowStockIngredients > 0 || kpis.outOfStockIngredients > 0
              ? 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
              : 'bg-white border-slate-200/80 hover:border-emerald-300'
          }`}
          title="คลิกเพื่อดูรายงานสต็อกและสั่งซื้อเพิ่ม"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 group-hover:text-amber-800 uppercase tracking-wider transition-colors">
              แจ้งเตือนสต็อก
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-all flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-700">
              {kpis.lowStockIngredients + kpis.outOfStockIngredients}{' '}
              <span className="text-sm font-semibold text-slate-500">รายการ</span>
            </div>
            <div className="text-xs text-amber-800 mt-1 flex items-center justify-between font-medium">
              <span>
                <span>ใกล้หมด {kpis.lowStockIngredients}</span> •{' '}
                <span className="text-red-600">หมดแล้ว {kpis.outOfStockIngredients}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* 3. Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (2 columns on lg) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  กราฟยอดขายรายวัน (7 วันย้อนหลัง)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  สถิติยอดขาย (บาท) และจำนวนแก้วที่ขายได้ในแต่ละวัน
                </p>
              </div>
              <Link
                href="/admin/reports/sales?period=THIS_WEEK"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer"
                title="คลิกเพื่อดูรายงานยอดขายรอบ 7 วันล่าสุด"
              >
                <span>ดูรายงานเต็ม (7 วันล่าสุด)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Bar Chart Visualization (Clickable bars to view day sales) */}
            <div className="h-64 pt-6 pb-2 flex items-end justify-between gap-3 sm:gap-6 border-b border-slate-100">
              {salesTrend.map((day: any, idx: number) => {
                const heightPercent = Math.max(Math.round((day.total / maxSales) * 100), 6);
                const isToday = idx === salesTrend.length - 1;

                return (
                  <Link
                    key={day.date}
                    href={`/admin/reports/sales?date=${day.date}`}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    title={`คลิกเพื่อดูยอดขายวันที่ ${day.label}`}
                  >
                    {/* Tooltip value */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mb-1 whitespace-nowrap shadow-xs pointer-events-none">
                      ฿{day.total} ({day.cups} แก้ว)
                    </div>

                    {/* Bar */}
                    <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden h-full flex flex-col justify-end">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-xl transition-all duration-500 ${
                          isToday
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-500 group-hover:from-emerald-700 group-hover:to-teal-600'
                            : 'bg-gradient-to-t from-slate-300 to-slate-400 group-hover:from-emerald-500 group-hover:to-teal-400'
                        }`}
                      />
                    </div>

                    {/* Day label */}
                    <span
                      className={`text-[11px] mt-2 font-semibold ${
                        isToday ? 'text-emerald-700 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {day.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" />
                <span>ยอดขายวันนี้</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-300 inline-block" />
                <span>วันก่อนหน้า</span>
              </div>
            </div>
            <span className="font-semibold text-slate-600">อัปเดตอัตโนมัติเมื่อเกิดการขาย</span>
          </div>
        </div>

        {/* Top Selling Products (1 column on lg) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                สินค้าขายดี Top 5
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">รวมยอดตลอดกาล</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                ยังไม่มีข้อมูลการขายสินค้าในระบบ
                <div className="mt-2">
                  <Link href="/sales" className="text-emerald-600 font-semibold underline">
                    เริ่มบันทึกการขายสินค้า
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {topProducts.map((p: any, idx: number) => {
                  const maxQty = Math.max(...topProducts.map((item: any) => item.totalQty), 1);
                  const percent = Math.round((p.totalQty / maxQty) * 100);

                  return (
                    <div key={p.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800">{p.name}</span>
                        </div>
                        <span className="font-bold text-emerald-700">
                          {p.totalQty} {p.unit} (฿{p.totalAmount.toLocaleString()})
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            idx === 0 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <Link
              href="/admin/products"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1 hover:underline cursor-pointer"
            >
              <span>จัดการสินค้าทั้งหมด ({kpis.totalProducts} รายการ)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Row 2: Top Ingredients Consumed & Low Stock Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="alerts">
        {/* Widget: Ingredients Consumed Today */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Wheat className="w-4 h-4 text-emerald-600" />
                วัตถุดิบที่ใช้มากที่สุดวันนี้ (ตัดตามสูตร BOM)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                คำนวณอัตโนมัติจากยอดขายคูณสัดส่วนในสูตรการผลิต
              </p>
            </div>
            <Link
              href="/admin/reports/ingredients"
              className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
            >
              ดูทั้งหมด
            </Link>
          </div>

          {topIngredients.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              วันนี้ยังไม่มีการใช้วัตถุดิบจากการขาย
              <div className="mt-1 text-[11px] text-slate-400">
                เมื่อกดขายสินค้าในหน้า POS ระบบจะตัดยอดวัตถุดิบและแสดงที่นี่อัตโนมัติ
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topIngredients.map((ing: any, i: number) => (
                <div
                  key={ing.code}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">{ing.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{ing.code}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-slate-800">
                      {Number(ing.totalUsed).toLocaleString()}
                    </span>{' '}
                    <span className="text-slate-500 font-medium">{ing.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Widget: Low Stock & Out of Stock Warnings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                แจ้งเตือนวัตถุดิบที่ต้องสั่งซื้อด่วน
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                วัตถุดิบที่สต็อกคงเหลือต่ำกว่าสต็อกขั้นต่ำ (Min Stock)
              </p>
            </div>
            <Link
              href="/admin/ingredients"
              className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
            >
              ดูคลังวัตถุดิบ
            </Link>
          </div>

          {lowStockList.length === 0 ? (
            <div className="p-8 text-center text-emerald-800 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span className="font-bold">สต็อกวัตถุดิบทุกรายการมีเพียงพอ</span>
              <span className="text-[11px] text-emerald-700/80">ไม่มีรายการใดต่ำกว่าเกณฑ์ขั้นต่ำ</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStockList.map((item: any) => (
                <div
                  key={item.code}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    item.isOutOfStock
                      ? 'bg-red-50/70 border-red-200 text-red-900'
                      : 'bg-amber-50/60 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${item.isOutOfStock ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                      {item.isOutOfStock ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        คงเหลือ {item.currentStock} {item.unit} (สต็อกขั้นต่ำ: {item.minStock} {item.unit})
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/admin/stock-in?code=${item.code}`}
                    className="px-3 py-1.5 rounded-xl font-bold text-xs bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer"
                  >
                    + สั่งซื้อ/รับเข้า
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent Sales Transactions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              รายการขายล่าสุด 5 รายการ
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              ประวัติการขายหน้าร้าน พร้อมข้อมูลผู้ทำรายการและเวลา
            </p>
          </div>
          <Link
            href="/admin/sales"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>ดูประวัติการขายทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentSales.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            ยังไม่มีรายการขายในระบบ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">เลขที่ใบเสร็จ</th>
                  <th className="py-3 px-3">เวลา</th>
                  <th className="py-3 px-3">พนักงานขาย</th>
                  <th className="py-3 px-3 text-center">จำนวนแก้ว</th>
                  <th className="py-3 px-3 text-right">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.map((sale: any) => (
                  <tr
                    key={sale.id}
                    onClick={() => router.push('/admin/sales')}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    title="คลิกเพื่อดูรายละเอียดในหน้าตรวจสอบยอดขาย"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">{sale.saleNumber}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(sale.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">{sale.createdBy?.name || 'พนักงาน'}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800">{sale.totalItems} แก้ว</td>
                    <td className="py-3 px-3 text-right font-black text-slate-800">
                      ฿{Number(sale.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

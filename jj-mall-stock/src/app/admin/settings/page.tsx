'use client';

import React, { useState } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  Volume2,
  Printer,
  Bell,
  Shield,
  Building,
  Database,
  Globe,
  Clock,
  Sparkles,
  Save,
} from 'lucide-react';
import { useTheme, Theme } from '@/context/theme-context';

export default function AdminSettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Settings State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [stockAlertsEnabled, setStockAlertsEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSavePreferences = () => {
    showToast('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-xs text-slate-500">
          ปรับแต่งธีมการแสดงผล รูปแบบหน้าจอ และการตั้งค่าระบบขายหน้าร้าน JJ Mall
        </p>
      </div>

      {/* 1. Theme & Appearance Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 sm:p-7 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">ธีมการแสดงผลหน้าจอ (Appearance & Theme)</h2>
            <p className="text-xs text-slate-500">
              เลือกธีมที่เหมาะกับสภาพแวดล้อมของคุณ หรือกดไอคอนพระอาทิตย์ / พระจันทร์บนแถบ Navbar ข้างนาฬิกาได้ตลอดเวลา
            </p>
          </div>
        </div>

        {/* Theme Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Light Theme Card */}
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              showToast('เปลี่ยนเป็นธีมสว่าง (Light Mode) เรียบร้อย');
            }}
            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between h-44 relative group ${
              theme === 'light'
                ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {theme === 'light' && (
              <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <span>ธีมสว่าง (Light)</span>
                <span className="text-xs">☀️</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                พื้นหลังโทนขาว-เทาอ่อน สบายตา คมชัด เหมาะสำหรับการทำงานตอนกลางวัน
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2">
              <div className="w-full h-full bg-amber-400" />
            </div>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              showToast('เปลี่ยนเป็นธีมมืด (Dark Mode) เรียบร้อย');
            }}
            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between h-44 relative group ${
              theme === 'dark'
                ? 'bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
            }`}
          >
            {theme === 'dark' && (
              <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-300 flex items-center justify-center mb-3 border border-slate-700">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>ธีมมืด (Dark)</span>
                <span className="text-xs">🌙</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                พื้นหลังโทนเข้ม มืดสนิท ถนอมสายตา ลดแสงสะท้อน เหมาะกับห้องควบคุม
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2 border border-slate-700">
              <div className="w-full h-full bg-emerald-500" />
            </div>
          </button>

          {/* System Default Theme Card */}
          <button
            type="button"
            onClick={() => {
              setTheme('system');
              showToast('ตั้งค่าธีมตามระบบเครื่อง (System Default)');
            }}
            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between h-44 relative group ${
              theme === 'system'
                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/30'
                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {theme === 'system' && (
              <span className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <span>ตามระบบ (System)</span>
                <span className="text-xs">💻</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                ปรับเปลี่ยนสว่าง/มืด อัตโนมัติตามการตั้งค่าของ Windows / อุปกรณ์
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2">
              <div className="w-full h-full bg-blue-500" />
            </div>
          </button>
        </div>

        {/* Current Theme Status Info */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">สถานะธีมปัจจุบัน:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {resolvedTheme === 'dark' ? '🌙 กำลังใช้งานโหมดมืด (Dark)' : '☀️ กำลังใช้งานโหมดสว่าง (Light)'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            บันทึกการตั้งค่าลงเบราว์เซอร์อัตโนมัติ
          </span>
        </div>
      </div>

      {/* 2. POS & System Preferences */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 sm:p-7 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">การตั้งค่าการทำงาน (System Preferences)</h2>
            <p className="text-xs text-slate-500">
              กำหนดพฤติกรรมการทำงานของจุดขาย POS และการแจ้งเตือน
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-800">เสียงแจ้งเตือนเมื่อขายสำเร็จ (Audio Beep)</div>
                <div className="text-[11px] text-slate-500">เล่นเสียงแจ้งเตือนเมื่อแคชเชียร์ชำระเงินบิลสำเร็จ</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {/* Auto Print Receipt Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-800">พิมพ์ใบเสร็จอัตโนมัติ (Auto-Print Receipt)</div>
                <div className="text-[11px] text-slate-500">เปิดหน้าต่างพิมพ์ใบเสร็จทันทีหลังปิดการขาย</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoPrintReceipt}
                onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {/* Stock Alerts Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-slate-800">แจ้งเตือนวัตถุดิบวิกฤต (Low Stock Warning)</div>
                <div className="text-[11px] text-slate-500">แสดงตัวเลขและไฮไลท์เตือนบน Dashboard เมื่อวัตถุดิบต่ำกว่า Min Stock</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={stockAlertsEnabled}
                onChange={(e) => setStockAlertsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSavePreferences}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 cursor-pointer flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>

      {/* 3. System & Branch Information */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 sm:p-7 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">ข้อมูลสาขาและระบบ (System Information)</h2>
            <p className="text-xs text-slate-500">ข้อมูลพื้นฐานของสภาพแวดล้อมระบบ JJ Mall</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 font-medium">ชื่อระบบ</div>
            <div className="font-bold text-slate-800">JJ Mall Stock & POS</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 font-medium">สาขาหลัก</div>
            <div className="font-bold text-slate-800">JJ Mall จตุจักร (Chatuchak)</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 font-medium">เวอร์ชันระบบ</div>
            <div className="font-bold text-emerald-700 font-mono">v2.0.0 (Production)</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 font-medium">ฐานข้อมูล (Database)</div>
            <div className="font-bold text-slate-800 font-mono">MySQL 8.0 • 127.0.0.1</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 font-medium">สกุลเงินเริ่มต้น</div>
            <div className="font-bold text-slate-800">บาทไทย (THB - ฿)</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 font-medium">เขตเวลา (Timezone)</div>
            <div className="font-bold text-slate-800 font-mono">Asia/Bangkok (UTC+07:00)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

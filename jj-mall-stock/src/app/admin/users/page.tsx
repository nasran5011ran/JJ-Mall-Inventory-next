'use client';

import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  User as UserIcon,
  Crown,
  Eye,
  EyeOff,
  Power,
  Calendar,
  History,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface UserData {
  id: number;
  username: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  avatar?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  _count?: {
    sales: number;
    stockTransactions: number;
    stockCounts: number;
  };
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);

  // Instant SWR Cache: Shows cached users immediately on page switch
  const { data: swrData, isLoading, isValidating, mutate } = useSWR('/api/users');

  useEffect(() => {
    if (swrData?.success && Array.isArray(swrData.users)) {
      setUsers(swrData.users);
    }
  }, [swrData]);

  const loading = isLoading && users.length === 0;
  const refreshing = isValidating;
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'STAFF'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Toasts & Highlights
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserData | null>(null);

  // Add Form state
  const [addForm, setAddForm] = useState({
    username: '',
    name: '',
    password: '1234',
    role: 'STAFF' as 'ADMIN' | 'STAFF',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Form state
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'STAFF' as 'ADMIN' | 'STAFF',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Password Form state
  const [newPassword, setNewPassword] = useState('1234');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Users
  const fetchUsers = async (_isManual = false) => {
    await mutate();
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q);

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Stats
  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const staffCount = users.filter((u) => u.role === 'STAFF').length;
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      showToast(data.message || 'เพิ่มผู้ใช้งานสำเร็จ');
      setIsAddModalOpen(false);
      setAddForm({
        username: '',
        name: '',
        password: '1234',
        role: 'STAFF',
        status: 'ACTIVE',
      });

      // Highlight new user
      if (data.user?.id) {
        setHighlightId(data.user.id);
        setTimeout(() => setHighlightId(null), 3000);
      }

      fetchUsers(true);
    } catch (err: any) {
      setAddError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้');
    } finally {
      setAddSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u: UserData) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      role: u.role,
      status: u.status,
    });
    setEditError(null);
  };

  // Handle Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setEditSubmitting(true);

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'อัปเดตข้อมูลไม่สำเร็จ');
      }

      showToast(data.message || 'อัปเดตข้อมูลสำเร็จ');
      setHighlightId(editingUser.id);
      setTimeout(() => setHighlightId(null), 3000);

      // Optimistic in-memory update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: editForm.name, role: editForm.role, status: editForm.status }
            : u
        )
      );

      setEditingUser(null);
    } catch (err: any) {
      setEditError(err.message || 'เกิดข้อผิดพลาดในการแก้ไข');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (u: UserData) => {
    setPasswordResetUser(u);
    setNewPassword('1234');
    setResetError(null);
    setShowResetPassword(false);
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;
    setResetError(null);
    setResetSubmitting(true);

    try {
      const res = await fetch(`/api/users/${passwordResetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      }

      showToast(data.message || 'เปลี่ยนรหัสผ่านสำเร็จ');
      setHighlightId(passwordResetUser.id);
      setTimeout(() => setHighlightId(null), 3000);
      setPasswordResetUser(null);
    } catch (err: any) {
      setResetError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Toggle User Status directly
  const handleToggleStatus = async (u: UserData) => {
    if (u.id === currentUser?.id) {
      alert('ไม่สามารถระงับการใช้งานบัญชีของตนเองได้');
      return;
    }

    const nextStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionThai = nextStatus === 'ACTIVE' ? 'เปิดใช้งาน' : 'ระงับการใช้งาน';

    if (!confirm(`คุณต้องการ "${actionThai}" บัญชีของ "${u.name}" (${u.username}) ใช่หรือไม่?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      }

      showToast(`เปลี่ยนสถานะเป็น ${actionThai} เรียบร้อยแล้ว`);
      setHighlightId(u.id);
      setTimeout(() => setHighlightId(null), 3000);

      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, status: nextStatus } : item))
      );
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // Delete User
  const handleDeleteUser = async (u: UserData) => {
    if (u.id === currentUser?.id) {
      alert('ไม่สามารถลบบัญชีผู้ใช้ที่กำลังล็อกอินอยู่ได้');
      return;
    }

    if (!confirm(`ยืนยันการลบผู้ใช้ "${u.name}" (${u.username})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ลบผู้ใช้ไม่สำเร็จ');
      }

      showToast(data.message || 'ลบผู้ใช้สำเร็จ');

      if (data.softDeleted) {
        // Updated to INACTIVE
        setUsers((prev) =>
          prev.map((item) => (item.id === u.id ? { ...item, status: 'INACTIVE' } : item))
        );
      } else {
        // Hard deleted
        setUsers((prev) => prev.filter((item) => item.id !== u.id));
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 hidden sm:block">
          กำหนดบทบาทผู้ดูแลระบบ (Admin) หรือพนักงานขาย (Staff) จัดการรหัสผ่าน และเปิด/ปิดสถานะบัญชี
        </p>
        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <button
            onClick={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ เพิ่มผู้ใช้งานใหม่</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            ผู้ใช้งานทั้งหมด
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">
            {totalCount} <span className="text-xs font-semibold text-slate-500">บัญชี</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            ผู้ดูแลระบบ (Admin)
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {adminCount} <span className="text-xs font-semibold text-slate-500">บัญชี</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-sky-500" />
            เจ้าหน้าที่ขาย (Staff)
          </div>
          <div className="text-2xl font-black text-sky-700 mt-1">
            {staffCount} <span className="text-xs font-semibold text-slate-500">บัญชี</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <Power className="w-3.5 h-3.5 text-emerald-500" />
            พร้อมใช้งาน (Active)
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {activeCount} <span className="text-xs font-semibold text-slate-500">บัญชี</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ใช้ หรือชื่อ-นามสกุล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-slate-50/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
          >
            <option value="ALL">ทุกสิทธิ์การใช้งาน ({totalCount})</option>
            <option value="ADMIN">👑 ผู้ดูแลระบบ (Admin: {adminCount})</option>
            <option value="STAFF">👤 เจ้าหน้าที่ขาย (Staff: {staffCount})</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer flex-1 md:flex-initial"
          >
            <option value="ALL">ทุกสถานะบัญชี</option>
            <option value="ACTIVE">🟢 ใช้งานอยู่ (Active)</option>
            <option value="INACTIVE">🔴 ระงับการใช้งาน (Inactive)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">กำลังโหลดรายชื่อผู้ใช้งาน...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <Users className="w-10 h-10 text-slate-300" />
            <span>ไม่พบรายชื่อผู้ใช้งานตรงกับเงื่อนไขการค้นหา</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">ผู้ใช้งาน</th>
                  <th className="py-3.5 px-4">สิทธิ์ในระบบ (Role)</th>
                  <th className="py-3.5 px-4 text-center">ประวัติทำรายการ</th>
                  <th className="py-3.5 px-4 text-center">สถานะบัญชี</th>
                  <th className="py-3.5 px-4">วันที่ลงทะเบียน</th>
                  <th className="py-3.5 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isHighlighted = highlightId === u.id;
                  const isAdminRole = u.role === 'ADMIN';
                  const isActive = u.status === 'ACTIVE';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isHighlighted ? 'bg-emerald-50/60 ring-1 ring-emerald-500/30' : ''
                      }`}
                    >
                      {/* Name & Username */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                              isAdminRole
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isAdminRole ? <Crown className="w-5 h-5 text-amber-600" /> : <UserIcon className="w-5 h-5 text-slate-600" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  คุณ (บัญชีนี้)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td className="py-3.5 px-4">
                        {isAdminRole ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                            <Crown className="w-3.5 h-3.5 text-amber-600" />
                            👑 ผู้ดูแลระบบ (Admin)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs">
                            <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                            👤 เจ้าหน้าที่ขาย (Staff)
                          </span>
                        )}
                      </td>

                      {/* Activity History */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                          <History className="w-3 h-3 text-slate-400" />
                          <span>บิลขาย: <strong>{u._count?.sales || 0}</strong></span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrent}
                          title={isCurrent ? 'ไม่สามารถระงับบัญชีตนเองได้' : 'คลิกเพื่อสลับสถานะ'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          } ${isCurrent ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                            }`}
                          />
                          <span>{isActive ? 'ใช้งานอยู่' : 'ระงับใช้งาน'}</span>
                        </button>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(u.createdAt).toLocaleDateString('th-TH')}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            title="เปลี่ยนรหัสผ่านด่วน"
                            className="p-1.5 rounded-xl hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-transparent hover:border-amber-200 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(u)}
                            title="แก้ไขข้อมูลผู้ใช้"
                            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {!isCurrent && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="ลบผู้ใช้งาน"
                              className="p-1.5 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-700 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Modal 1: Add New User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">เพิ่มผู้ใช้งานใหม่</h3>
                  <p className="text-xs text-slate-500">สร้างบัญชีสำหรับ Admin หรือพนักงานขาย</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} autoComplete="off" className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้ใช้งาน (Username) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น somchai หรือ cashier1"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase().trim() })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อ-นามสกุล / ชื่อเรียก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ใจดี (กะเช้า)"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    รหัสผ่าน (Password) <span className="text-red-500">*</span>
                  </label>
                  {/* Quick preset buttons */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400">ปุ่มใส่รหัสจำง่าย:</span>
                    <button
                      type="button"
                      onClick={() => setAddForm({ ...addForm, password: '1234' })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold cursor-pointer"
                    >
                      1234
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddForm({ ...addForm, password: 'jj1234' })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold cursor-pointer"
                    >
                      jj1234
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    บทบาท & สิทธิ์ (Role)
                  </label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="STAFF">👤 เจ้าหน้าที่ขาย (Staff)</option>
                    <option value="ADMIN">👑 ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการใช้งาน
                  </label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="ACTIVE">🟢 ใช้งานอยู่ (Active)</option>
                    <option value="INACTIVE">🔴 ระงับการใช้งาน (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {addSubmitting ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้งาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit User Profile */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">แก้ไขข้อมูลผู้ใช้งาน</h3>
                  <p className="text-xs text-slate-500">บัญชี: @{editingUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อ-นามสกุล / ชื่อเรียก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    บทบาท & สิทธิ์ (Role)
                  </label>
                  <select
                    value={editForm.role}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="STAFF">👤 เจ้าหน้าที่ขาย (Staff)</option>
                    <option value="ADMIN">👑 ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการใช้งาน
                  </label>
                  <select
                    value={editForm.status}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="ACTIVE">🟢 ใช้งานอยู่ (Active)</option>
                    <option value="INACTIVE">🔴 ระงับการใช้งาน (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Fast Reset Password */}
      {passwordResetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">เปลี่ยนรหัสผ่านด่วน</h3>
                  <p className="text-xs text-slate-500">{passwordResetUser.name} (@{passwordResetUser.username})</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordResetUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} autoComplete="off" className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    กำหนดรหัสผ่านใหม่ <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-400">เลือกรหัสจำง่าย:</span>
                    <button
                      type="button"
                      onClick={() => setNewPassword('1234')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold cursor-pointer"
                    >
                      1234
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPassword('jj1234')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold cursor-pointer"
                    >
                      jj1234
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  💡 สามารถตั้งรหัสผ่านสั้นๆ หรือตัวเลขที่จำง่ายได้ตามต้องการ
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                >
                  {resetSubmitting ? 'กำลังเปลี่ยนรหัส...' : 'ยืนยันเปลี่ยนรหัสผ่าน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

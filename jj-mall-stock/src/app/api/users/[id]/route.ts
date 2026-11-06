import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Role } from '@prisma/client';

interface Params {
  params: Promise<{ id: string }>;
}

// PUT: Update user details / change password / toggle status (Admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้งาน' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบผู้ใช้งานนี้ในระบบ' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, role, status, newPassword } = body;

    // Safety guard: Cannot deactivate or demote own active admin account
    if (session.id === userId) {
      if (status === 'INACTIVE') {
        return NextResponse.json(
          { success: false, message: 'ไม่สามารถระงับการใช้งานบัญชีของตนเองได้' },
          { status: 400 }
        );
      }
      if (role && role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, message: 'ไม่สามารถเปลี่ยนสิทธิ์ของตนเองออกจากผู้ดูแลระบบได้' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (role && (role === 'ADMIN' || role === 'STAFF')) {
      updateData.role = role === 'ADMIN' ? Role.ADMIN : Role.STAFF;
    }
    if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
      updateData.status = status;
    }

    // If new password is provided, re-hash it (allows simple passwords)
    if (newPassword && newPassword.trim()) {
      updateData.password = await bcrypt.hash(newPassword.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    const isPasswordChanged = Boolean(newPassword && newPassword.trim());

    return NextResponse.json({
      success: true,
      message: isPasswordChanged
        ? `อัปเดตข้อมูลและเปลี่ยนรหัสผ่านของผู้ใช้ "${updated.name}" เรียบร้อยแล้ว`
        : `อัปเดตข้อมูลผู้ใช้ "${updated.name}" สำเร็จ`,
      user: updated,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE: Remove or deactivate user (Admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์ลบผู้ใช้งาน' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: 'รหัสผู้ใช้งานไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Safety guard: cannot delete yourself
    if (session.id === userId) {
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถลบบัญชีผู้ใช้ของตนเองที่กำลังเข้าสู่ระบบอยู่ได้' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            sales: true,
            stockTransactions: true,
            stockCounts: true,
            requestedAdjustments: true,
            approvedAdjustments: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบผู้ใช้งานนี้ในระบบ' },
        { status: 404 }
      );
    }

    // If user has related transactions or sales, soft-deactivate instead of breaking database constraints
    const totalHistory =
      user._count.sales +
      user._count.stockTransactions +
      user._count.stockCounts +
      user._count.requestedAdjustments +
      user._count.approvedAdjustments;

    if (totalHistory > 0) {
      // Soft deactivate
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'INACTIVE' },
      });

      return NextResponse.json({
        success: true,
        message: `ผู้ใช้ "${user.name}" มีประวัติการทำรายการในระบบ (${totalHistory} รายการ) จึงได้ทำการ "ระงับการใช้งาน (INACTIVE)" แทนการลบข้อมูลถาวร เพื่อรักษาความสมบูรณ์ของประวัติบัญชี`,
        softDeleted: true,
      });
    }

    // Hard delete if no transactions
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: `ลบผู้ใช้งาน "${user.name}" (${user.username}) เรียบร้อยแล้ว`,
      softDeleted: false,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน: ' + error.message },
      { status: 500 }
    );
  }
}

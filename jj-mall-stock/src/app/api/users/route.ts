import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Role } from '@prisma/client';

// GET: Fetch all users (Admin only)
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้งาน (Admin Only)' },
        { status: 403 }
      );
    }

    // Enforce single ADMIN rule: if extra ADMIN accounts exist, convert them to STAFF (keeping the primary/current ADMIN)
    const allAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, username: true },
      orderBy: { id: 'asc' },
    });

    if (allAdmins.length > 1) {
      const primaryAdminId =
        allAdmins.find((a) => a.id === session.id)?.id ||
        allAdmins.find((a) => a.username === 'admin')?.id ||
        allAdmins[0].id;
      const extraAdminIds = allAdmins
        .filter((a) => a.id !== primaryAdminId)
        .map((a) => a.id);

      if (extraAdminIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: extraAdminIds } },
          data: { role: Role.STAFF },
        });
      }
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        avatar: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sales: true,
            stockTransactions: true,
            stockCounts: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { id: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน' },
      { status: 500 }
    );
  }
}

// POST: Create new user (Admin only - creates STAFF store accounts; only 1 ADMIN is allowed in the system)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เพิ่มผู้ใช้งาน (Admin Only)' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { username, name, password, role, status } = body;

    if (!username || !username.trim()) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกชื่อผู้ใช้งาน (Username)' },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกชื่อร้าน' },
        { status: 400 }
      );
    }

    if (!password || !password.trim()) {
      return NextResponse.json(
        { success: false, message: 'กรุณากำหนดรหัสผ่านสำหรับผู้ใช้งานนี้' },
        { status: 400 }
      );
    }

    // Strictly block creating another ADMIN if an ADMIN already exists
    if (role === 'ADMIN') {
      const existingAdminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      });
      if (existingAdminCount >= 1) {
        return NextResponse.json(
          {
            success: false,
            message: 'ระบบอนุญาตให้มีบัญชีผู้ดูแลระบบ (Admin) ได้เพียง 1 บัญชีเท่านั้น',
          },
          { status: 400 }
        );
      }
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: `ชื่อผู้ใช้งาน "${cleanUsername}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น` },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        name: name.trim(),
        password: hashedPassword,
        role: Role.STAFF,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `เพิ่มบัญชีร้านค้า "${newUser.name}" (${newUser.username}) เรียบร้อยแล้ว`,
      user: newUser,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มผู้ใช้งาน: ' + error.message },
      { status: 500 }
    );
  }
}

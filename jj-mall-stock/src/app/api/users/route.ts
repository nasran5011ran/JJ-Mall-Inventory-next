import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Role } from '@prisma/client';

// GET: Fetch all users (Admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้งาน (Admin Only)' },
        { status: 403 }
      );
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

// POST: Create new user (Admin only)
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
        { success: false, message: 'กรุณากรอกชื่อ-นามสกุล' },
        { status: 400 }
      );
    }

    if (!password || !password.trim()) {
      return NextResponse.json(
        { success: false, message: 'กรุณากำหนดรหัสผ่าน (สามารถใช้รหัสจำง่าย เช่น 1234 ได้)' },
        { status: 400 }
      );
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

    // Hash password (allows simple passwords without complexity restriction)
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        name: name.trim(),
        password: hashedPassword,
        role: role === 'ADMIN' ? Role.ADMIN : Role.STAFF,
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
      message: `เพิ่มผู้ใช้งาน "${newUser.name}" (${newUser.username}) เรียบร้อยแล้ว`,
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

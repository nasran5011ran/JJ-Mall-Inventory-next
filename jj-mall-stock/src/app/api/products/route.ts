import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/products - List products with optional search and filter
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });

    // Also get all distinct categories for filtering
    const allProducts = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
    });
    const categories = allProducts.map((p) => p.category).filter(Boolean);

    return NextResponse.json({
      success: true,
      products,
      categories,
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า: ' + error.message },
      { status: 500 }
    );
  }
}

// POST /api/products - Create a new product
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มสินค้าได้ พนักงานขายไม่มีสิทธิ์นี้' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { code, name, category, unit, price, cost, minStock, status } = body;

    if (!code || !name || price === undefined) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกรหัสสินค้า, ชื่อสินค้า และราคาขาย' },
        { status: 400 }
      );
    }

    // Check duplicate code
    const existing = await prisma.product.findUnique({
      where: { code: code.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: `รหัสสินค้า "${code}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || 'ทั่วไป',
        unit: unit?.trim() || 'แก้ว',
        price: Number(price),
        cost: cost !== undefined && cost !== '' ? Number(cost) : null,
        minStock: minStock !== undefined && minStock !== '' ? Number(minStock) : 10,
        status: status || 'ACTIVE',
      },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'เพิ่มสินค้าใหม่เรียบร้อยแล้ว',
      product,
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มสินค้า: ' + error.message },
      { status: 500 }
    );
  }
}

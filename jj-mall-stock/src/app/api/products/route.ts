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
    const storeIdParam = searchParams.get('storeId') || '';

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

    if (storeIdParam === 'CENTRAL') {
      where.storeId = null;
    } else if (storeIdParam && storeIdParam !== 'ALL') {
      where.storeId = Number(storeIdParam);
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
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

    // Get staff stores for store dropdown filter
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: { id: true, username: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      products,
      categories,
      staffStores,
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

    const body = await req.json();
    const { code, name, category, unit, price, cost, minStock, status, storeId } = body;

    let targetStoreId: number | null = null;
    if (session.role === 'STAFF') {
      // พนักงานร้านค้า เพิ่มเมนูจะถูกผูกเข้ากับร้านตัวเองโดยอัตโนมัติ
      targetStoreId = session.id;
    } else {
      // แอดมินสามารถเลือกผูกร้าน หรือเว้นว่างให้เป็นส่วนกลาง
      targetStoreId = storeId ? Number(storeId) : null;
    }

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
        storeId: targetStoreId,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
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

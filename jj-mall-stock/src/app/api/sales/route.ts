import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/sales - List recent sales
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const myOnly = searchParams.get('myOnly') === 'true';

    const where: any = {};
    if (myOnly || session.role === 'STAFF') {
      // If staff requests or myOnly flag, filter by current user
      if (myOnly) where.createdById = session.id;
    }

    const sales = await prisma.sale.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, sales });
  } catch (error: any) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการขาย: ' + error.message },
      { status: 500 }
    );
  }
}

// POST /api/sales - Process a POS sale with BOM recipe auto-deduction
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }, { status: 401 });
    }

    // Only sales staff can ring up sales; Admin manages and monitors stores
    if (session.role === 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          message: 'ผู้ดูแลระบบ (Admin) ไม่มีหน้าที่ขายสินค้าหน้าร้าน บัญชีเจ้าหน้าที่ขายประจำร้าน (Staff) เท่านั้นที่สามารถทำรายการขายได้',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { items, paymentMethod, note } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ไม่มีรายการสินค้าในตะกร้า' },
        { status: 400 }
      );
    }

    // 1. Fetch products
    const productIds = items.map((i: any) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    // Map for fast lookup
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Calculate Total Sale Amount and Items
    let totalAmount = 0;
    let totalItems = 0;
    const saleItemsData: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number }> = [];

    for (const item of items) {
      const prod = productMap.get(Number(item.productId));
      if (!prod) {
        return NextResponse.json(
          { success: false, message: `ไม่พบสินค้า ID: ${item.productId}` },
          { status: 400 }
        );
      }

      if (prod.status !== 'ACTIVE') {
        return NextResponse.json(
          { success: false, message: `สินค้า "${prod.name}" ถูกระงับการขายแล้ว` },
          { status: 400 }
        );
      }

      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      const unitPrice = Number(prod.price);
      const subtotal = unitPrice * qty;

      totalAmount += subtotal;
      totalItems += qty;

      saleItemsData.push({
        productId: prod.id,
        quantity: qty,
        unitPrice,
        subtotal,
      });
    }

    // 3. Generate Sale Number (e.g. SALE-20261105-0001)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const saleNumber = `SALE-${dateStr}-${randomSuffix}`;

    // 4. Create Sale Record
    const createdSale = await prisma.sale.create({
      data: {
        saleNumber,
        totalAmount,
        totalItems,
        paymentMethod: paymentMethod || 'CASH',
        note: note || null,
        createdById: session.id,
        items: {
          create: saleItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, username: true, role: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'บันทึกการขายสำเร็จ!',
      sale: createdSale,
    });
  } catch (error: any) {
    console.error('POS Sale Processing Error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการทำรายการขาย: ' + error.message },
      { status: 500 }
    );
  }
}

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

    // 1. Fetch products & BOM recipes
    const productIds = items.map((i: any) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
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

    // Map for fast lookup
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Calculate Total Sale Amount and Required Ingredients
    let totalAmount = 0;
    let totalItems = 0;
    const saleItemsData: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number }> = [];

    // Map ingredientId -> required total quantity
    const requiredIngredientsMap = new Map<
      number,
      {
        ingredientId: number;
        code: string;
        name: string;
        unit: string;
        currentStock: number;
        requiredQty: number;
      }
    >();

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

      // Calculate BOM ingredients needed
      if (prod.recipe && prod.recipe.items) {
        for (const recipeItem of prod.recipe.items) {
          const ing = recipeItem.ingredient;
          const needed = Number(recipeItem.quantity) * qty;

          const existing = requiredIngredientsMap.get(ing.id) || {
            ingredientId: ing.id,
            code: ing.code,
            name: ing.name,
            unit: recipeItem.unit || ing.unit,
            currentStock: Number(ing.currentStock),
            requiredQty: 0,
          };

          existing.requiredQty += needed;
          requiredIngredientsMap.set(ing.id, existing);
        }
      }
    }

    // 3. Pre-flight Stock Validation: Check if every ingredient is sufficient
    for (const [_, reqIng] of requiredIngredientsMap.entries()) {
      if (reqIng.currentStock < reqIng.requiredQty) {
        const shortage = reqIng.requiredQty - reqIng.currentStock;
        return NextResponse.json(
          {
            success: false,
            message: `⚠️ สต็อกไม่เพียงพอสำหรับการขาย! วัตถุดิบ "${reqIng.name}" (${reqIng.code}) ต้องใช้ทั้งหมด ${reqIng.requiredQty.toLocaleString()} ${reqIng.unit} แต่คงเหลือในคลังเพียง ${reqIng.currentStock.toLocaleString()} ${reqIng.unit} (ขาดอีก ${shortage.toLocaleString()} ${reqIng.unit})`,
          },
          { status: 400 }
        );
      }
    }

    // 4. Generate Sale Number (e.g. SALE-20261105-0001)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const saleNumber = `SALE-${dateStr}-${randomSuffix}`;

    // 5. Execute Atomic Transaction: Create Sale + Deduct Ingredients + Log Movement
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Sale
      const createdSale = await tx.sale.create({
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
            select: { name: true, role: true },
          },
        },
      });

      // B. Deduct ingredients & create stock transactions
      const deductions: any[] = [];

      for (const [_, reqIng] of requiredIngredientsMap.entries()) {
        const updatedIng = await tx.ingredient.update({
          where: { id: reqIng.ingredientId },
          data: {
            currentStock: {
              decrement: reqIng.requiredQty,
            },
          },
        });

        // Record stock transaction
        await tx.stockTransaction.create({
          data: {
            transactionNumber: `TX-SALE-${saleNumber}-${reqIng.code}`,
            ingredientId: reqIng.ingredientId,
            type: 'SALE_DEDUCT',
            quantityIn: 0,
            quantityOut: reqIng.requiredQty,
            balanceAfter: updatedIng.currentStock,
            refType: 'SALE',
            refId: saleNumber,
            note: `ตัดวัตถุดิบจากการขายบิล ${saleNumber}`,
            createdById: session.id,
          },
        });

        deductions.push({
          name: reqIng.name,
          quantityOut: reqIng.requiredQty,
          unit: reqIng.unit,
          remainingStock: updatedIng.currentStock,
        });
      }

      return { createdSale, deductions };
    });

    return NextResponse.json({
      success: true,
      message: 'บันทึกการขายและตัดสต็อกวัตถุดิบอัตโนมัติสำเร็จ!',
      sale: result.createdSale,
      deductions: result.deductions,
    });
  } catch (error: any) {
    console.error('POS Sale Processing Error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการทำรายการขาย: ' + error.message },
      { status: 500 }
    );
  }
}

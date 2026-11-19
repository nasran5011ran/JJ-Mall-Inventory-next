import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateStoreReconciliation } from '@/lib/store-stock';

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

    const andConditions: any[] = [];

    // 1. Store filtering:
    if (session.role === 'STAFF') {
      // พนักงานร้านค้า จะเห็นเฉพาะเมนูของสาขาตัวเอง หรือเมนูส่วนกลาง (storeId = null) เท่านั้น
      // จะไม่เห็นเมนูของร้านสาขาอื่นเด็ดขาด
      andConditions.push({
        OR: [
          { storeId: session.id },
          { storeId: null },
        ],
      });
    } else {
      // ผู้ดูแลระบบ (Admin) สามารถดูทั้งหมด หรือเลือกกรองตามร้านค้าได้
      if (storeIdParam === 'CENTRAL') {
        andConditions.push({ storeId: null });
      } else if (storeIdParam && storeIdParam !== 'ALL') {
        // เมื่อกรองตามร้านค้า เมนูส่วนกลาง (storeId: null) จะแสดงในร้านค้าด้วย
        andConditions.push({
          OR: [
            { storeId: Number(storeIdParam) },
            { storeId: null },
          ],
        });
      }
    }

    // 2. Search condition:
    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search } },
          { name: { contains: search } },
        ],
      });
    }

    // 3. Category condition:
    if (category && category !== 'ALL') {
      andConditions.push({ category });
    }

    // 4. Status condition:
    if (status && status !== 'ALL') {
      andConditions.push({ status });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

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

    // If all store accounts are suspended (INACTIVE), hide all products
    if (staffStores.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        categories: [],
        staffStores: [],
      });
    }

    const activeStoreIds = new Set(staffStores.map((s) => s.id));
    const visibleProducts = products.filter(
      (p) => !p.storeId || activeStoreIds.has(p.storeId)
    );

    // Calculate in-store ingredient balances for STAFF or requested store
    let targetStoreId: number | null = null;
    if (session.role === 'STAFF') {
      targetStoreId = session.id;
    } else if (storeIdParam && storeIdParam !== 'ALL' && storeIdParam !== 'CENTRAL') {
      targetStoreId = Number(storeIdParam);
    }

    let storeStockMap: Map<number, number> | null = null;
    if (targetStoreId) {
      try {
        const storeBalances = await calculateStoreReconciliation(targetStoreId);
        storeStockMap = new Map(storeBalances.map((b) => [b.ingredientId, b.expectedStock]));
      } catch (err) {
        console.error('Error calculating store reconciliation in GET /api/products:', err);
      }
    }

    const formattedProducts = visibleProducts.map((p) => {
      if (!p.recipe?.items) return p;
      return {
        ...p,
        recipe: {
          ...p.recipe,
          items: p.recipe.items.map((item) => {
            const inStore = storeStockMap
              ? (storeStockMap.get(item.ingredient.id) ?? 0)
              : Number(item.ingredient.currentStock);
            return {
              ...item,
              ingredient: {
                ...item.ingredient,
                storeStock: inStore,
                currentStock: inStore,
              },
            };
          }),
        },
      };
    });

    return NextResponse.json({
      success: true,
      products: formattedProducts,
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
    const { code, name, category, unit, price, cost, minStock, status, storeId, image } = body;

    let targetStoreId: number | null = null;
    if (session.role === 'STAFF') {
      // พนักงานร้านค้า เพิ่มเมนูจะถูกผูกเข้ากับร้านตัวเองโดยอัตโนมัติ
      targetStoreId = session.id;
    } else {
      // แอดมินสามารถเลือกผูกร้าน หรือเว้นว่างให้เป็นส่วนกลาง (แสดงทุกร้าน)
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

    // Check duplicate name
    const trimmedName = name.trim();
    const existingName = await prisma.product.findFirst({
      where: {
        name: trimmedName,
        ...(targetStoreId !== null ? { storeId: targetStoreId } : {}),
      },
    });

    if (existingName) {
      return NextResponse.json(
        { success: false, message: `มีสินค้าชื่อ "${trimmedName}" (รหัส: ${existingName.code}) อยู่ในระบบแล้ว ไม่สามารถเพิ่มชื่อซ้ำได้` },
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
        image: image || null,
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

    // แจ้งเตือนแอดมินเมื่อพนักงานประจำร้านค้าทำการเพิ่มเมนูใหม่
    if (session.role === 'STAFF') {
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'MENU',
            type: 'MENU_CREATE',
            severity: 'INFO',
            title: `ร้านค้า "${session.name}" ได้เพิ่มเมนูใหม่: ${product.name}`,
            description: `รหัสสินค้า ${product.code} ราคาขาย ฿${product.price} หมวดหมู่ ${product.category} (หน่วย: ${product.unit})`,
            actionUrl: `/admin/products?search=${encodeURIComponent(product.code)}`,
            actionLabel: 'ตรวจสอบเมนูสินค้า',
            storeId: session.id,
            storeName: session.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (e) {
        console.error('Failed to log system notification:', e);
      }
    }

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

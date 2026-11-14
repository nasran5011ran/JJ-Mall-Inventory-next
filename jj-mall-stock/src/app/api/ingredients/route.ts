import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateStoreReconciliation } from '@/lib/store-stock';

// GET /api/ingredients - List all ingredients with search and filters
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มวัตถุดิบได้' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const stockStatus = searchParams.get('stockStatus') || '';

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

    const ingredients = await prisma.ingredient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            recipeItems: true,
            stockTransactions: true,
          },
        },
      },
    });

    // Extract distinct categories
    const all = await prisma.ingredient.findMany({
      select: { category: true },
      distinct: ['category'],
    });
    const categories = all.map((i) => i.category).filter(Boolean);

    // Fetch active staff stores for store-level stock selection
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: { id: true, name: true, username: true },
      orderBy: { id: 'asc' },
    });

    // Compute store balances for each store
    const storeBalances: Record<number, any[]> = {};
    for (const store of staffStores) {
      storeBalances[store.id] = await calculateStoreReconciliation(store.id);
    }

    return NextResponse.json({
      success: true,
      ingredients,
      categories,
      staffStores,
      storeBalances,
    });
  } catch (error: any) {
    console.error('Error fetching ingredients:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลวัตถุดิบ: ' + error.message },
      { status: 500 }
    );
  }
}

// POST /api/ingredients - Create a new ingredient
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มวัตถุดิบได้' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { code, name, category, unit, currentStock, minStock, costPerUnit, status } = body;

    if (!code || !name || !unit) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกรหัสวัตถุดิบ, ชื่อวัตถุดิบ และหน่วยนับ' },
        { status: 400 }
      );
    }

    // Check duplicate code
    const existing = await prisma.ingredient.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: `รหัสวัตถุดิบ "${code}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` },
        { status: 409 }
      );
    }

    // Check duplicate name
    const existingName = await prisma.ingredient.findFirst({
      where: { name: name.trim() },
    });

    if (existingName) {
      return NextResponse.json(
        { success: false, message: `ชื่อวัตถุดิบ "${name.trim()}" มีอยู่ในระบบแล้ว (รหัส: ${existingName.code}) ไม่สามารถเพิ่มซ้ำได้` },
        { status: 409 }
      );
    }

    const initialStock = currentStock !== undefined && currentStock !== '' ? Number(currentStock) : 0;
    const safetyStock = minStock !== undefined && minStock !== '' ? Number(minStock) : 0;
    const unitCost = costPerUnit !== undefined && costPerUnit !== '' ? Number(costPerUnit) : 0;

    const ingredient = await prisma.ingredient.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || 'ทั่วไป',
        unit: unit.trim(),
        currentStock: initialStock,
        minStock: safetyStock,
        costPerUnit: unitCost,
        status: status || 'ACTIVE',
      },
      include: {
        _count: {
          select: {
            recipeItems: true,
            stockTransactions: true,
          },
        },
      },
    });

    // Record initial stock transaction if initialStock > 0
    if (initialStock > 0) {
      await prisma.stockTransaction.create({
        data: {
          transactionNumber: `TX-INIT-${ingredient.code}-${Date.now().toString().slice(-4)}`,
          ingredientId: ingredient.id,
          type: 'PURCHASE_IN',
          quantityIn: initialStock,
          quantityOut: 0,
          balanceAfter: initialStock,
          refType: 'INITIAL',
          note: 'ยอดยกมาเริ่มต้นสร้างวัตถุดิบ',
          createdById: session.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'เพิ่มวัตถุดิบใหม่เรียบร้อยแล้ว',
      ingredient,
    });
  } catch (error: any) {
    console.error('Error creating ingredient:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มวัตถุดิบ: ' + error.message },
      { status: 500 }
    );
  }
}

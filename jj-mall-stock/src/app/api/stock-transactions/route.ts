import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'ALL';
    const ingredientId = searchParams.get('ingredientId') || 'ALL';
    const dateRange = searchParams.get('dateRange') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '150', 10);

    const whereClause: any = {};

    // Filter by type
    if (type !== 'ALL') {
      if (type === 'ADJUSTMENTS') {
        whereClause.type = { in: [TransactionType.ADJUST_ADD, TransactionType.ADJUST_SUB] };
      } else {
        whereClause.type = type as TransactionType;
      }
    }

    // Filter by ingredient
    if (ingredientId !== 'ALL') {
      whereClause.ingredientId = Number(ingredientId);
    }

    // Filter by date range
    if (dateRange !== 'ALL') {
      const now = new Date();
      if (dateRange === 'TODAY') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        whereClause.createdAt = { gte: startOfToday };
      } else if (dateRange === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        whereClause.createdAt = { gte: weekAgo };
      } else if (dateRange === 'MONTH') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        whereClause.createdAt = { gte: monthAgo };
      }
    }

    const [activeStores, inactiveStores] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'STAFF', status: 'ACTIVE' },
        select: { id: true, name: true, username: true },
      }),
      prisma.user.findMany({
        where: { role: 'STAFF', status: 'INACTIVE' },
        select: { id: true, name: true, username: true },
      }),
    ]);

    if (activeStores.length === 0) {
      return NextResponse.json({
        success: true,
        transactions: [],
        ingredients: [],
        metrics: {
          totalTransactions: 0,
          purchaseCount: 0,
          saleDeductCount: 0,
          transferCount: 0,
          damageCount: 0,
          adjustCount: 0,
          physicalCount: 0,
          totalQtyIn: 0,
          totalQtyOut: 0,
        },
      });
    }

    const inactiveIds = new Set(inactiveStores.map((s) => s.id));
    const isFromInactiveStore = (tx: { createdById: number; note?: string | null }) => {
      if (inactiveIds.has(tx.createdById)) return true;
      for (const inact of inactiveStores) {
        if (
          tx.note?.includes(`[STORE_ID:${inact.id}]`) ||
          tx.note?.includes(`@${inact.username}`) ||
          tx.note?.includes(inact.name)
        ) {
          return true;
        }
      }
      return false;
    };

    // 1. Fetch transactions with relations
    const rawTransactions = await prisma.stockTransaction.findMany({
      where: whereClause,
      include: {
        ingredient: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            unit: true,
            costPerUnit: true,
            currentStock: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const transactions = rawTransactions.filter((tx) => !isFromInactiveStore(tx));

    // 2. Fetch all active ingredients for filter dropdown
    const ingredients = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        currentStock: true,
      },
      orderBy: { name: 'asc' },
    });

    // 3. Compute KPI metrics across all visible transactions
    const rawAllTxTypes = await prisma.stockTransaction.findMany({
      select: { type: true, quantityIn: true, quantityOut: true, createdById: true, note: true },
    });
    const allTxTypes = rawAllTxTypes.filter((tx) => !isFromInactiveStore(tx));

    let purchaseCount = 0;
    let saleDeductCount = 0;
    let adjustCount = 0;
    let physicalCount = 0;
    let transferCount = 0;
    let damageCount = 0;
    let totalQtyIn = 0;
    let totalQtyOut = 0;

    allTxTypes.forEach((tx) => {
      totalQtyIn += Number(tx.quantityIn);
      totalQtyOut += Number(tx.quantityOut);

      if (tx.type === 'PURCHASE_IN') purchaseCount++;
      else if (tx.type === 'SALE_DEDUCT') saleDeductCount++;
      else if (tx.type === 'TRANSFER_OUT') transferCount++;
      else if (tx.type === 'DAMAGE_OUT') damageCount++;
      else if (tx.type === 'ADJUST_ADD' || tx.type === 'ADJUST_SUB') adjustCount++;
      else if (tx.type === 'PHYSICAL_COUNT') physicalCount++;
    });

    return NextResponse.json({
      success: true,
      transactions,
      ingredients,
      metrics: {
        totalTransactions: allTxTypes.length,
        purchaseCount,
        saleDeductCount,
        transferCount,
        damageCount,
        adjustCount,
        physicalCount,
        totalQtyIn,
        totalQtyOut,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock transactions:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติสต็อก: ' + error.message },
      { status: 500 }
    );
  }
}

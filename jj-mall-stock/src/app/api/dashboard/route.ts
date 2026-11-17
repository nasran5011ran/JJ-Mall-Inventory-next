import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateStoreReconciliation } from '@/lib/store-stock';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Basic Counts & Store Stock Reconciliation
    const [totalProducts, totalIngredients, stores] = await Promise.all([
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.ingredient.count({ where: { status: 'ACTIVE' } }),
      prisma.user.findMany({
        where: { role: 'STAFF', status: 'ACTIVE' },
        select: { id: true, name: true, username: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    const primaryStore = stores[0] || null;
    const storeBalances = primaryStore
      ? await calculateStoreReconciliation(primaryStore.id)
      : [];

    let inStockCount = 0;
    let outOfStockCount = 0;
    const lowStockList: any[] = [];

    storeBalances.forEach((b) => {
      const stock = Number(b.expectedStock || 0);
      if (stock <= 0) {
        outOfStockCount++;
        lowStockList.push({
          id: b.ingredientId,
          code: b.code,
          name: b.name,
          unit: b.unit,
          currentStock: stock,
          storeName: primaryStore?.name || 'หน้าร้าน',
          isOutOfStock: true,
        });
      } else {
        inStockCount++;
      }
    });

    // 2. Sales Today
    const todaySales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const todaySalesAmount = todaySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const todayCupsSold = todaySales.reduce((sum, s) => sum + s.totalItems, 0);

    // 3. Ingredients Used Today (from Stock Transactions: SALE_DEDUCT)
    const todayStockDeducts = await prisma.stockTransaction.findMany({
      where: {
        type: 'SALE_DEDUCT',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        ingredient: true,
      },
    });

    const ingredientsUsedMap = new Map<number, { name: string; code: string; unit: string; totalUsed: number }>();
    todayStockDeducts.forEach((tx) => {
      const current = ingredientsUsedMap.get(tx.ingredientId) || {
        name: tx.ingredient.name,
        code: tx.ingredient.code,
        unit: tx.ingredient.unit,
        totalUsed: 0,
      };
      current.totalUsed += Number(tx.quantityOut);
      ingredientsUsedMap.set(tx.ingredientId, current);
    });

    const topIngredientsUsed = Array.from(ingredientsUsedMap.values())
      .sort((a, b) => b.totalUsed - a.totalUsed)
      .slice(0, 5);

    // 4. Pending Adjustments & Stock Discrepancies
    const [pendingAdjustmentsCount, discrepancyCount] = await Promise.all([
      prisma.stockAdjustment.count({ where: { status: 'PENDING' } }),
      prisma.stockCountItem.count({
        where: {
          diffQuantity: { not: 0 },
        },
      }),
    ]);

    // 5. Last 7 Days Sales Trend
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);

      const daySales = await prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { totalAmount: true, totalItems: true },
      });

      const dayTotal = daySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
      const dayCups = daySales.reduce((sum, s) => sum + s.totalItems, 0);

      const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const dayLabel = `${thaiDays[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

      salesTrend.push({
        date: d.toISOString().split('T')[0],
        label: i === 0 ? 'วันนี้' : i === 1 ? 'เมื่อวาน' : dayLabel,
        total: dayTotal,
        cups: dayCups,
      });
    }

    // 6. Top Selling Products
    const allSaleItems = await prisma.saleItem.findMany({
      include: { product: true },
    });

    const productSalesMap = new Map<number, { name: string; code: string; unit: string; totalQty: number; totalAmount: number }>();
    allSaleItems.forEach((item) => {
      const current = productSalesMap.get(item.productId) || {
        name: item.product.name,
        code: item.product.code,
        unit: item.product.unit,
        totalQty: 0,
        totalAmount: 0,
      };
      current.totalQty += item.quantity;
      current.totalAmount += Number(item.subtotal);
      productSalesMap.set(item.productId, current);
    });

    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);

    // 7. Recent 5 Sales
    const recentSales = await prisma.sale.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true, username: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalProducts,
          totalIngredients,
          inStockIngredients: inStockCount,
          lowStockIngredients: 0,
          outOfStockIngredients: outOfStockCount,
          todaySalesAmount,
          todayCupsSold,
          todayIngredientsUsedCount: ingredientsUsedMap.size,
          discrepancyCount,
          pendingAdjustmentsCount,
        },
        salesTrend,
        topSellingProducts,
        topIngredientsUsed,
        lowStockList: lowStockList.slice(0, 5),
        recentSales,
      },
    });
  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch dashboard data: ' + error.message },
      { status: 500 }
    );
  }
}

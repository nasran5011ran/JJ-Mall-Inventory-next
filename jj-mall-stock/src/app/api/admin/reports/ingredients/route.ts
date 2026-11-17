import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';
import { calculateStoreReconciliation } from '@/lib/store-stock';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงรายงานวัตถุดิบ (Admin Only)' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30days';
    const category = searchParams.get('category') || 'ALL';
    const storeIdParam = searchParams.get('storeId') || '';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Determine date range
    let dateFilter: { gte?: Date; lte?: Date } = {};
    const now = new Date();

    if (startDateParam && endDateParam) {
      const s = new Date(startDateParam);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDateParam);
      e.setHours(23, 59, 59, 999);
      dateFilter = { gte: s, lte: e };
    } else if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      dateFilter = { gte: todayStart };
    } else if (period === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: sevenDaysAgo };
    } else if (period === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: thirtyDaysAgo };
    } // 'all' means no dateFilter

    // 1. Fetch active STAFF stores
    const stores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: { id: true, name: true, username: true },
      orderBy: { id: 'asc' },
    });

    const selectedStore =
      (storeIdParam ? stores.find((s) => String(s.id) === String(storeIdParam)) : null) ||
      stores[0] ||
      null;

    // 2. Calculate real store reconciliation balances (no central warehouse stock)
    const storeBalances = selectedStore
      ? await calculateStoreReconciliation(selectedStore.id)
      : [];

    // 3. Distinct categories from store ingredients
    const categories = Array.from(
      new Set(storeBalances.map((b) => b.category || 'ทั่วไป').filter(Boolean))
    );

    // 4. Filter by category if requested
    const filteredBalances =
      category === 'ALL'
        ? storeBalances
        : storeBalances.filter((b) => (b.category || 'ทั่วไป') === category);

    // 5. Fetch store transactions within dateFilter for period-specific usage/inbound/waste if dateFilter is active
    const hasDateFilter = Boolean(dateFilter.gte || dateFilter.lte);
    const periodInboundMap = new Map<number, number>();
    const periodSalesMap = new Map<number, number>();
    const periodWasteMap = new Map<number, number>();

    if (hasDateFilter && selectedStore) {
      const periodTxs = await prisma.stockTransaction.findMany({
        where: {
          createdAt: dateFilter,
          OR: [
            { createdById: selectedStore.id },
            { note: { contains: `[STORE_ID:${selectedStore.id}]` } },
            { note: { contains: `@${selectedStore.username}` } },
            { note: { contains: selectedStore.name } },
          ],
        },
      });

      for (const tx of periodTxs) {
        if (tx.type === TransactionType.PURCHASE_IN) {
          periodInboundMap.set(
            tx.ingredientId,
            (periodInboundMap.get(tx.ingredientId) || 0) + Number(tx.quantityIn)
          );
        } else if (tx.type === TransactionType.TRANSFER_OUT) {
          periodInboundMap.set(
            tx.ingredientId,
            (periodInboundMap.get(tx.ingredientId) || 0) + Number(tx.quantityOut)
          );
        } else if (tx.type === TransactionType.ADJUST_ADD) {
          periodInboundMap.set(
            tx.ingredientId,
            (periodInboundMap.get(tx.ingredientId) || 0) + Number(tx.quantityIn)
          );
        } else if (tx.type === TransactionType.SALE_DEDUCT) {
          periodSalesMap.set(
            tx.ingredientId,
            (periodSalesMap.get(tx.ingredientId) || 0) + Number(tx.quantityOut)
          );
        } else if (
          tx.type === TransactionType.DAMAGE_OUT ||
          tx.type === TransactionType.ADJUST_SUB
        ) {
          periodWasteMap.set(
            tx.ingredientId,
            (periodWasteMap.get(tx.ingredientId) || 0) + Number(tx.quantityOut)
          );
        }
      }
    }

    // 6. Calculate stats per ingredient using real store stock
    let totalUsedCost = 0;
    let totalWasteCost = 0;
    let totalInboundCost = 0;
    let totalInventoryValue = 0;
    let totalUsedVolume = 0;

    const items = filteredBalances.map((b) => {
      const id = b.ingredientId;
      const cost = Number(b.costPerUnit || 0);
      const currStock = Number(b.expectedStock || 0);
      const openingStock = Number(b.openingQuantity || 0);

      // Use store reconciliation totals, or period-filtered store totals when a short period ('today' / '7days') is selected
      const inboundQty =
        period === 'today' || period === '7days'
          ? periodInboundMap.get(id) ?? Number(b.inboundQuantity || 0)
          : Number(b.inboundQuantity || 0);

      const salesUsage =
        period === 'today' || period === '7days'
          ? periodSalesMap.get(id) ?? Number(b.salesQuantity || 0)
          : Number(b.salesQuantity || 0);

      const wasteQty =
        period === 'today' || period === '7days'
          ? periodWasteMap.get(id) ?? Number(b.wasteQuantity || 0)
          : Number(b.wasteQuantity || 0);

      // Financials
      const usedCost = salesUsage * cost;
      const wasteCost = wasteQty * cost;
      const inboundCost = inboundQty * cost;
      const inventoryValue = currStock * cost;

      const totalOutflow = salesUsage + wasteQty;
      const wastePercent = totalOutflow > 0 ? (wasteQty / totalOutflow) * 100 : 0;

      totalUsedCost += usedCost;
      totalWasteCost += wasteCost;
      totalInboundCost += inboundCost;
      totalInventoryValue += inventoryValue;
      totalUsedVolume += salesUsage;

      return {
        id,
        code: b.code,
        name: b.name,
        category: b.category || 'ทั่วไป',
        unit: b.unit,
        costPerUnit: cost,
        openingStock: parseFloat(openingStock.toFixed(2)),
        inboundQty: parseFloat(inboundQty.toFixed(2)),
        salesUsage: parseFloat(salesUsage.toFixed(2)),
        wasteQty: parseFloat(wasteQty.toFixed(2)),
        transferOut: 0,
        currentStock: parseFloat(currStock.toFixed(2)),
        minStock: 0,
        usedCost: parseFloat(usedCost.toFixed(2)),
        wasteCost: parseFloat(wasteCost.toFixed(2)),
        inventoryValue: parseFloat(inventoryValue.toFixed(2)),
        wastePercent: parseFloat(wastePercent.toFixed(1)),
        storeName: selectedStore?.name || 'หน้าร้าน',
      };
    });

    // 7. Top 5 ingredients by cost used
    const topUsed = [...items]
      .filter((i) => i.salesUsage > 0 || i.usedCost > 0)
      .sort((a, b) => b.usedCost - a.usedCost)
      .slice(0, 5);

    // 8. Category breakdown
    const catMap = new Map<string, { count: number; usedCost: number; inventoryValue: number }>();
    items.forEach((item) => {
      const catKey = item.category || 'ทั่วไป';
      const c = catMap.get(catKey) || { count: 0, usedCost: 0, inventoryValue: 0 };
      c.count += 1;
      c.usedCost += item.usedCost;
      c.inventoryValue += item.inventoryValue;
      catMap.set(catKey, c);
    });

    const categoryBreakdown = Array.from(catMap.entries()).map(([cat, data]) => ({
      category: cat,
      count: data.count,
      usedCost: parseFloat(data.usedCost.toFixed(2)),
      inventoryValue: parseFloat(data.inventoryValue.toFixed(2)),
      percentage: totalUsedCost > 0 ? parseFloat(((data.usedCost / totalUsedCost) * 100).toFixed(1)) : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        stores,
        selectedStore,
        items,
        summary: {
          totalIngredientsCount: items.length,
          totalUsedCost: parseFloat(totalUsedCost.toFixed(2)),
          totalUsedVolume: parseFloat(totalUsedVolume.toFixed(2)),
          totalWasteCost: parseFloat(totalWasteCost.toFixed(2)),
          totalInboundCost: parseFloat(totalInboundCost.toFixed(2)),
          totalInventoryValue: parseFloat(totalInventoryValue.toFixed(2)),
          topUsedIngredients: topUsed,
          categoryBreakdown,
        },
        categories,
        filter: {
          period,
          category,
          storeId: selectedStore?.id || null,
          startDate: startDateParam,
          endDate: endDateParam,
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating ingredients report:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงรายงานวัตถุดิบ: ' + error.message },
      { status: 500 }
    );
  }
}

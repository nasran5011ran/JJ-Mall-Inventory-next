import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';

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

    // 1. Fetch active ingredients
    const ingredientWhere: any = { status: 'ACTIVE' };
    if (category !== 'ALL') {
      ingredientWhere.category = category;
    }

    const ingredients = await prisma.ingredient.findMany({
      where: ingredientWhere,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // 2. Fetch all categories for filter options
    const allIngredients = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE' },
      select: { category: true },
      distinct: ['category'],
    });
    const categories = allIngredients.map((i) => i.category).filter(Boolean);

    // 3. Fetch transaction aggregates within dateFilter
    const txWhere: any = {};
    if (dateFilter.gte || dateFilter.lte) {
      txWhere.createdAt = dateFilter;
    }

    const txGrouped = await prisma.stockTransaction.groupBy({
      by: ['ingredientId', 'type'],
      where: txWhere,
      _sum: {
        quantityIn: true,
        quantityOut: true,
      },
    });

    // Create lookup map
    const txMap = new Map<string, number>();
    txGrouped.forEach((row) => {
      const inVal = Number(row._sum.quantityIn || 0);
      const outVal = Number(row._sum.quantityOut || 0);
      txMap.set(`${row.ingredientId}_${row.type}_IN`, inVal);
      txMap.set(`${row.ingredientId}_${row.type}_OUT`, outVal);
    });

    // 4. Calculate stats per ingredient
    let totalUsedCost = 0;
    let totalWasteCost = 0;
    let totalInboundCost = 0;
    let totalInventoryValue = 0;
    let totalUsedVolume = 0;

    const items = ingredients.map((ing) => {
      const id = ing.id;
      const cost = Number(ing.costPerUnit || 0);
      const currStock = Number(ing.currentStock || 0);
      const minStock = Number(ing.minStock || 0);

      // Quantities
      const purchaseIn = txMap.get(`${id}_${TransactionType.PURCHASE_IN}_IN`) || 0;
      const adjustAdd = txMap.get(`${id}_${TransactionType.ADJUST_ADD}_IN`) || 0;
      const inboundQty = purchaseIn + adjustAdd;

      const salesUsage = txMap.get(`${id}_${TransactionType.SALE_DEDUCT}_OUT`) || 0;
      const damageOut = txMap.get(`${id}_${TransactionType.DAMAGE_OUT}_OUT`) || 0;
      const adjustSub = txMap.get(`${id}_${TransactionType.ADJUST_SUB}_OUT`) || 0;
      const wasteQty = damageOut + adjustSub;
      const transferOut = txMap.get(`${id}_${TransactionType.TRANSFER_OUT}_OUT`) || 0;

      // Opening stock estimate
      const openingStock = Math.max(0, currStock - inboundQty + salesUsage + wasteQty + transferOut);

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
        id: ing.id,
        code: ing.code,
        name: ing.name,
        category: ing.category,
        unit: ing.unit,
        costPerUnit: cost,
        openingStock: parseFloat(openingStock.toFixed(2)),
        inboundQty: parseFloat(inboundQty.toFixed(2)),
        salesUsage: parseFloat(salesUsage.toFixed(2)),
        wasteQty: parseFloat(wasteQty.toFixed(2)),
        transferOut: parseFloat(transferOut.toFixed(2)),
        currentStock: parseFloat(currStock.toFixed(2)),
        minStock: parseFloat(minStock.toFixed(2)),
        usedCost: parseFloat(usedCost.toFixed(2)),
        wasteCost: parseFloat(wasteCost.toFixed(2)),
        inventoryValue: parseFloat(inventoryValue.toFixed(2)),
        wastePercent: parseFloat(wastePercent.toFixed(1)),
      };
    });

    // 5. Top 5 ingredients by cost used
    const topUsed = [...items]
      .filter((i) => i.salesUsage > 0 || i.usedCost > 0)
      .sort((a, b) => b.usedCost - a.usedCost)
      .slice(0, 5);

    // 6. Category breakdown
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

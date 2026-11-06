import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงรายงานสต็อก (Admin Only)' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const categoryFilter = searchParams.get('category') || 'ALL';
    const statusFilter = searchParams.get('status') || 'ALL'; // ALL | CRITICAL | LOW | OPTIMAL | OVERSTOCK

    // 1. Fetch all active ingredients
    const ingredients = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // 2. Fetch usage from StockTransactions in the last 7 days (SALE_DEDUCT)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentDeductions = await prisma.stockTransaction.findMany({
      where: {
        type: TransactionType.SALE_DEDUCT,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        ingredientId: true,
        quantityOut: true,
      },
    });

    // Map total 7-day usage per ingredient
    const usageMap = new Map<number, number>();
    recentDeductions.forEach((tx) => {
      const current = usageMap.get(tx.ingredientId) || 0;
      usageMap.set(tx.ingredientId, current + Number(tx.quantityOut));
    });

    // Also get all-time SALE_DEDUCT if 7-day is empty (for bootstrap demo data)
    const allDeductions = await prisma.stockTransaction.findMany({
      where: { type: TransactionType.SALE_DEDUCT },
      select: { ingredientId: true, quantityOut: true },
    });
    const allTimeUsageMap = new Map<number, number>();
    allDeductions.forEach((tx) => {
      const current = allTimeUsageMap.get(tx.ingredientId) || 0;
      allTimeUsageMap.set(tx.ingredientId, current + Number(tx.quantityOut));
    });

    // 3. Compute DoH, Stock Valuation, and Health Status for each ingredient
    let totalStockValue = 0;
    let criticalCount = 0;
    let lowCount = 0;
    let optimalCount = 0;
    let overstockCount = 0;

    const items = ingredients.map((ing) => {
      const currentStock = Number(ing.currentStock);
      const minStock = Number(ing.minStock);
      const costPerUnit = Number(ing.costPerUnit || 0);
      const totalValue = currentStock * costPerUnit;
      totalStockValue += totalValue;

      // Calculate daily consumption rate (assume 7 days)
      const sevenDayUsage = usageMap.get(ing.id) || 0;
      const allTimeUsage = allTimeUsageMap.get(ing.id) || 0;
      const dailyUsage = sevenDayUsage > 0 ? sevenDayUsage / 7 : allTimeUsage > 0 ? allTimeUsage / 3 : 0;

      // Calculate Days on Hand (DoH)
      let doh = 0;
      if (dailyUsage > 0) {
        doh = Math.round(currentStock / dailyUsage);
      } else {
        // If no sales yet, estimate based on min stock
        doh = currentStock > minStock ? 60 : currentStock > 0 ? 14 : 0;
      }

      // Status classification
      let healthStatus: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'OPTIMAL' | 'OVERSTOCK' = 'OPTIMAL';
      let riskLabel = 'สต็อกปกติ (Optimal)';

      if (currentStock <= 0) {
        healthStatus = 'OUT_OF_STOCK';
        riskLabel = 'สินค้าหมด (Out of Stock)';
        criticalCount++;
      } else if (currentStock < minStock || doh <= 3) {
        healthStatus = 'CRITICAL';
        riskLabel = 'วิกฤต / ต้องสั่งด่วน (Critical)';
        criticalCount++;
      } else if (doh <= 7 || currentStock <= minStock * 1.2) {
        healthStatus = 'LOW';
        riskLabel = 'ใกล้หมด / เฝ้าระวัง (Low Stock)';
        lowCount++;
      } else if (doh > 45) {
        healthStatus = 'OVERSTOCK';
        riskLabel = 'สต็อกเกิน / ทุนจม (Overstock)';
        overstockCount++;
      } else {
        healthStatus = 'OPTIMAL';
        riskLabel = 'สต็อกสมบูรณ์ (Healthy)';
        optimalCount++;
      }

      // Recommended Reorder Amount
      const recommendedReorder =
        healthStatus === 'OUT_OF_STOCK' || healthStatus === 'CRITICAL' || healthStatus === 'LOW'
          ? Math.max(0, minStock * 2 - currentStock)
          : 0;

      return {
        id: ing.id,
        code: ing.code,
        name: ing.name,
        category: ing.category || 'ทั่วไป',
        unit: ing.unit,
        currentStock,
        minStock,
        costPerUnit,
        totalValue,
        dailyUsage: parseFloat(dailyUsage.toFixed(2)),
        doh,
        healthStatus,
        riskLabel,
        recommendedReorder: Math.ceil(recommendedReorder),
      };
    });

    // 4. Distinct categories for filter
    const categories = Array.from(new Set(ingredients.map((i) => i.category || 'ทั่วไป')));

    // 5. Apply filters
    const filteredItems = items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CRITICAL' && item.healthStatus !== 'CRITICAL' && item.healthStatus !== 'OUT_OF_STOCK') return false;
        if (statusFilter === 'LOW' && item.healthStatus !== 'LOW') return false;
        if (statusFilter === 'OPTIMAL' && item.healthStatus !== 'OPTIMAL') return false;
        if (statusFilter === 'OVERSTOCK' && item.healthStatus !== 'OVERSTOCK') return false;
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      items: filteredItems,
      categories,
      kpis: {
        totalIngredients: ingredients.length,
        totalStockValue,
        criticalCount,
        lowCount,
        optimalCount,
        overstockCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock DoH report:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงรายงาน DoH: ' + error.message },
      { status: 500 }
    );
  }
}

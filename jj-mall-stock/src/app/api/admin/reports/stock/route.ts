import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateStoreReconciliation } from '@/lib/store-stock';

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
    const statusFilter = searchParams.get('status') || 'ALL'; // ALL | IN_STOCK | OUT_OF_STOCK
    const storeIdParam = searchParams.get('storeId') || '';

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

    // 2. Calculate store reconciliation balances
    const storeBalances = selectedStore
      ? await calculateStoreReconciliation(selectedStore.id)
      : [];

    let totalStockValue = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;

    const items = storeBalances.map((b) => {
      const currentStock = Number(b.expectedStock || 0);
      const openingQuantity = Number(b.openingQuantity || 0);
      const inboundQuantity = Number(b.inboundQuantity || 0);
      const salesQuantity = Number(b.salesQuantity || 0);
      const wasteQuantity = Number(b.wasteQuantity || 0);
      const totalOutQuantity = salesQuantity + wasteQuantity;
      const costPerUnit = Number(b.costPerUnit || 0);
      const totalValue = currentStock * costPerUnit;
      totalStockValue += totalValue;

      const healthStatus: 'IN_STOCK' | 'OUT_OF_STOCK' =
        currentStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';

      if (healthStatus === 'IN_STOCK') {
        inStockCount++;
      } else {
        outOfStockCount++;
      }

      const riskLabel =
        healthStatus === 'IN_STOCK' ? 'มีสต็อกพร้อมใช้' : 'สต็อกหมด (0)';

      return {
        id: b.ingredientId,
        code: b.code,
        name: b.name,
        category: b.category || 'ทั่วไป',
        unit: b.unit,
        openingQuantity,
        inboundQuantity,
        salesQuantity,
        wasteQuantity,
        totalOutQuantity,
        currentStock,
        costPerUnit,
        totalValue,
        healthStatus,
        riskLabel,
        storeName: selectedStore?.name || 'หน้าร้าน',
      };
    });

    // 3. Distinct categories for filter
    const categories = Array.from(new Set(items.map((i) => i.category || 'ทั่วไป')));

    // 4. Apply filters
    const filteredItems = items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (statusFilter === 'IN_STOCK' && item.healthStatus !== 'IN_STOCK') return false;
      if (statusFilter === 'OUT_OF_STOCK' && item.healthStatus !== 'OUT_OF_STOCK') return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      stores,
      selectedStore,
      items: filteredItems,
      categories,
      kpis: {
        totalIngredients: items.length,
        totalStockValue,
        inStockCount,
        outOfStockCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock report:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงรายงานสต็อก: ' + error.message },
      { status: 500 }
    );
  }
}

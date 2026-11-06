import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';

// GET: Fetch Stock Count history and Active Ingredients
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
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const storeFilter = searchParams.get('storeId') || 'ALL';

    const whereClause: any = {};
    if (storeFilter === 'WAREHOUSE') {
      whereClause.location = 'WAREHOUSE';
    } else if (storeFilter !== 'ALL') {
      whereClause.storeId = Number(storeFilter);
    }

    // 1. Fetch all active ingredients for count sheet
    const ingredients = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        currentStock: true,
        costPerUnit: true,
        minStock: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // 2. Fetch staff stores for destination/location options
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        name: true,
      },
      orderBy: { id: 'asc' },
    });

    // 3. Fetch Stock Count records with items
    const rawStockCounts = await prisma.stockCount.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        items: {
          include: {
            ingredient: {
              select: { id: true, code: true, name: true, unit: true, category: true, costPerUnit: true, currentStock: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 4. Pre-calculate transaction breakdown per ingredient for report columns (Brought Forward, Inbound, Sales, Waste, DoH)
    const txSummary = await prisma.stockTransaction.groupBy({
      by: ['ingredientId', 'type'],
      _sum: { quantityIn: true, quantityOut: true },
    });

    const txMap = new Map<string, number>();
    txSummary.forEach((t) => {
      txMap.set(`${t.ingredientId}_${t.type}_IN`, Number(t._sum.quantityIn || 0));
      txMap.set(`${t.ingredientId}_${t.type}_OUT`, Number(t._sum.quantityOut || 0));
    });

    const stockCounts = rawStockCounts.map((sc) => {
      const enrichedItems = sc.items.map((item) => {
        const ingId = item.ingredientId;
        const inboundQty = (txMap.get(`${ingId}_PURCHASE_IN_IN`) || 0) + (txMap.get(`${ingId}_ADJUST_ADD_IN`) || 0);
        const salesQty = txMap.get(`${ingId}_SALE_DEDUCT_OUT`) || 0;
        const wasteQty = (txMap.get(`${ingId}_ADJUST_SUB_OUT`) || 0) + (txMap.get(`${ingId}_DAMAGE_OUT_OUT`) || 0);
        const sysQty = Number(item.systemQuantity);
        const openingQty = Math.max(0, sysQty - inboundQty + salesQty + wasteQty);
        const dailyRate = salesQty > 0 ? salesQty / 7 : 0;
        const doh = dailyRate > 0 ? parseFloat((sysQty / dailyRate).toFixed(1)) : 0;

        return {
          ...item,
          openingQuantity: openingQty,
          inboundQuantity: inboundQty,
          salesQuantity: salesQty,
          wasteQuantity: wasteQty,
          doh,
        };
      });

      return {
        ...sc,
        items: enrichedItems,
      };
    });

    return NextResponse.json({
      success: true,
      stockCounts,
      ingredients,
      staffStores,
    });
  } catch (error: any) {
    console.error('Error fetching stock counts:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตรวจนับสต็อก: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Record New Stock Count Audit
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      countNumber,
      location = 'WAREHOUSE', // 'WAREHOUSE' | 'STORE'
      storeId = null,
      note,
      syncStock = false,
      items, // Array of { ingredientId: number, actualQuantity: number }
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรายการวัตถุดิบที่ตรวจนับอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Resolve store name
    let storeName = 'คลังสินค้าส่วนกลาง JJ Mall';
    let targetStore: any = null;
    if (location === 'STORE') {
      if (!storeId) {
        return NextResponse.json(
          { success: false, message: 'กรุณาเลือกร้านค้า/จุดขายที่ทำการตรวจนับ' },
          { status: 400 }
        );
      }
      targetStore = await prisma.user.findUnique({
        where: { id: Number(storeId) },
        select: { id: true, name: true, username: true },
      });
      if (targetStore) {
        storeName = `${targetStore.name} (@${targetStore.username})`;
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const finalCountNumber = countNumber && countNumber.trim()
      ? countNumber.trim()
      : `SC-${dateStr}-${randomSuffix}`;

    // Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current ingredients to compare system stock
      const ingredientIds = items.map((i: any) => Number(i.ingredientId));
      const dbIngredients = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds } },
      });
      const ingMap = new Map<number, any>();
      dbIngredients.forEach((ing) => ingMap.set(ing.id, ing));

      // 2. Prepare items data
      const countItemsData: any[] = [];
      const stockUpdates: { id: number; newStock: number; diff: number; ing: any }[] = [];

      for (const item of items) {
        const ingId = Number(item.ingredientId);
        const actualQty = parseFloat(item.actualQuantity);
        if (isNaN(actualQty) || actualQty < 0) continue;

        const dbIng = ingMap.get(ingId);
        if (!dbIng) continue;

        const systemQty = parseFloat(String(dbIng.currentStock));
        const diffQty = actualQty - systemQty;

        let status = 'MATCH';
        if (diffQty < 0) {
          status = 'SHORTAGE'; // สต็อกขาด
        } else if (diffQty > 0) {
          status = 'SURPLUS'; // สต็อกเกิน
        }

        countItemsData.push({
          ingredientId: ingId,
          systemQuantity: systemQty,
          actualQuantity: actualQty,
          diffQuantity: diffQty,
          status,
        });

        if (syncStock && diffQty !== 0) {
          stockUpdates.push({
            id: ingId,
            newStock: actualQty,
            diff: diffQty,
            ing: dbIng,
          });
        }
      }

      if (countItemsData.length === 0) {
        throw new Error('ไม่พบรายการวัตถุดิบที่ถูกต้องสำหรับการบันทึก');
      }

      // 3. Create StockCount Header & Items with location and storeName
      const createdCount = await tx.stockCount.create({
        data: {
          countNumber: finalCountNumber,
          countDate: new Date(),
          status: 'COMPLETED',
          location,
          storeId: location === 'STORE' && targetStore ? targetStore.id : null,
          storeName,
          note: note ? note.trim() : null,
          createdById: session.id,
          items: {
            create: countItemsData,
          },
        },
        include: {
          items: {
            include: {
              ingredient: true,
            },
          },
          createdBy: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
      });

      // 4. If syncStock is true, update ingredient currentStock and record stockTransaction
      if (syncStock && stockUpdates.length > 0) {
        for (const update of stockUpdates) {
          await tx.ingredient.update({
            where: { id: update.id },
            data: { currentStock: update.newStock },
          });

          const isSurplus = update.diff > 0;
          const qtyIn = isSurplus ? Math.abs(update.diff) : 0;
          const qtyOut = !isSurplus ? Math.abs(update.diff) : 0;

          await tx.stockTransaction.create({
            data: {
              transactionNumber: `TX-COUNT-${finalCountNumber}-${update.ing.code}-${Date.now().toString().slice(-4)}`,
              ingredientId: update.id,
              type: TransactionType.PHYSICAL_COUNT,
              quantityIn: qtyIn,
              quantityOut: qtyOut,
              balanceAfter: update.newStock,
              refType: location === 'STORE' ? 'STORE_COUNT' : 'WAREHOUSE_COUNT',
              refId: finalCountNumber,
              note: `ตรวจนับ [${storeName}] #${finalCountNumber}: ${isSurplus ? 'สต็อกเกิน' : 'สต็อกขาด'} ${Math.abs(update.diff)} ${update.ing.unit}`,
              createdById: location === 'STORE' && targetStore ? targetStore.id : session.id,
            },
          });
        }
      }

      return createdCount;
    });

    return NextResponse.json({
      success: true,
      message: `บันทึกผลการตรวจนับ [${storeName}] #${result.countNumber} เรียบร้อยแล้ว (${result.items.length} รายการ)`,
      stockCount: result,
    });
  } catch (error: any) {
    console.error('Error creating stock count:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกตรวจนับ: ' + error.message },
      { status: 500 }
    );
  }
}

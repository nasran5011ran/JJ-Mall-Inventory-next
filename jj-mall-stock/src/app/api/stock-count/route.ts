import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';
import { calculateStoreReconciliation } from '@/lib/store-stock';

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
    if (session.role === 'STAFF') {
      whereClause.location = 'STORE';
      whereClause.storeId = session.id;
    } else if (storeFilter === 'WAREHOUSE') {
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

    // 3. Pre-calculate store balances for each staff store for instant UI selection
    const storeBalances: Record<number, any[]> = {};
    for (const store of staffStores) {
      storeBalances[store.id] = await calculateStoreReconciliation(store.id);
    }

    // 4. Fetch Stock Count records with items
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

    // 5. Transaction breakdown for warehouse reporting and daily sales rate
    const txSummary = await prisma.stockTransaction.groupBy({
      by: ['ingredientId', 'type'],
      _sum: { quantityIn: true, quantityOut: true },
    });

    const txMap = new Map<string, number>();
    txSummary.forEach((t) => {
      txMap.set(`${t.ingredientId}_${t.type}_IN`, Number(t._sum.quantityIn || 0));
      txMap.set(`${t.ingredientId}_${t.type}_OUT`, Number(t._sum.quantityOut || 0));
    });

    // 6. Recent 7-day sales rate per store and ingredient
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentStoreSales = await prisma.stockTransaction.groupBy({
      by: ['ingredientId', 'createdById'],
      where: {
        type: TransactionType.SALE_DEDUCT,
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { quantityOut: true },
    });

    const storeSalesMap = new Map<string, number>();
    recentStoreSales.forEach((s) => {
      storeSalesMap.set(`${s.createdById}_${s.ingredientId}`, Number(s._sum.quantityOut || 0));
    });

    const stockCounts = rawStockCounts.map((sc) => {
      const isStore = sc.location === 'STORE' || Boolean(sc.storeId);
      const storeUser = sc.storeId || sc.createdById;

      const enrichedItems = sc.items.map((item) => {
        const ingId = item.ingredientId;
        const sysQty = Number(item.systemQuantity);
        const actQty = Number(item.actualQuantity);

        if (isStore) {
          // For Store count records, use stored breakdown or fallback
          const openingQty = item.openingQuantity !== null && item.openingQuantity !== undefined
            ? Number(item.openingQuantity)
            : 0;
          const inboundQty = item.inboundQuantity !== null && item.inboundQuantity !== undefined
            ? Number(item.inboundQuantity)
            : 0;
          const salesQty = item.salesQuantity !== null && item.salesQuantity !== undefined
            ? Number(item.salesQuantity)
            : 0;

          // Calculate DOH: (Actual Stock / Daily Sales Rate)
          const recent7DaySales = storeSalesMap.get(`${storeUser}_${ingId}`) || salesQty;
          const dailyRate = recent7DaySales > 0 ? recent7DaySales / 7 : (salesQty > 0 ? salesQty : 0);
          const doh = (dailyRate > 0 && actQty > 0) ? parseFloat((actQty / dailyRate).toFixed(1)) : 0;

          return {
            ...item,
            openingQuantity: openingQty,
            inboundQuantity: inboundQty,
            salesQuantity: salesQty,
            wasteQuantity: 0,
            doh,
          };
        } else {
          // For Central Warehouse count records
          const inboundQty = (txMap.get(`${ingId}_PURCHASE_IN_IN`) || 0) + (txMap.get(`${ingId}_ADJUST_ADD_IN`) || 0);
          const salesQty = txMap.get(`${ingId}_SALE_DEDUCT_OUT`) || 0;
          const wasteQty = (txMap.get(`${ingId}_ADJUST_SUB_OUT`) || 0) + (txMap.get(`${ingId}_DAMAGE_OUT_OUT`) || 0);
          const openingQty = item.openingQuantity !== null && item.openingQuantity !== undefined
            ? Number(item.openingQuantity)
            : Math.max(0, sysQty - inboundQty + salesQty + wasteQty);
          const dailyRate = salesQty > 0 ? salesQty / 7 : 0;
          const doh = (dailyRate > 0 && actQty > 0) ? parseFloat((actQty / dailyRate).toFixed(1)) : 0;

          return {
            ...item,
            openingQuantity: openingQty,
            inboundQuantity: inboundQty,
            salesQuantity: salesQty,
            wasteQuantity: wasteQty,
            doh,
          };
        }
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
      storeBalances,
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
    let {
      countNumber,
      location = 'WAREHOUSE', // 'WAREHOUSE' | 'STORE'
      storeId = null,
      note,
      syncStock = true,
      items, // Array of { ingredientId: number, actualQuantity: number }
    } = body;

    // If request is from STAFF, enforce STORE location and their own storeId
    if (session.role === 'STAFF') {
      location = 'STORE';
      storeId = session.id;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรายการวัตถุดิบที่ตรวจนับอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Resolve store name
    let storeName = 'คลังสินค้าส่วนกลาง JJ Mall';
    let targetStore: any = null;
    let storeReconciliationMap = new Map<number, any>();

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

      // Calculate the store's current reconciliation balance
      const storeBalances = await calculateStoreReconciliation(Number(storeId));
      storeBalances.forEach((b) => storeReconciliationMap.set(b.ingredientId, b));
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const finalCountNumber = countNumber && countNumber.trim()
      ? countNumber.trim()
      : `SC-${dateStr}-${randomSuffix}`;

    // Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current ingredients
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

        let systemQty = 0;
        let openingQty = 0;
        let inboundQty = 0;
        let salesQty = 0;

        if (location === 'STORE') {
          // For store count: Expected in-store balance
          const bal = storeReconciliationMap.get(ingId);
          openingQty = bal ? bal.openingQuantity : 0;
          inboundQty = bal ? bal.inboundQuantity : 0;
          salesQty = bal ? bal.salesQuantity : 0;
          systemQty = bal ? bal.expectedStock : 0;
        } else {
          // For warehouse count: Current stock in Central Warehouse
          systemQty = parseFloat(String(dbIng.currentStock));
          openingQty = systemQty;
        }

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
          openingQuantity: openingQty,
          inboundQuantity: inboundQty,
          salesQuantity: salesQty,
        });

        if (syncStock && diffQty !== 0 && location === 'WAREHOUSE') {
          // Only central warehouse count updates Ingredient.currentStock!
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

      // 4. Warehouse Count Sync: update ingredient currentStock and record stockTransaction
      if (location === 'WAREHOUSE' && syncStock && stockUpdates.length > 0) {
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
              refType: 'WAREHOUSE_COUNT',
              refId: finalCountNumber,
              note: `ตรวจนับคลังกลาง #${finalCountNumber}: ${isSurplus ? 'สต็อกเกิน' : 'สต็อกขาด'} ${Math.abs(update.diff)} ${update.ing.unit}`,
              createdById: session.id,
            },
          });
        }
      }

      // 5. Store Count Audit Log (without modifying Central Warehouse Ingredient.currentStock)
      if (location === 'STORE' && syncStock) {
        for (const item of countItemsData) {
          if (item.diffQuantity !== 0) {
            const isSurplus = item.diffQuantity > 0;
            const dbIng = ingMap.get(item.ingredientId);
            const currWarehouseStock = dbIng ? Number(dbIng.currentStock) : 0;

            await tx.stockTransaction.create({
              data: {
                transactionNumber: `TX-STORE-COUNT-${finalCountNumber}-${dbIng?.code || item.ingredientId}-${Date.now().toString().slice(-4)}`,
                ingredientId: item.ingredientId,
                type: TransactionType.PHYSICAL_COUNT,
                quantityIn: isSurplus ? Math.abs(item.diffQuantity) : 0,
                quantityOut: !isSurplus ? Math.abs(item.diffQuantity) : 0,
                balanceAfter: currWarehouseStock, // Central warehouse stock remains untouched
                refType: 'STORE_COUNT',
                refId: finalCountNumber,
                note: `ตรวจนับสต็อก [${storeName}] #${finalCountNumber}: ${isSurplus ? 'สต็อกเกิน' : 'สต็อกขาด'} ${Math.abs(item.diffQuantity)} ${dbIng?.unit || ''} (ในร้านควรมี ${item.systemQuantity}, นับจริง ${item.actualQuantity})`,
                createdById: targetStore?.id || session.id,
              },
            });
          }
        }
      }

      return createdCount;
    });

    // Notify Admin if submitted by STAFF
    if (session.role === 'STAFF') {
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'STOCK',
            type: 'STAFF_STOCK_COUNT',
            severity: 'INFO',
            title: 'ร้านค้าบันทึกผลการตรวจนับสต็อก',
            description: `${storeName} ได้บันทึกผลการตรวจนับสต็อกปิดร้าน #${result.countNumber} (${result.items.length} รายการ)`,
            actionUrl: '/admin/stock-count',
            actionLabel: 'ดูผลการตรวจนับ',
            storeId: targetStore?.id || session.id,
            storeName: targetStore?.name || session.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (notifErr) {
        console.error('Failed to create stock count notification:', notifErr);
      }
    }

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

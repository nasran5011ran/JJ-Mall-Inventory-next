import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';
import { calculateStoreReconciliation } from '@/lib/store-stock';

// GET: Fetch recent Stock In / Inbound purchase transactions
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
    const targetStoreId = searchParams.get('storeId');

    // 1. Fetch all active ingredients
    const allIngredients = await prisma.ingredient.findMany({
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
      orderBy: { name: 'asc' },
    });

    // 2. Fetch all staff users / stores for selection
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        name: true,
      },
      orderBy: { id: 'asc' },
    });

    // 3. Calculate store balances for all staff stores
    const storeBalancesByStore: Record<number, any[]> = {};
    for (const store of staffStores) {
      storeBalancesByStore[store.id] = await calculateStoreReconciliation(store.id);
    }

    let storeBalancesList: any[] = [];
    let storeStockMap = new Map<number, number>();
    if (session.role === 'STAFF') {
      storeBalancesList = storeBalancesByStore[session.id] || [];
      storeBalancesList.forEach((b) => storeStockMap.set(b.ingredientId, b.expectedStock));
    }

    const ingredients = allIngredients.map((ing) => ({
      ...ing,
      storeStock: session.role === 'STAFF' ? (storeStockMap.get(ing.id) ?? 0) : null,
    }));

    // 4. Fetch inbound stock transactions (type: PURCHASE_IN)
    const txWhere: any = {
      type: TransactionType.PURCHASE_IN,
    };

    if (session.role === 'STAFF') {
      txWhere.OR = [
        { createdById: session.id },
        { note: { contains: `@${session.username}` } },
        { note: { contains: `[STORE_ID:${session.id}]` } },
      ];
    } else if (targetStoreId && targetStoreId !== 'ALL') {
      const storeIdNum = parseInt(targetStoreId, 10);
      const storeObj = staffStores.find((s) => s.id === storeIdNum);
      if (storeObj) {
        txWhere.OR = [
          { createdById: storeIdNum },
          { note: { contains: `@${storeObj.username}` } },
          { note: { contains: `[STORE_ID:${storeIdNum}]` } },
        ];
      }
    }

    const transactions = await prisma.stockTransaction.findMany({
      where: txWhere,
      include: {
        ingredient: true,
        createdBy: {
          select: { id: true, name: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      transactions,
      ingredients,
      storeBalances: session.role === 'STAFF' ? storeBalancesList : storeBalancesByStore,
      storeBalancesByStore,
      staffStores,
    });
  } catch (error: any) {
    console.error('Error fetching stock in data:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรับเข้า: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Record new Inbound Stock / Purchase (Store purchases stock)
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
      targetType = 'STORE',
      targetStoreId,
      supplier,
      invoiceNumber,
      note,
      items,
    } = body;

    // If STAFF, force target to their own store
    if (session.role === 'STAFF') {
      targetType = 'STORE';
      targetStoreId = session.id;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรายการวัตถุดิบที่รับเข้าอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Determine target store
    let targetStore: any = null;
    if (targetType === 'STORE') {
      const storeIdNum = Number(targetStoreId || session.id);
      targetStore = await prisma.user.findUnique({
        where: { id: storeIdNum },
        select: { id: true, name: true, username: true, role: true },
      });
      if (!targetStore) {
        return NextResponse.json(
          { success: false, message: 'ไม่พบร้านค้าปลายทางที่เลือกในระบบ' },
          { status: 404 }
        );
      }
    }

    const receiptNumber =
      invoiceNumber && invoiceNumber.trim()
        ? invoiceNumber.trim()
        : `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const destinationLabel =
      targetStore
        ? `รับเข้าสต็อกร้าน: ${targetStore.name} (@${targetStore.username})`
        : 'รับเข้าสต็อก';

    // Execute atomic transaction in database
    const createdTransactions = await prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const item of items) {
        const ingId = Number(item.ingredientId);
        const qtyIn = parseFloat(item.quantity);
        const unitCost = item.costPerUnit ? parseFloat(item.costPerUnit) : undefined;

        if (isNaN(qtyIn) || qtyIn <= 0) continue;

        // 1. Update ingredient stock and cost in database
        const updateData: any = {
          currentStock: {
            increment: qtyIn,
          },
        };
        if (unitCost !== undefined && !isNaN(unitCost) && unitCost > 0) {
          updateData.costPerUnit = unitCost;
        }

        const updatedIng = await tx.ingredient.update({
          where: { id: ingId },
          data: updateData,
        });

        // 2. Generate unique transaction number
        const txNumber = `TX-IN-${receiptNumber}-${updatedIng.code}-${Date.now().toString().slice(-4)}`;

        // 3. Record stock transaction in DB (PURCHASE_IN)
        const recipientUserId = targetStore ? targetStore.id : session.id;
        const txRecord = await tx.stockTransaction.create({
          data: {
            transactionNumber: txNumber,
            ingredientId: ingId,
            type: TransactionType.PURCHASE_IN,
            quantityIn: qtyIn,
            quantityOut: 0,
            balanceAfter: updatedIng.currentStock,
            refType: 'PURCHASE',
            refId: targetStore ? `STORE-${targetStore.id}` : receiptNumber,
            note: `${destinationLabel} • ซัพพลายเออร์: ${supplier || 'ทั่วไป'} ${note ? '• ' + note : ''} [STORE_ID:${recipientUserId}]`,
            createdById: recipientUserId,
          },
          include: {
            ingredient: true,
            createdBy: {
              select: { id: true, name: true, username: true },
            },
          },
        });

        results.push(txRecord);
      }

      return results;
    });

    return NextResponse.json({
      success: true,
      message: `บันทึกรับวัตถุดิบเข้าสต็อกร้านเรียบร้อยแล้ว (${createdTransactions.length} รายการ)`,
      receiptNumber,
      destinationLabel,
      transactions: createdTransactions,
    });
  } catch (error: any) {
    console.error('Error saving stock in:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกรับสินค้า: ' + error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';

// GET: Fetch recent Stock In / Inbound purchase transactions
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลการรับสินค้าเข้าคลัง (Admin Only)' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const target = searchParams.get('target') || 'ALL'; // ALL | WAREHOUSE | STORE_ID

    // 1. Fetch all ingredients for lookup
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
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch all staff users for store allocation options
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        name: true,
      },
      orderBy: { id: 'asc' },
    });

    // 3. Fetch inbound stock transactions (type: PURCHASE_IN or quantityIn > 0)
    const transactions = await prisma.stockTransaction.findMany({
      where: {
        type: TransactionType.PURCHASE_IN,
      },
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
      ingredients: allIngredients,
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

// POST: Record new Inbound Stock / Purchase (Admin Only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์บันทึกรับสินค้าเข้าคลัง (Admin Only)' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      targetType, // 'WAREHOUSE' | 'STORE'
      targetStoreId, // number (staff user ID if targetType === 'STORE')
      supplier, // e.g. 'แม็คโคร', 'ตลาดไท'
      invoiceNumber, // PO or receipt number
      note,
      items, // Array of { ingredientId: number, quantity: number, costPerUnit?: number }
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรายการวัตถุดิบที่รับเข้าอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Validate destination
    let targetStore: any = null;
    if (targetType === 'STORE') {
      if (!targetStoreId) {
        return NextResponse.json(
          { success: false, message: 'กรุณาเลือกสาขา/ร้านค้าปลายทางที่รับสต็อก' },
          { status: 400 }
        );
      }
      targetStore = await prisma.user.findUnique({
        where: { id: Number(targetStoreId) },
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
      targetType === 'STORE' && targetStore
        ? `จัดสรรเข้าร้าน: ${targetStore.name} (@${targetStore.username})`
        : 'รับเข้าคลังสินค้าส่วนกลาง JJ Mall';

    // Execute atomic transaction in database
    const createdTransactions = await prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const item of items) {
        const ingId = Number(item.ingredientId);
        const qtyIn = parseFloat(item.quantity);
        const unitCost = item.costPerUnit ? parseFloat(item.costPerUnit) : undefined;

        if (isNaN(qtyIn) || qtyIn <= 0) continue;

        // 1. Update ingredient stock in database
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

        // 3. Record stock transaction in DB
        // If assigned to a store, createdById is the staff ID representing that store, so store queries find it!
        const txRecord = await tx.stockTransaction.create({
          data: {
            transactionNumber: txNumber,
            ingredientId: ingId,
            type: TransactionType.PURCHASE_IN,
            quantityIn: qtyIn,
            quantityOut: 0,
            balanceAfter: updatedIng.currentStock,
            refType: targetType === 'STORE' ? 'STORE_ALLOCATE' : 'PURCHASE',
            refId: targetType === 'STORE' ? `STORE-${targetStore.id}` : receiptNumber,
            note: `${destinationLabel} • ซัพพลายเออร์: ${supplier || 'ทั่วไป'} ${note ? '• ' + note : ''}`,
            createdById: targetType === 'STORE' ? targetStore.id : session.id,
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
      message: `บันทึกรับสินค้าเข้าคลังเรียบร้อยแล้ว (${createdTransactions.length} รายการ)`,
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

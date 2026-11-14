import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType } from '@prisma/client';

// GET: Fetch recent Stock Out / Store Requisition transactions
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลการเบิกจ่ายสินค้า' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    // 1. Fetch all active ingredients for dropdown with realtime stock
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

    // 2. Fetch all staff users / store destinations
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        name: true,
      },
      orderBy: { id: 'asc' },
    });

    // 3. Fetch Stock Out transactions (type: TRANSFER_OUT)
    const transactions = await prisma.stockTransaction.findMany({
      where: {
        type: TransactionType.TRANSFER_OUT,
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
    console.error('Error fetching stock out data:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเบิกจ่าย: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Record new Stock Out / Transfer to Store (Deduct from Central Warehouse)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'STAFF')) {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์บันทึกเบิกจ่ายสินค้า' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      targetStoreId, // ID of staff user representing store receiving the goods
      requisitionNumber, // Slip / REQ number
      note,
      items, // Array of { ingredientId: number, quantity: number }
    } = body;

    if (!targetStoreId) {
      return NextResponse.json(
        { success: false, message: 'กรุณาเลือกร้านค้า / จุดขายปลายทางที่มารับของ' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรายการวัตถุดิบที่ต้องการเบิกจ่ายอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Validate target store
    const targetStore = await prisma.user.findUnique({
      where: { id: Number(targetStoreId) },
      select: { id: true, name: true, username: true, role: true },
    });

    if (!targetStore) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบร้านค้าปลายทางที่เลือกในระบบ' },
        { status: 404 }
      );
    }

    const validItems = items.filter(
      (item) => item.ingredientId && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกจำนวนที่ต้องการเบิกจ่ายให้ถูกต้อง' },
        { status: 400 }
      );
    }

    // Check stock availability in Central Warehouse before executing
    for (const item of validItems) {
      const ingId = Number(item.ingredientId);
      const qtyOut = parseFloat(item.quantity);

      const currentIng = await prisma.ingredient.findUnique({
        where: { id: ingId },
        select: { id: true, name: true, unit: true, currentStock: true },
      });

      if (!currentIng) {
        return NextResponse.json(
          { success: false, message: `ไม่พบวัตถุดิบรหัส ID: ${ingId} ในระบบ` },
          { status: 404 }
        );
      }

      const available = Number(currentIng.currentStock);
      if (qtyOut > available) {
        return NextResponse.json(
          {
            success: false,
            message: `วัตถุดิบ "${currentIng.name}" คงเหลือในคลังเพียง ${available.toLocaleString()} ${currentIng.unit} ไม่เพียงพอสำหรับการเบิกจ่ายจำนวน ${qtyOut.toLocaleString()} ${currentIng.unit}`,
          },
          { status: 400 }
        );
      }
    }

    const slipNumber =
      requisitionNumber && requisitionNumber.trim()
        ? requisitionNumber.trim()
        : `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const destinationLabel = `เบิกจ่ายให้ร้าน: ${targetStore.name} (@${targetStore.username})`;

    // Atomic transaction: Deduct stock from Central Warehouse & record StockTransaction
    const createdTransactions = await prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const item of validItems) {
        const ingId = Number(item.ingredientId);
        const qtyOut = parseFloat(item.quantity);

        // 1. Decrement ingredient stock in Central Warehouse
        const updatedIng = await tx.ingredient.update({
          where: { id: ingId },
          data: {
            currentStock: {
              decrement: qtyOut,
            },
          },
        });

        // 2. Generate unique transaction number
        const txNumber = `TX-OUT-${slipNumber}-${updatedIng.code}-${Date.now().toString().slice(-4)}`;

        // 3. Record stock transaction in DB (TRANSFER_OUT)
        const txRecord = await tx.stockTransaction.create({
          data: {
            transactionNumber: txNumber,
            ingredientId: ingId,
            type: TransactionType.TRANSFER_OUT,
            quantityIn: 0,
            quantityOut: qtyOut,
            balanceAfter: updatedIng.currentStock,
            refType: 'STORE_REQUISITION',
            refId: slipNumber,
            note: `${destinationLabel} ${note ? '• ' + note.trim() : ''} [STORE_ID:${targetStore.id}]`,
            createdById: session.id,
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
      message: `บันทึกเบิกจ่ายสินค้าไปหน้าร้านเรียบร้อยแล้ว (${createdTransactions.length} รายการ) สต็อกในคลังกลางถูกตัดลดทันที`,
      slipNumber,
      destinationLabel,
      storeName: targetStore.name,
      transactions: createdTransactions,
    });
  } catch (error: any) {
    console.error('Error saving stock out:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกเบิกจ่าย: ' + error.message },
      { status: 500 }
    );
  }
}

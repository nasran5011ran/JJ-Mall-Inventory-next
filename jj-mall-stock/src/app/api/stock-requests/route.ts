import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType, RequisitionStatus } from '@prisma/client';
import { calculateStoreReconciliation } from '@/lib/store-stock';

// GET: Fetch Stock Requisitions
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
    const status = searchParams.get('status') || 'ALL';
    const storeId = searchParams.get('storeId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const whereClause: any = {};
    if (session.role === 'STAFF') {
      whereClause.storeId = session.id;
    } else if (storeId && storeId !== 'ALL') {
      whereClause.storeId = parseInt(storeId, 10);
    }

    if (status !== 'ALL') {
      whereClause.status = status as RequisitionStatus;
    }

    // 1. Fetch Requisitions with store and approvedBy
    const requisitions = await prisma.stockRequisition.findMany({
      where: whereClause,
      include: {
        store: {
          select: { id: true, name: true, username: true, role: true },
        },
        approvedBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        items: {
          include: {
            ingredient: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                category: true,
                costPerUnit: true,
                currentStock: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 2. Fetch all active ingredients for creating new requests
    const rawIngredients = await prisma.ingredient.findMany({
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
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // For staff, also get their current store balance for reference
    let storeBalMap = new Map<number, number>();
    if (session.role === 'STAFF') {
      const storeBalances = await calculateStoreReconciliation(session.id);
      storeBalances.forEach((b) => storeBalMap.set(b.ingredientId, b.expectedStock));
    }

    const ingredients = rawIngredients.map((ing) => ({
      ...ing,
      warehouseStock: Number(ing.currentStock),
      storeStock: session.role === 'STAFF' ? (storeBalMap.get(ing.id) ?? 0) : null,
    }));

    // 3. Compute KPI metrics
    const allRequisitions = await prisma.stockRequisition.findMany({
      where: session.role === 'STAFF' ? { storeId: session.id } : undefined,
      select: { status: true },
    });

    const pendingCount = allRequisitions.filter((r) => r.status === 'PENDING').length;
    const approvedCount = allRequisitions.filter((r) => r.status === 'APPROVED').length;
    const rejectedCount = allRequisitions.filter((r) => r.status === 'REJECTED').length;

    // 4. Stores list for Admin filter
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: { id: true, name: true, username: true },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({
      success: true,
      requisitions,
      ingredients,
      staffStores,
      metrics: {
        pendingCount,
        approvedCount,
        rejectedCount,
        totalCount: allRequisitions.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock requisitions:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบขอเบิกสต็อก: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Create a new Stock Requisition (Staff submits request)
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
    const { reason, note, items, targetStoreId } = body;

    // Determine which store is requesting
    let storeId = session.id;
    if (session.role === 'ADMIN' && targetStoreId) {
      storeId = parseInt(targetStoreId, 10);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุวัตถุดิบและจำนวนที่ต้องการขอเบิกอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    const validItems = items.filter(
      (item: any) =>
        item.ingredientId &&
        !isNaN(parseFloat(item.requestedQty)) &&
        parseFloat(item.requestedQty) > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุจำนวนที่ต้องการขอเบิกให้ถูกต้อง (มากกว่า 0)' },
        { status: 400 }
      );
    }

    // Generate unique requisition number REQ-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const requisitionNumber = `REQ-${todayStr}-${randomSuffix}`;

    const requestingStore = await prisma.user.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, username: true },
    });

    const requisition = await prisma.stockRequisition.create({
      data: {
        requisitionNumber,
        reason: reason ? reason.trim() : 'ขอเบิกวัตถุดิบเข้าหน้าร้าน',
        note: note ? note.trim() : null,
        status: 'PENDING',
        storeId,
        items: {
          create: validItems.map((item: any) => ({
            ingredientId: parseInt(item.ingredientId, 10),
            requestedQty: parseFloat(item.requestedQty),
            approvedQty: parseFloat(item.requestedQty), // default approved = requested
          })),
        },
      },
      include: {
        store: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            ingredient: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
      },
    });

    // Create system notification for Admin
    try {
      await prisma.systemNotification.create({
        data: {
          category: 'INVENTORY',
          type: 'STOCK_REQUISITION_PENDING',
          severity: 'ACTION_REQUIRED',
          title: 'มีใบขอเบิกสต็อกใหม่รออนุมัติ',
          description: `ร้าน "${requestingStore?.name || session.name}" ส่งใบขอเบิกสต็อกเลขที่ ${requisitionNumber} (${validItems.length} รายการ)`,
          actionUrl: `/admin/stock-requests?highlight=${requisition.id}`,
          actionLabel: 'ตรวจและอนุมัติ',
          storeId: storeId,
          storeName: requestingStore?.name || session.name,
          actorId: session.id,
          actorName: session.name,
        },
      });
    } catch (notifErr) {
      console.warn('Failed to create system notification for requisition:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: `ส่งใบขอเบิกสต็อกเลขที่ ${requisitionNumber} เรียบร้อยแล้ว รอผู้ดูแลระบบอนุมัติ`,
      requisition,
    });
  } catch (error: any) {
    console.error('Error creating stock requisition:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการสร้างใบขอเบิก: ' + error.message },
      { status: 500 }
    );
  }
}

// PUT: Approve or Reject a Stock Requisition (Admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถอนุมัติใบขอเบิกได้' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { requisitionId, action, rejectReason, items } = body;

    if (!requisitionId) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรหัสใบขอเบิกสต็อก' },
        { status: 400 }
      );
    }

    const reqRecord = await prisma.stockRequisition.findUnique({
      where: { id: parseInt(requisitionId, 10) },
      include: {
        store: true,
        items: {
          include: { ingredient: true },
        },
      },
    });

    if (!reqRecord) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบใบขอเบิกสต็อกนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (reqRecord.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: `ใบขอเบิกนี้ดำเนินการไปแล้ว (สถานะ: ${reqRecord.status})` },
        { status: 400 }
      );
    }

    // ACTION: REJECT
    if (action === 'REJECT') {
      const updated = await prisma.stockRequisition.update({
        where: { id: reqRecord.id },
        data: {
          status: 'REJECTED',
          rejectReason: rejectReason ? rejectReason.trim() : 'ไม่อนุมัติ',
          approvedById: session.id,
          approvedAt: new Date(),
        },
      });

      // Notify Staff
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'INVENTORY',
            type: 'STOCK_REQUISITION_REJECTED',
            severity: 'WARNING',
            title: `ใบขอเบิกสต็อก ${reqRecord.requisitionNumber} ถูกปฏิเสธ`,
            description: `ผู้ดูแลระบบปฏิเสธใบขอเบิกสต็อก เหตุผล: ${rejectReason || 'ไม่มีการระบุเหตุผล'}`,
            actionUrl: `/staff/stock-requests`,
            actionLabel: 'ดูรายละเอียด',
            storeId: reqRecord.storeId,
            storeName: reqRecord.store.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (e) {
        console.warn('Failed to notify staff:', e);
      }

      return NextResponse.json({
        success: true,
        message: `ปฏิเสธใบขอเบิกเลขที่ ${reqRecord.requisitionNumber} เรียบร้อยแล้ว`,
        requisition: updated,
      });
    }

    // ACTION: APPROVE (Fulfill Requisition & Transfer Stock)
    if (action === 'APPROVE') {
      // Allow custom approved quantities if passed
      const itemQtyMap = new Map<number, number>();
      if (items && Array.isArray(items)) {
        items.forEach((it: any) => {
          if (it.id && !isNaN(parseFloat(it.approvedQty))) {
            itemQtyMap.set(parseInt(it.id, 10), Math.max(0, parseFloat(it.approvedQty)));
          }
        });
      }

      // Check warehouse stock availability
      for (const item of reqRecord.items) {
        const approvedQty = itemQtyMap.has(item.id)
          ? itemQtyMap.get(item.id)!
          : Number(item.approvedQty ?? item.requestedQty);

        if (approvedQty <= 0) continue;

        const currentWarehouseStock = Number(item.ingredient.currentStock);
        if (approvedQty > currentWarehouseStock) {
          return NextResponse.json(
            {
              success: false,
              message: `วัตถุดิบ "${item.ingredient.name}" คงเหลือในคลังกลางเพียง ${currentWarehouseStock.toLocaleString()} ${item.ingredient.unit} ไม่เพียงพอสำหรับการจ่ายจำนวน ${approvedQty.toLocaleString()} ${item.ingredient.unit}`,
            },
            { status: 400 }
          );
        }
      }

      const destinationLabel = `เบิกจ่ายให้ร้าน: ${reqRecord.store.name} (@${reqRecord.store.username})`;

      // Execute in atomic transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update items approvedQty
        for (const item of reqRecord.items) {
          const approvedQty = itemQtyMap.has(item.id)
            ? itemQtyMap.get(item.id)!
            : Number(item.approvedQty ?? item.requestedQty);

          await tx.stockRequisitionItem.update({
            where: { id: item.id },
            data: { approvedQty },
          });

          if (approvedQty > 0) {
            // 2. Decrement ingredient stock in Central Warehouse
            const updatedIng = await tx.ingredient.update({
              where: { id: item.ingredientId },
              data: {
                currentStock: { decrement: approvedQty },
              },
            });

            // 3. Record StockTransaction (TRANSFER_OUT)
            const txNumber = `TX-REQ-${reqRecord.requisitionNumber}-${updatedIng.code}-${Date.now().toString().slice(-4)}`;
            await tx.stockTransaction.create({
              data: {
                transactionNumber: txNumber,
                ingredientId: item.ingredientId,
                type: TransactionType.TRANSFER_OUT,
                quantityIn: 0,
                quantityOut: approvedQty,
                balanceAfter: updatedIng.currentStock,
                refType: 'STORE_REQUISITION',
                refId: reqRecord.requisitionNumber,
                note: `${destinationLabel} • ตามใบขอเบิก ${reqRecord.requisitionNumber}${reqRecord.reason ? ' (' + reqRecord.reason + ')' : ''}`,
                createdById: session.id,
              },
            });
          }
        }

        // 4. Mark requisition as APPROVED
        const approvedRecord = await tx.stockRequisition.update({
          where: { id: reqRecord.id },
          data: {
            status: 'APPROVED',
            approvedById: session.id,
            approvedAt: new Date(),
          },
          include: {
            items: { include: { ingredient: true } },
            store: true,
            approvedBy: true,
          },
        });

        return approvedRecord;
      });

      // Notify Staff
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'INVENTORY',
            type: 'STOCK_REQUISITION_APPROVED',
            severity: 'INFO',
            title: `ใบขอเบิกสต็อก ${reqRecord.requisitionNumber} ได้รับการอนุมัติแล้ว`,
            description: `ผู้ดูแลระบบได้อนุมัติและโอนวัตถุดิบเข้าหน้าร้าน ${reqRecord.store.name} เรียบร้อยแล้ว`,
            actionUrl: `/staff/stock-requests`,
            actionLabel: 'ตรวจเช็คสต็อก',
            storeId: reqRecord.storeId,
            storeName: reqRecord.store.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (e) {
        console.warn('Failed to notify staff:', e);
      }

      return NextResponse.json({
        success: true,
        message: `อนุมัติและโอนวัตถุดิบเข้าหน้าร้าน "${reqRecord.store.name}" เรียบร้อยแล้ว`,
        requisition: result,
      });
    }

    return NextResponse.json(
      { success: false, message: 'การดำเนินการไม่ถูกต้อง (action ต้องเป็น APPROVE หรือ REJECT)' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error processing stock requisition:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดำเนินการ: ' + error.message },
      { status: 500 }
    );
  }
}

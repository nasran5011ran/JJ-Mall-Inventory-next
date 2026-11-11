import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TransactionType, AdjustmentStatus } from '@prisma/client';
import { calculateStoreReconciliation } from '@/lib/store-stock';

// GET: Fetch Stock Adjustments with items and ingredients
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
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const whereClause: any = {};
    if (session.role === 'STAFF') {
      whereClause.requestedById = session.id;
    }
    if (status !== 'ALL') {
      whereClause.status = status as AdjustmentStatus;
    }

    // 1. Fetch Adjustments with requestedBy, approvedBy, and items
    const adjustments = await prisma.stockAdjustment.findMany({
      where: whereClause,
      include: {
        requestedBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        approvedBy: {
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

    // 2. Fetch all active ingredients for new adjustment creation
    // For STAFF users, currentStock must represent their own store's stock!
    let storeBalMap = new Map<number, number>();
    if (session.role === 'STAFF') {
      const storeBalances = await calculateStoreReconciliation(session.id);
      storeBalances.forEach((b) => storeBalMap.set(b.ingredientId, b.expectedStock));
    }

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
      orderBy: { name: 'asc' },
    });

    const ingredients = rawIngredients.map((ing) => ({
      ...ing,
      warehouseStock: Number(ing.currentStock),
      currentStock: session.role === 'STAFF'
        ? (storeBalMap.has(ing.id) ? storeBalMap.get(ing.id)! : 0)
        : Number(ing.currentStock),
      storeStock: session.role === 'STAFF'
        ? (storeBalMap.has(ing.id) ? storeBalMap.get(ing.id)! : 0)
        : null,
    }));

    // 3. Compute KPI metrics
    const allAdjustments = await prisma.stockAdjustment.findMany({
      where: session.role === 'STAFF' ? { requestedById: session.id } : undefined,
      select: { status: true },
    });

    const pendingCount = allAdjustments.filter((a) => a.status === 'PENDING').length;
    const approvedCount = allAdjustments.filter((a) => a.status === 'APPROVED').length;
    const rejectedCount = allAdjustments.filter((a) => a.status === 'REJECTED').length;

    return NextResponse.json({
      success: true,
      adjustments,
      ingredients,
      metrics: {
        pendingCount,
        approvedCount,
        rejectedCount,
        totalCount: allAdjustments.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stock adjustments:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบปรับปรุงสต็อก: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Create New Stock Adjustment Request
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
      reason,
      autoApprove = false,
      items, // Array of { ingredientId: number, actualQuantity: number }
    } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุเหตุผลในการปรับปรุงสต็อก' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุรายการวัตถุดิบที่ต้องการปรับปรุงอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const adjustmentNumber = `ADJ-${dateStr}-${randomSuffix}`;

    const isAdmin = session.role === 'ADMIN';
    const willApproveImmediately = autoApprove && isAdmin;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current ingredients
      const ingIds = items.map((i: any) => Number(i.ingredientId));
      const dbIngredients = await tx.ingredient.findMany({
        where: { id: { in: ingIds } },
      });
      const ingMap = new Map<number, any>();
      dbIngredients.forEach((ing) => ingMap.set(ing.id, ing));

      let storeBalMap = new Map<number, number>();
      if (session.role === 'STAFF') {
        const storeBalances = await calculateStoreReconciliation(session.id);
        storeBalances.forEach((b) => storeBalMap.set(b.ingredientId, b.expectedStock));
      }

      // 2. Prepare items data
      const adjustmentItemsData: any[] = [];
      const stockUpdates: { id: number; newStock: number; diff: number; ing: any }[] = [];

      for (const item of items) {
        const ingId = Number(item.ingredientId);
        const actualQty = parseFloat(item.actualQuantity);
        if (isNaN(actualQty) || actualQty < 0) continue;

        const dbIng = ingMap.get(ingId);
        if (!dbIng) continue;

        const systemQty = session.role === 'STAFF'
          ? (storeBalMap.has(ingId) ? storeBalMap.get(ingId)! : 0)
          : parseFloat(String(dbIng.currentStock));
        const diffQty = actualQty - systemQty;

        adjustmentItemsData.push({
          ingredientId: ingId,
          systemQuantity: systemQty,
          actualQuantity: actualQty,
          diffQuantity: diffQty,
        });

        if (willApproveImmediately && diffQty !== 0) {
          stockUpdates.push({
            id: ingId,
            newStock: actualQty,
            diff: diffQty,
            ing: dbIng,
          });
        }
      }

      if (adjustmentItemsData.length === 0) {
        throw new Error('ไม่พบรายการวัตถุดิบที่ถูกต้องสำหรับการปรับปรุงสต็อก');
      }

      // 3. Create StockAdjustment
      const createdAdjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          reason: reason.trim(),
          status: willApproveImmediately ? AdjustmentStatus.APPROVED : AdjustmentStatus.PENDING,
          requestedById: session.id,
          approvedById: willApproveImmediately ? session.id : null,
          approvedAt: willApproveImmediately ? new Date() : null,
          items: {
            create: adjustmentItemsData,
          },
        },
        include: {
          items: {
            include: {
              ingredient: true,
            },
          },
          requestedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
          approvedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
      });

      // 4. If auto-approved, update Ingredient.currentStock and record StockTransaction
      if (willApproveImmediately && stockUpdates.length > 0) {
        for (const update of stockUpdates) {
          await tx.ingredient.update({
            where: { id: update.id },
            data: { currentStock: update.newStock },
          });

          const isAdd = update.diff > 0;
          const qtyIn = isAdd ? Math.abs(update.diff) : 0;
          const qtyOut = !isAdd ? Math.abs(update.diff) : 0;
          const txType = isAdd ? TransactionType.ADJUST_ADD : TransactionType.ADJUST_SUB;

          await tx.stockTransaction.create({
            data: {
              transactionNumber: `TX-ADJ-${adjustmentNumber}-${update.ing.code}-${Date.now().toString().slice(-4)}`,
              ingredientId: update.id,
              type: txType,
              quantityIn: qtyIn,
              quantityOut: qtyOut,
              balanceAfter: update.newStock,
              refType: 'STOCK_ADJUSTMENT',
              refId: adjustmentNumber,
              note: `ปรับปรุงสต็อก #${adjustmentNumber} (${update.diff > 0 ? '+' : ''}${update.diff} ${update.ing.unit}): ${reason.trim()}`,
              createdById: session.id,
            },
          });
        }
      }

      return createdAdjustment;
    });

    // Notify Admin of new Stock Adjustment Request if pending approval
    if (!willApproveImmediately) {
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'APPROVAL',
            type: 'STOCK_ADJUSTMENT_REQUEST',
            severity: 'WARNING',
            title: 'มีใบขอปรับสต็อก/ตัดของเสียใหม่',
            description: `${session.name} ขอปรับสต็อก #${result.adjustmentNumber} (${result.items.length} รายการ): "${reason.trim()}"`,
            actionUrl: '/admin/stock-adjustments',
            actionLabel: 'พิจารณาอนุมัติ',
            storeId: session.id,
            storeName: session.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (notifErr) {
        console.error('Failed to create adjustment notification:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: willApproveImmediately
        ? `สร้างและอนุมัติใบปรับปรุงสต็อก #${result.adjustmentNumber} เรียบร้อยแล้ว (อัปเดตสต็อกทันที)`
        : `ส่งใบขอปรับปรุงสต็อก #${result.adjustmentNumber} เรียบร้อยแล้ว (รอการอนุมัติ)`,
      adjustment: result,
    });
  } catch (error: any) {
    console.error('Error creating stock adjustment:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการสร้างใบปรับปรุงสต็อก: ' + error.message },
      { status: 500 }
    );
  }
}

// PATCH: Approve or Reject Stock Adjustment (Admin Only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์อนุมัติใบปรับปรุงสต็อก (Admin Only)' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, action, rejectReason } = body; // action: 'APPROVE' | 'REJECT'

    if (!id || !action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'ข้อมูลการอนุมัติไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const adjustmentId = Number(id);
    const existing = await prisma.stockAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        requestedBy: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบใบปรับปรุงสต็อกที่ระบุ' },
        { status: 404 }
      );
    }

    if (existing.status !== AdjustmentStatus.PENDING) {
      return NextResponse.json(
        { success: false, message: `ใบปรับปรุงสต็อกนี้ถูกดำเนินการไปแล้ว (${existing.status})` },
        { status: 400 }
      );
    }

    // Execute atomic approval or rejection
    const updated = await prisma.$transaction(async (tx) => {
      if (action === 'REJECT') {
        return await tx.stockAdjustment.update({
          where: { id: adjustmentId },
          data: {
            status: AdjustmentStatus.REJECTED,
            approvedById: session.id,
            approvedAt: new Date(),
            rejectReason: rejectReason ? rejectReason.trim() : 'ไม่อนุมัติโดยผู้ดูแลระบบ',
          },
          include: {
            requestedBy: { select: { id: true, name: true, username: true } },
            approvedBy: { select: { id: true, name: true, username: true } },
            items: { include: { ingredient: true } },
          },
        });
      }

      // If APPROVE: Update ingredient stock and record StockTransactions
      const isStoreAdjustment = existing.requestedBy?.role === 'STAFF';

      for (const item of existing.items) {
        const diff = Number(item.diffQuantity);
        const newActual = Number(item.actualQuantity);

        if (diff !== 0) {
          // Update Central Warehouse ingredient currentStock ONLY for warehouse adjustments
          // Store adjustments affect the store's stock via StockTransaction with [STORE_ID:...], NOT Central Warehouse stock
          if (!isStoreAdjustment) {
            await tx.ingredient.update({
              where: { id: item.ingredientId },
              data: { currentStock: newActual },
            });
          }

          // Create StockTransaction
          const isAdd = diff > 0;
          const qtyIn = isAdd ? Math.abs(diff) : 0;
          const qtyOut = !isAdd ? Math.abs(diff) : 0;
          const txType = isAdd ? TransactionType.ADJUST_ADD : TransactionType.ADJUST_SUB;

          const storeTag = isStoreAdjustment && existing.requestedById ? ` [STORE_ID:${existing.requestedById}]` : '';

          await tx.stockTransaction.create({
            data: {
              transactionNumber: `TX-ADJ-${existing.adjustmentNumber}-${item.ingredient.code}-${Date.now().toString().slice(-4)}`,
              ingredientId: item.ingredientId,
              type: txType,
              quantityIn: qtyIn,
              quantityOut: qtyOut,
              balanceAfter: newActual,
              refType: 'STOCK_ADJUSTMENT',
              refId: existing.adjustmentNumber,
              note: `อนุมัติปรับยอดสต็อก${isStoreAdjustment ? 'หน้าร้าน' : 'คลังกลาง'} #${existing.adjustmentNumber} (${diff > 0 ? '+' : ''}${diff} ${item.ingredient.unit}): ${existing.reason}${storeTag}`,
              createdById: session.id,
            },
          });
        }
      }

      return await tx.stockAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: AdjustmentStatus.APPROVED,
          approvedById: session.id,
          approvedAt: new Date(),
        },
        include: {
          requestedBy: { select: { id: true, name: true, username: true } },
          approvedBy: { select: { id: true, name: true, username: true } },
          items: { include: { ingredient: true } },
        },
      });
    });

    // Notify requesting store on approval or rejection
    if (updated.requestedById) {
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'APPROVAL',
            type: action === 'APPROVE' ? 'STOCK_ADJUSTMENT_APPROVED' : 'STOCK_ADJUSTMENT_REJECTED',
            severity: action === 'APPROVE' ? 'SUCCESS' : 'DANGER',
            title: action === 'APPROVE' ? 'ใบขอปรับสต็อกได้รับการอนุมัติแล้ว' : 'ใบขอปรับสต็อกถูกปฏิเสธ',
            description: action === 'APPROVE'
              ? `ผู้ดูแลระบบได้อนุมัติใบปรับสต็อก #${updated.adjustmentNumber} เรียบร้อยแล้ว`
              : `ผู้ดูแลระบบได้ปฏิเสธใบปรับสต็อก #${updated.adjustmentNumber} เหตุผล: ${rejectReason || 'ไม่อนุมัติ'}`,
            actionUrl: '/staff/stock-adjustments',
            actionLabel: 'ดูรายการปรับสต็อก',
            storeId: updated.requestedById,
            storeName: updated.requestedBy?.name || '',
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (notifErr) {
        console.error('Failed to notify staff on adjustment update:', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: action === 'APPROVE'
        ? `อนุมัติใบปรับปรุงสต็อก #${updated.adjustmentNumber} เรียบร้อยแล้ว (อัปเดตยอดคงเหลือจริงแล้ว)`
        : `ปฏิเสธใบขอปรับปรุงสต็อก #${updated.adjustmentNumber} เรียบร้อยแล้ว`,
      adjustment: updated,
    });
  } catch (error: any) {
    console.error('Error processing adjustment approval:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดำเนินการ: ' + error.message },
      { status: 500 }
    );
  }
}

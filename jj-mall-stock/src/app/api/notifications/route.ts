import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch Ingredients for Stock Alerts (Critical & Low)
    const activeIngredients = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        currentStock: true,
        minStock: true,
        costPerUnit: true,
        updatedAt: true,
      },
      orderBy: { currentStock: 'asc' },
    });

    // 2. Fetch Pending Stock Adjustments & Real Pending Count
    const [pendingAdjustments, realPendingCount] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where: { status: 'PENDING' },
        include: {
          requestedBy: {
            select: { name: true, username: true, role: true },
          },
          items: {
            include: {
              ingredient: {
                select: { name: true, code: true, unit: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.stockAdjustment.count({ where: { status: 'PENDING' } }),
    ]);

    // 3. Fetch Recent Stock Counts with Discrepancies
    const recentCounts = await prisma.stockCount.findMany({
      where: {
        items: {
          some: {
            diffQuantity: { not: 0 },
          },
        },
      },
      include: {
        items: {
          where: { diffQuantity: { not: 0 } },
          include: {
            ingredient: {
              select: { name: true, code: true, unit: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 4. Fetch Recent High-Volume Transactions (Last 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentTransactions = await prisma.stockTransaction.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        type: { in: ['PURCHASE_IN', 'PHYSICAL_COUNT', 'ADJUST_ADD', 'ADJUST_SUB'] },
      },
      include: {
        ingredient: {
          select: { name: true, code: true, unit: true },
        },
        createdBy: {
          select: { name: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // 5. Fetch Recent Staff Menu Activities / System Notifications
    const systemNotifs = await prisma.systemNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Structure Notifications List
    const notifications: any[] = [];
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let discrepancyItemCount = 0;

    // Process Stock Alerts
    activeIngredients.forEach((ing) => {
      const stock = Number(ing.currentStock);
      const min = Number(ing.minStock);

      if (stock <= 0) {
        outOfStockCount++;
        notifications.push({
          id: `stock-out-${ing.id}`,
          category: 'STOCK',
          type: 'OUT_OF_STOCK',
          severity: 'CRITICAL',
          title: `วัตถุดิบหมดคลัง: ${ing.name}`,
          description: `ยอดคงเหลือ 0 ${ing.unit} (เกณฑ์ขั้นต่ำ ${min.toLocaleString()} ${ing.unit}) กรุณาสั่งซื้อหรือรับเข้าคลังด่วนเพื่อไม่ให้กระทบยอดขาย`,
          timestamp: ing.updatedAt,
          actionUrl: `/admin/stock-in?ingredientId=${ing.id}`,
          actionLabel: 'บันทึกรับเข้าคลัง',
          metadata: {
            ingredientId: ing.id,
            ingredientName: ing.name,
            code: ing.code,
            unit: ing.unit,
            currentStock: stock,
            minStock: min,
            deficit: min - stock,
            category: ing.category || 'ทั่วไป',
            costPerUnit: Number(ing.costPerUnit),
          },
        });
      } else if (stock <= min) {
        lowStockCount++;
        notifications.push({
          id: `stock-low-${ing.id}`,
          category: 'STOCK',
          type: 'LOW_STOCK',
          severity: 'WARNING',
          title: `วัตถุดิบใกล้หมด: ${ing.name}`,
          description: `ยอดคงเหลือ ${stock.toLocaleString()} ${ing.unit} ต่ำกว่าเกณฑ์ขั้นต่ำ (${min.toLocaleString()} ${ing.unit}) แนะนำให้วางแผนสั่งซื้อเพิ่มเติม`,
          timestamp: ing.updatedAt,
          actionUrl: `/admin/stock-in?ingredientId=${ing.id}`,
          actionLabel: 'บันทึกรับเข้าคลัง',
          metadata: {
            ingredientId: ing.id,
            ingredientName: ing.name,
            code: ing.code,
            unit: ing.unit,
            currentStock: stock,
            minStock: min,
            deficit: min - stock,
            category: ing.category || 'ทั่วไป',
            costPerUnit: Number(ing.costPerUnit),
          },
        });
      }
    });

    // Process Pending Adjustments
    pendingAdjustments.forEach((adj) => {
      const itemsCount = adj.items.length;
      const firstItem = adj.items[0]?.ingredient?.name;
      const summaryItems = itemsCount > 1 ? `${firstItem} และอื่นๆ อีก ${itemsCount - 1} รายการ` : firstItem || '';

      notifications.push({
        id: `adj-pending-${adj.id}`,
        category: 'APPROVAL',
        type: 'PENDING_ADJUSTMENT',
        severity: 'ACTION_REQUIRED',
        title: `ใบขอปรับปรุงสต็อกรออนุมัติ: ${adj.adjustmentNumber}`,
        description: `ยื่นคำขอโดย ${adj.requestedBy?.name || 'Staff'} (@${adj.requestedBy?.username || '-'}) รวม ${itemsCount} รายการ (${summaryItems}) เหตุผล: ${adj.reason || 'ไม่ได้ระบุ'}`,
        timestamp: adj.createdAt,
        actionUrl: `/admin/stock-adjustments?highlight=${adj.id}`,
        actionLabel: 'ตรวจสอบและอนุมัติ',
        metadata: {
          adjustmentId: adj.id,
          adjustmentNumber: adj.adjustmentNumber,
          requesterName: adj.requestedBy?.name,
          itemsCount,
          reason: adj.reason,
        },
      });
    });

    // Process Discrepancies
    recentCounts.forEach((sc) => {
      sc.items.forEach((ci) => {
        discrepancyItemCount++;
        const diff = Number(ci.diffQuantity);
        notifications.push({
          id: `count-diff-${ci.id}`,
          category: 'DISCREPANCY',
          type: 'STOCK_COUNT_DIFF',
          severity: diff < 0 ? 'WARNING' : 'INFO',
          title: `ผลต่างจากการตรวจนับ: ${ci.ingredient.name}`,
          description: `จากการตรวจนับใบที่ ${sc.countNumber} พบยอดนับจริงต่างจากระบบ ${diff > 0 ? `+${diff}` : diff} ${ci.ingredient.unit} (ระบบ: ${Number(ci.systemQuantity)} / นับจริง: ${Number(ci.actualQuantity)})`,
          timestamp: sc.createdAt,
          actionUrl: `/admin/stock-count`,
          actionLabel: 'ดูประวัติตรวจนับ',
          metadata: {
            countItemId: ci.id,
            countNumber: sc.countNumber,
            ingredientName: ci.ingredient.name,
            diffQuantity: diff,
            systemQuantity: Number(ci.systemQuantity),
            actualQuantity: Number(ci.actualQuantity),
            unit: ci.ingredient.unit,
          },
        });
      });
    });

    // Process Recent Significant Transactions
    recentTransactions.forEach((tx) => {
      let label = 'ความเคลื่อนไหวสต็อก';
      let desc = '';
      if (tx.type === 'PURCHASE_IN') {
        label = `รับวัตถุดิบเข้าคลัง: ${tx.ingredient.name}`;
        desc = `รับเข้า +${Number(tx.quantityIn).toLocaleString()} ${tx.ingredient.unit} (คงเหลือหลังรับ: ${Number(tx.balanceAfter).toLocaleString()} ${tx.ingredient.unit}) โดย ${tx.createdBy.name}`;
      } else if (tx.type === 'PHYSICAL_COUNT') {
        label = `ปรับยอดจากการตรวจนับ: ${tx.ingredient.name}`;
        desc = `ปรับยอดสต็อกเป็น ${Number(tx.balanceAfter).toLocaleString()} ${tx.ingredient.unit} โดย ${tx.createdBy.name}`;
      } else {
        label = `ปรับปรุงสต็อกสำเร็จ: ${tx.ingredient.name}`;
        desc = `ปรับยอด ${Number(tx.quantityIn) > 0 ? `+${Number(tx.quantityIn)}` : `-${Number(tx.quantityOut)}`} ${tx.ingredient.unit} โดย ${tx.createdBy.name}`;
      }

      notifications.push({
        id: `tx-activity-${tx.id}`,
        category: 'ACTIVITY',
        type: tx.type,
        severity: 'INFO',
        title: label,
        description: desc,
        timestamp: tx.createdAt,
        actionUrl: `/admin/stock-transactions`,
        actionLabel: 'ดูสมุดคุมสต็อก',
        metadata: {
          transactionId: tx.id,
          transactionNumber: tx.transactionNumber,
          ingredientName: tx.ingredient.name,
          balanceAfter: Number(tx.balanceAfter),
        },
      });
    });

    // Process Staff Menu Activities
    let staffMenuActivityCount = 0;
    systemNotifs.forEach((sn) => {
      if (sn.category === 'MENU') staffMenuActivityCount++;
      notifications.push({
        id: `sys-notif-${sn.id}`,
        category: sn.category,
        type: sn.type,
        severity: sn.severity,
        title: sn.title,
        description: sn.description,
        timestamp: sn.createdAt,
        actionUrl: sn.actionUrl || '/admin/products',
        actionLabel: sn.actionLabel || 'ดูเมนูสินค้า',
        metadata: {
          storeId: sn.storeId,
          storeName: sn.storeName,
          actorName: sn.actorName,
        },
      });
    });

    // Sort by priority (CRITICAL -> ACTION_REQUIRED -> WARNING -> INFO) then by date descending
    const severityRank: Record<string, number> = {
      CRITICAL: 1,
      ACTION_REQUIRED: 2,
      WARNING: 3,
      INFO: 4,
    };

    notifications.sort((a, b) => {
      const rankDiff = (severityRank[a.severity] || 99) - (severityRank[b.severity] || 99);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const totalActionable = outOfStockCount + lowStockCount + realPendingCount;

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalCount: notifications.length,
          totalActionable,
          outOfStockCount,
          lowStockCount,
          lowIngredientsCount: outOfStockCount + lowStockCount,
          pendingAdjustmentsCount: realPendingCount,
          discrepancyCount: discrepancyItemCount,
          recentActivityCount: recentTransactions.length,
          staffMenuActivityCount,
        },
        notifications,
      },
    });
  } catch (error: any) {
    console.error('Notifications API Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch notifications: ' + error.message },
      { status: 500 }
    );
  }
}

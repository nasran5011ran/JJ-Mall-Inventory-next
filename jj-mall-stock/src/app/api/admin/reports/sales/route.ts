import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงรายงานยอดขาย (Admin Only)' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'ALL'; // TODAY | YESTERDAY | THIS_WEEK | THIS_MONTH | ALL | CUSTOM
    const selectedDate = searchParams.get('date'); // YYYY-MM-DD
    const storeId = searchParams.get('storeId') || 'ALL';
    const paymentMethod = searchParams.get('paymentMethod') || 'ALL';

    const now = new Date();
    const whereClause: any = {};

    // 1. Date filter logic
    if (selectedDate) {
      const start = new Date(`${selectedDate}T00:00:00.000Z`);
      const end = new Date(`${selectedDate}T23:59:59.999Z`);
      whereClause.createdAt = { gte: start, lte: end };
    } else if (period === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      const start = new Date(`${todayStr}T00:00:00.000Z`);
      whereClause.createdAt = { gte: start };
    } else if (period === 'YESTERDAY') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const start = new Date(`${yesterdayStr}T00:00:00.000Z`);
      const end = new Date(`${yesterdayStr}T23:59:59.999Z`);
      whereClause.createdAt = { gte: start, lte: end };
    } else if (period === 'THIS_WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { gte: weekAgo };
    } else if (period === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      whereClause.createdAt = { gte: startOfMonth };
    }

    // 2. Store filter
    if (storeId !== 'ALL') {
      whereClause.createdById = Number(storeId);
    }

    // 3. Payment Method filter
    if (paymentMethod !== 'ALL') {
      whereClause.paymentMethod = paymentMethod;
    }

    // 4. Fetch Staff Stores for filter dropdown
    const staffStores = await prisma.user.findMany({
      where: { role: 'STAFF', status: 'ACTIVE' },
      select: { id: true, username: true, name: true },
      orderBy: { id: 'asc' },
    });

    // 5. Fetch sales matching filter
    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 6. Compute primary KPIs
    let totalRevenue = 0;
    let totalCups = 0;
    let cashRevenue = 0;
    let cashBills = 0;
    let qrRevenue = 0;
    let qrBills = 0;

    const productSalesMap = new Map<number, { id: number; code: string; name: string; unit: string; qty: number; revenue: number }>();
    const storeSalesMap = new Map<number, { storeId: number; storeName: string; username: string; revenue: number; bills: number; cups: number }>();

    // Initialize store sales map for all staff
    staffStores.forEach((st) => {
      storeSalesMap.set(st.id, {
        storeId: st.id,
        storeName: st.name,
        username: st.username,
        revenue: 0,
        bills: 0,
        cups: 0,
      });
    });

    // Hourly buckets (08:00 - 21:00)
    const hourlyMap = new Map<number, { hour: number; label: string; revenue: number; cups: number; bills: number }>();
    for (let h = 8; h <= 21; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      hourlyMap.set(h, { hour: h, label, revenue: 0, cups: 0, bills: 0 });
    }

    sales.forEach((s) => {
      const amount = Number(s.totalAmount);
      const cups = s.totalItems;
      totalRevenue += amount;
      totalCups += cups;

      // Payment method breakdown
      const pay = s.paymentMethod?.toUpperCase() || 'CASH';
      if (pay === 'CASH') {
        cashRevenue += amount;
        cashBills++;
      } else {
        qrRevenue += amount;
        qrBills++;
      }

      // Store breakdown
      const sId = s.createdById;
      if (!storeSalesMap.has(sId)) {
        storeSalesMap.set(sId, {
          storeId: sId,
          storeName: s.createdBy?.name || 'ร้านค้า',
          username: s.createdBy?.username || '',
          revenue: 0,
          bills: 0,
          cups: 0,
        });
      }
      const sStat = storeSalesMap.get(sId)!;
      sStat.revenue += amount;
      sStat.bills += 1;
      sStat.cups += cups;

      // Hourly breakdown
      const saleDate = new Date(s.createdAt);
      const hour = saleDate.getHours();
      if (hourlyMap.has(hour)) {
        const hStat = hourlyMap.get(hour)!;
        hStat.revenue += amount;
        hStat.cups += cups;
        hStat.bills += 1;
      }

      // Products breakdown
      s.items.forEach((item) => {
        const pId = item.productId;
        if (!productSalesMap.has(pId)) {
          productSalesMap.set(pId, {
            id: pId,
            code: item.product.code,
            name: item.product.name,
            unit: item.product.unit,
            qty: 0,
            revenue: 0,
          });
        }
        const pStat = productSalesMap.get(pId)!;
        pStat.qty += item.quantity;
        pStat.revenue += Number(item.subtotal);
      });
    });

    const totalBills = sales.length;
    const averageTicket = totalBills > 0 ? totalRevenue / totalBills : 0;

    // Top products sorted by revenue
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => ({
        ...p,
        percentage: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      }));

    const storeBreakdown = Array.from(storeSalesMap.values()).sort((a, b) => b.revenue - a.revenue);
    const hourlySales = Array.from(hourlyMap.values());

    return NextResponse.json({
      success: true,
      period,
      selectedDate,
      kpis: {
        totalRevenue,
        totalBills,
        totalCups,
        averageTicket,
      },
      paymentBreakdown: {
        cash: { revenue: cashRevenue, bills: cashBills, percentage: totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0 },
        qr: { revenue: qrRevenue, bills: qrBills, percentage: totalRevenue > 0 ? (qrRevenue / totalRevenue) * 100 : 0 },
      },
      storeBreakdown,
      hourlySales,
      topProducts,
      sales,
      staffStores,
    });
  } catch (error: any) {
    console.error('Error fetching sales report:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงรายงานยอดขาย: ' + error.message },
      { status: 500 }
    );
  }
}

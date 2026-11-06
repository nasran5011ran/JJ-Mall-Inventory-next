import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลร้านค้า (Admin Only)' },
        { status: 403 }
      );
    }

    // 1. Fetch all staff members (each staff represents a shop / counter cashier)
    const staffUsers = await prisma.user.findMany({
      where: { role: 'STAFF' },
      select: {
        id: true,
        username: true,
        name: true,
        status: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });

    // 2. Fetch all ingredients
    const allIngredients = await prisma.ingredient.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        currentStock: true,
        minStock: true,
        costPerUnit: true,
      },
      orderBy: { id: 'asc' },
    });

    // 3. Fetch all recipes
    const recipes = await prisma.recipe.findMany({
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    const productRecipeMap = new Map<number, any[]>();
    recipes.forEach((r) => {
      productRecipeMap.set(Number(r.productId), r.items);
    });

    // 4. Build rich store data for each staff shop from real database transactions
    const stores = await Promise.all(
      staffUsers.map(async (staff) => {
        // A. Real sales by this staff/store
        const sales = await prisma.sale.findMany({
          where: { createdById: staff.id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        let totalRevenue = 0;
        let totalCups = 0;
        const productStatsMap = new Map<number, { id: number; name: string; code: string; unit: string; qty: number; revenue: number }>();

        sales.forEach((s) => {
          totalRevenue += Number(s.totalAmount);
          totalCups += s.totalItems;

          s.items.forEach((item) => {
            const pId = Number(item.productId);

            // Product breakdown
            if (!productStatsMap.has(pId)) {
              productStatsMap.set(pId, {
                id: pId,
                name: item.product.name,
                code: item.product.code,
                unit: item.product.unit,
                qty: 0,
                revenue: 0,
              });
            }
            const pStat = productStatsMap.get(pId)!;
            pStat.qty += item.quantity;
            pStat.revenue += Number(item.subtotal);
          });
        });

        // B. Real stock transactions for this specific staff store from DB
        const staffStockTransactions = await prisma.stockTransaction.findMany({
          where: {
            OR: [
              { createdById: staff.id },
              { refId: `STORE-${staff.id}` },
            ],
          },
          include: {
            ingredient: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        // C. Real stock received into this store (PURCHASE_IN / Inbound Allocation)
        const receivedMap = new Map<number, { id: number; name: string; code: string; unit: string; totalReceived: number; lastDate: string }>();
        staffStockTransactions
          .filter((tx) => tx.type === 'PURCHASE_IN' || Number(tx.quantityIn) > 0)
          .forEach((tx) => {
            const ingId = tx.ingredientId;
            if (!receivedMap.has(ingId)) {
              receivedMap.set(ingId, {
                id: ingId,
                name: tx.ingredient.name,
                code: tx.ingredient.code,
                unit: tx.ingredient.unit,
                totalReceived: 0,
                lastDate: tx.createdAt.toISOString(),
              });
            }
            receivedMap.get(ingId)!.totalReceived += Number(tx.quantityIn);
          });

        const stockReceivedList = Array.from(receivedMap.values());

        // D. Real ingredient deductions from sales (SALE_DEDUCT) recorded in DB
        const ingredientDeductionsMap = new Map<number, { id: number; name: string; code: string; unit: string; deductedQty: number }>();
        staffStockTransactions
          .filter((tx) => tx.type === 'SALE_DEDUCT' || Number(tx.quantityOut) > 0)
          .forEach((tx) => {
            const ingId = tx.ingredientId;
            if (!ingredientDeductionsMap.has(ingId)) {
              ingredientDeductionsMap.set(ingId, {
                id: ingId,
                name: tx.ingredient.name,
                code: tx.ingredient.code,
                unit: tx.ingredient.unit,
                deductedQty: 0,
              });
            }
            ingredientDeductionsMap.get(ingId)!.deductedQty += Number(tx.quantityOut);
          });

        const ingredientDeductionsList = Array.from(ingredientDeductionsMap.values());

        return {
          id: staff.id,
          name: staff.name,
          username: staff.username,
          status: staff.status,
          createdAt: staff.createdAt,
          metrics: {
            totalRevenue,
            totalBills: sales.length,
            totalCups,
          },
          topProducts: Array.from(productStatsMap.values()).sort((a, b) => b.qty - a.qty),
          ingredientDeductions: ingredientDeductionsList.sort((a, b) => b.deductedQty - a.deductedQty),
          stockReceived: stockReceivedList,
          recentSales: sales.slice(0, 20),
        };
      })
    );

    return NextResponse.json({
      success: true,
      stores,
      allIngredients,
    });
  } catch (error: any) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านค้า: ' + error.message },
      { status: 500 }
    );
  }
}

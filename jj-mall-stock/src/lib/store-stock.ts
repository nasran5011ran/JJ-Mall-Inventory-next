import prisma from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

export interface StoreIngredientBalance {
  ingredientId: number;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  costPerUnit: number;
  warehouseStock: number;
  openingQuantity: number;
  inboundQuantity: number;
  salesQuantity: number;
  expectedStock: number;
  hasStockHistory: boolean;
}

// Helper: Calculate store reconciliation (Opening + Inbound - Sales = Expected in-store)
export async function calculateStoreReconciliation(storeId: number): Promise<StoreIngredientBalance[]> {
  const targetStore = await prisma.user.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, username: true },
  });
  if (!targetStore) return [];

  // Find the most recent completed stock count for this store
  const lastCount = await prisma.stockCount.findFirst({
    where: {
      location: 'STORE',
      storeId: targetStore.id,
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  const sinceDate = lastCount ? lastCount.createdAt : new Date(0);

  // Active ingredients
  const ingredients = await prisma.ingredient.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      unit: true,
      costPerUnit: true,
      currentStock: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  // Inbound purchases directly into this store, or store allocations since last count
  const inboundTxs = await prisma.stockTransaction.findMany({
    where: {
      createdAt: { gt: sinceDate },
      OR: [
        {
          type: TransactionType.PURCHASE_IN,
          OR: [
            { createdById: targetStore.id },
            { note: { contains: `@${targetStore.username}` } },
            { note: { contains: targetStore.name } },
            { note: { contains: `[STORE_ID:${targetStore.id}]` } },
          ],
        },
        {
          type: TransactionType.TRANSFER_OUT,
          OR: [
            { note: { contains: `@${targetStore.username}` } },
            { note: { contains: targetStore.name } },
            { note: { contains: `[STORE_ID:${targetStore.id}]` } },
          ],
        },
      ],
    },
  });

  const inboundMap = new Map<number, number>();
  for (const tx of inboundTxs) {
    const qty = tx.type === TransactionType.PURCHASE_IN ? Number(tx.quantityIn) : Number(tx.quantityOut);
    const prev = inboundMap.get(tx.ingredientId) || 0;
    inboundMap.set(tx.ingredientId, prev + qty);
  }

  // Sales usage from POS transactions by this store since last count
  const saleDeductTxs = await prisma.stockTransaction.findMany({
    where: {
      type: TransactionType.SALE_DEDUCT,
      createdById: targetStore.id,
      createdAt: { gt: sinceDate },
    },
  });

  const salesMap = new Map<number, number>();
  for (const tx of saleDeductTxs) {
    const prev = salesMap.get(tx.ingredientId) || 0;
    salesMap.set(tx.ingredientId, prev + Number(tx.quantityOut));
  }

  // Adjustments for this store since last count (waste, damage, manual adjustment)
  const adjustmentTxs = await prisma.stockTransaction.findMany({
    where: {
      type: { in: [TransactionType.ADJUST_SUB, TransactionType.ADJUST_ADD] },
      createdAt: { gt: sinceDate },
      OR: [
        { note: { contains: `[STORE_ID:${targetStore.id}]` } },
        { note: { contains: `@${targetStore.username}` } },
      ],
    },
  });

  const adjustmentDiffMap = new Map<number, number>();
  for (const tx of adjustmentTxs) {
    const prev = adjustmentDiffMap.get(tx.ingredientId) || 0;
    if (tx.type === TransactionType.ADJUST_SUB) {
      adjustmentDiffMap.set(tx.ingredientId, prev - Number(tx.quantityOut));
    } else if (tx.type === TransactionType.ADJUST_ADD) {
      adjustmentDiffMap.set(tx.ingredientId, prev + Number(tx.quantityIn));
    }
  }

  const lastCountItemsMap = new Map<number, number>();
  if (lastCount && lastCount.items) {
    for (const item of lastCount.items) {
      lastCountItemsMap.set(item.ingredientId, Number(item.actualQuantity));
    }
  }

  return ingredients.map((ing) => {
    const opening = lastCountItemsMap.get(ing.id) ?? 0;
    const inbound = inboundMap.get(ing.id) ?? 0;
    const sales = salesMap.get(ing.id) ?? 0;
    const adj = adjustmentDiffMap.get(ing.id) ?? 0;
    const expected = Math.max(0, opening + inbound - sales + adj);
    const hasStockHistory = opening > 0 || inbound > 0 || lastCountItemsMap.has(ing.id);

    return {
      ingredientId: ing.id,
      code: ing.code,
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      costPerUnit: Number(ing.costPerUnit || 0),
      warehouseStock: Number(ing.currentStock),
      openingQuantity: opening,
      inboundQuantity: inbound,
      salesQuantity: sales,
      expectedStock: expected,
      hasStockHistory,
    };
  });
}

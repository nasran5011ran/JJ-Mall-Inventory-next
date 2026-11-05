import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/recipes/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const recipeId = parseInt(id, 10);

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        product: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json({ success: false, message: 'ไม่พบสูตรการผลิต' }, { status: 404 });
    }

    let totalBOMCost = 0;
    recipe.items.forEach((item) => {
      totalBOMCost += Number(item.quantity) * Number(item.ingredient.costPerUnit || 0);
    });

    return NextResponse.json({
      success: true,
      recipe: {
        ...recipe,
        totalBOMCost,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/recipes/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const recipeId = parseInt(id, 10);
    const body = await req.json();
    const { description, items, updateProductCost } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุวัตถุดิบอย่างน้อย 1 รายการ' }, { status: 400 });
    }

    const validItems = items.filter(
      (it: any) => it.ingredientId && Number(it.quantity) > 0
    );

    // Delete existing recipe items and recreate
    await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({
        where: { recipeId },
      });

      await tx.recipe.update({
        where: { id: recipeId },
        data: {
          description: description?.trim() || null,
          items: {
            create: validItems.map((it: any) => ({
              ingredientId: Number(it.ingredientId),
              quantity: Number(it.quantity),
              unit: it.unit?.trim() || 'หน่วย',
            })),
          },
        },
      });
    });

    // Re-fetch updated recipe
    const updatedRecipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        product: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    let calculatedCost = 0;
    let minMaxCups = Infinity;
    let limitingIngredient: any = null;

    updatedRecipe!.items.forEach((it) => {
      calculatedCost += Number(it.quantity) * Number(it.ingredient.costPerUnit || 0);
      const currentStock = Number(it.ingredient.currentStock);
      const qtyPerCup = Number(it.quantity);
      if (qtyPerCup > 0) {
        const maxCups = Math.floor(currentStock / qtyPerCup);
        if (maxCups < minMaxCups) {
          minMaxCups = maxCups;
          limitingIngredient = {
            name: it.ingredient.name,
            code: it.ingredient.code,
            currentStock,
            qtyPerCup,
            unit: it.unit,
          };
        }
      }
    });

    if (updateProductCost && updatedRecipe) {
      await prisma.product.update({
        where: { id: updatedRecipe.productId },
        data: { cost: calculatedCost },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'อัปเดตสูตรการผลิต (BOM) เรียบร้อยแล้ว',
      recipe: {
        ...updatedRecipe,
        totalBOMCost: calculatedCost,
        maxCupsAvailable: minMaxCups === Infinity ? 0 : Math.max(0, minMaxCups),
        limitingIngredient,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/recipes/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบสูตรได้' }, { status: 403 });
    }

    const { id } = await params;
    const recipeId = parseInt(id, 10);

    await prisma.recipe.delete({
      where: { id: recipeId },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบสูตรการผลิตเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

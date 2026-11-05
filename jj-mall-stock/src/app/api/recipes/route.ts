import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/recipes - List all recipes with ingredients and calculations
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    const where: any = {};
    if (productId) {
      where.productId = parseInt(productId, 10);
    }

    const recipes = await prisma.recipe.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    // Compute metrics for each recipe
    const enrichedRecipes = recipes.map((recipe) => {
      let totalBOMCost = 0;
      let minMaxCups = Infinity;
      let limitingIngredient: any = null;

      recipe.items.forEach((item) => {
        const itemCost = Number(item.quantity) * Number(item.ingredient.costPerUnit || 0);
        totalBOMCost += itemCost;

        // Calculate max cups this ingredient can support
        const currentStock = Number(item.ingredient.currentStock);
        const qtyPerCup = Number(item.quantity);
        if (qtyPerCup > 0) {
          const maxCups = Math.floor(currentStock / qtyPerCup);
          if (maxCups < minMaxCups) {
            minMaxCups = maxCups;
            limitingIngredient = {
              name: item.ingredient.name,
              code: item.ingredient.code,
              currentStock,
              qtyPerCup,
              unit: item.unit,
            };
          }
        }
      });

      const maxCupsAvailable = minMaxCups === Infinity ? 0 : Math.max(0, minMaxCups);
      const sellingPrice = Number(recipe.product.price);
      const margin = sellingPrice - totalBOMCost;
      const marginPercent = sellingPrice > 0 ? Math.round((margin / sellingPrice) * 100) : 0;

      return {
        ...recipe,
        totalBOMCost,
        margin,
        marginPercent,
        maxCupsAvailable,
        limitingIngredient,
      };
    });

    // Also get all products that don't have a recipe yet
    const productsWithoutRecipe = await prisma.product.findMany({
      where: {
        recipe: null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        price: true,
      },
    });

    // Get all active ingredients for dropdown selection
    const ingredients = await prisma.ingredient.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        currentStock: true,
        costPerUnit: true,
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      recipes: enrichedRecipes,
      productsWithoutRecipe,
      ingredients,
    });
  } catch (error: any) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสูตรการผลิต: ' + error.message },
      { status: 500 }
    );
  }
}

// POST /api/recipes - Create a new recipe
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, description, items, updateProductCost } = body;

    if (!productId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาเลือกสินค้าและระบุวัตถุดิบอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Check if recipe already exists for this product
    const existing = await prisma.recipe.findUnique({
      where: { productId: Number(productId) },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'สินค้านี้มีสูตรการผลิตอยู่แล้ว กรุณาใช้ฟังก์ชันแก้ไขสูตร' },
        { status: 409 }
      );
    }

    // Filter valid items
    const validItems = items.filter(
      (it: any) => it.ingredientId && Number(it.quantity) > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'กรุณาระบุวัตถุดิบและปริมาณที่มากกว่า 0' },
        { status: 400 }
      );
    }

    // Create recipe and items in transaction
    const newRecipe = await prisma.recipe.create({
      data: {
        productId: Number(productId),
        description: description?.trim() || null,
        items: {
          create: validItems.map((it: any) => ({
            ingredientId: Number(it.ingredientId),
            quantity: Number(it.quantity),
            unit: it.unit?.trim() || 'หน่วย',
          })),
        },
      },
      include: {
        product: true,
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    // Optionally calculate and update product cost
    let calculatedCost = 0;
    newRecipe.items.forEach((it) => {
      calculatedCost += Number(it.quantity) * Number(it.ingredient.costPerUnit || 0);
    });

    if (updateProductCost) {
      await prisma.product.update({
        where: { id: Number(productId) },
        data: { cost: calculatedCost },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกสูตรการผลิต (BOM) ใหม่เรียบร้อยแล้ว',
      recipe: {
        ...newRecipe,
        totalBOMCost: calculatedCost,
      },
    });
  } catch (error: any) {
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการสร้างสูตร: ' + error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/ingredients/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขวัตถุดิบได้' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const ingredientId = parseInt(id, 10);

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      include: {
        recipeItems: {
          include: {
            recipe: {
              include: {
                product: true,
              },
            },
          },
        },
        stockTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { name: true } },
          },
        },
      },
    });

    if (!ingredient) {
      return NextResponse.json({ success: false, message: 'ไม่พบวัตถุดิบ' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ingredient });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/ingredients/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขวัตถุดิบได้' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const ingredientId = parseInt(id, 10);
    const body = await req.json();
    const { code, name, category, unit, currentStock, minStock, costPerUnit, status } = body;

    // Check code collision
    if (code) {
      const existing = await prisma.ingredient.findFirst({
        where: {
          code: code.trim().toUpperCase(),
          id: { not: ingredientId },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: `รหัสวัตถุดิบ "${code}" ถูกใช้งานโดยวัตถุดิบอื่นแล้ว` },
          { status: 409 }
        );
      }
    }

    // Check name collision
    if (name) {
      const existingName = await prisma.ingredient.findFirst({
        where: {
          name: name.trim(),
          id: { not: ingredientId },
        },
      });

      if (existingName) {
        return NextResponse.json(
          { success: false, message: `ชื่อวัตถุดิบ "${name.trim()}" ถูกใช้งานโดยวัตถุดิบอื่นแล้ว (รหัส: ${existingName.code}) ไม่สามารถใช้ชื่อซ้ำได้` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: {
        ...(code && { code: code.trim().toUpperCase() }),
        ...(name && { name: name.trim() }),
        ...(category !== undefined && { category: category.trim() }),
        ...(unit !== undefined && { unit: unit.trim() }),
        ...(currentStock !== undefined && currentStock !== '' && { currentStock: Number(currentStock) }),
        ...(minStock !== undefined && minStock !== '' && { minStock: Number(minStock) }),
        ...(costPerUnit !== undefined && costPerUnit !== '' && { costPerUnit: Number(costPerUnit) }),
        ...(status && { status }),
      },
      include: {
        _count: {
          select: {
            recipeItems: true,
            stockTransactions: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'อัปเดตข้อมูลวัตถุดิบเรียบร้อยแล้ว',
      ingredient: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/ingredients/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบวัตถุดิบได้' }, { status: 403 });
    }

    const { id } = await params;
    const ingredientId = parseInt(id, 10);

    // Check if ingredient is referenced in recipes or stock transactions
    const [recipeCount, txCount] = await Promise.all([
      prisma.recipeItem.count({ where: { ingredientId } }),
      prisma.stockTransaction.count({ where: { ingredientId } }),
    ]);

    if (recipeCount > 0 || txCount > 0) {
      // Soft-delete by setting status = INACTIVE
      await prisma.ingredient.update({
        where: { id: ingredientId },
        data: { status: 'INACTIVE' },
      });

      return NextResponse.json({
        success: true,
        message: `วัตถุดิบนี้ถูกนำไปใช้ในสูตรสินค้า (${recipeCount} สูตร) หรือมีประวัติสต็อกแล้ว ระบบจึงเปลี่ยนสถานะเป็น "ระงับการใช้งาน" เพื่อรักษาความถูกต้องของข้อมูล`,
      });
    }

    // Hard delete if completely unused
    await prisma.ingredient.delete({
      where: { id: ingredientId },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบวัตถุดิบออกจากระบบเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

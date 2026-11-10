import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/products/[id]
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
        { success: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขสินค้าได้ พนักงานขายไม่มีสิทธิ์นี้' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id, 10);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ success: false, message: 'ไม่พบสินค้า' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT /api/products/[id]
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
    const productId = parseInt(id, 10);
    const body = await req.json();
    const { code, name, category, unit, price, cost, minStock, status, storeId } = body;

    // Check existing product and permission
    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!currentProduct) {
      return NextResponse.json({ success: false, message: 'ไม่พบสินค้า' }, { status: 404 });
    }

    if (session.role === 'STAFF' && currentProduct.storeId && currentProduct.storeId !== session.id) {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์แก้ไขเมนูของร้านค้าอื่น' },
        { status: 403 }
      );
    }

    // Check code collision if code changed
    if (code) {
      const existing = await prisma.product.findFirst({
        where: {
          code: code.trim(),
          id: { not: productId },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: `รหัสสินค้า "${code}" ถูกใช้โดยสินค้าอื่นแล้ว` },
          { status: 409 }
        );
      }
    }

    const updateData: any = {
      ...(code && { code: code.trim().toUpperCase() }),
      ...(name && { name: name.trim() }),
      ...(category !== undefined && { category: category.trim() }),
      ...(unit !== undefined && { unit: unit.trim() }),
      ...(price !== undefined && { price: Number(price) }),
      ...(cost !== undefined && { cost: cost !== '' ? Number(cost) : null }),
      ...(minStock !== undefined && { minStock: Number(minStock) }),
      ...(status && { status }),
    };

    // เฉพาะ Admin เท่านั้นที่สามารถเปลี่ยนร้านค้าเจ้าของเมนูได้
    if (session.role === 'ADMIN' && storeId !== undefined) {
      updateData.storeId = storeId ? Number(storeId) : null;
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        recipe: {
          include: {
            items: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });

    // แจ้งเตือนแอดมินเมื่อพนักงานประจำร้านค้าทำการแก้ไขเมนู
    if (session.role === 'STAFF') {
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'MENU',
            type: 'MENU_UPDATE',
            severity: 'INFO',
            title: `ร้านค้า "${session.name}" ได้แก้ไขข้อมูลเมนู: ${updated.name}`,
            description: `อัปเดตข้อมูลเมนู รหัส ${updated.code} ราคาขาย ฿${updated.price} สถานะ: ${updated.status === 'ACTIVE' ? 'เปิดจำหน่าย' : 'ระงับการขาย'}`,
            actionUrl: `/admin/products?search=${encodeURIComponent(updated.code)}`,
            actionLabel: 'ดูรายละเอียดเมนู',
            storeId: session.id,
            storeName: session.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (e) {
        console.error('Failed to log system notification:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว',
      product: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);

    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!currentProduct) {
      return NextResponse.json({ success: false, message: 'ไม่พบสินค้า' }, { status: 404 });
    }

    if (session.role === 'STAFF' && currentProduct.storeId && currentProduct.storeId !== session.id) {
      return NextResponse.json(
        { success: false, message: 'ไม่มีสิทธิ์ลบเมนูของร้านค้าอื่น' },
        { status: 403 }
      );
    }

    // Check if product is in any sales
    const salesCount = await prisma.saleItem.count({
      where: { productId },
    });

    if (salesCount > 0) {
      // If sold before, do soft-delete by setting status to INACTIVE
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'INACTIVE' },
      });

      // แจ้งเตือนแอดมินเมื่อพนักงานประจำร้านระงับการขายเมนู
      if (session.role === 'STAFF') {
        try {
          await prisma.systemNotification.create({
            data: {
              category: 'MENU',
              type: 'MENU_DELETE',
              severity: 'WARNING',
              title: `ร้านค้า "${session.name}" ได้ระงับการขายเมนู: ${currentProduct.name}`,
              description: `เมนูรหัส ${currentProduct.code} มีประวัติการขายในระบบ จึงถูกเปลี่ยนสถานะเป็นระงับการขาย`,
              actionUrl: `/admin/products?search=${encodeURIComponent(currentProduct.code)}`,
              actionLabel: 'ดูรายการสินค้า',
              storeId: session.id,
              storeName: session.name,
              actorId: session.id,
              actorName: session.name,
            },
          });
        } catch (e) {
          console.error('Failed to log system notification:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'สินค้านี้มีประวัติการขายในระบบแล้ว จึงได้เปลี่ยนสถานะเป็น "ระงับการขาย" (Inactive) เพื่อรักษาประวัติการขาย',
      });
    }

    // Otherwise, can hard delete
    await prisma.product.delete({
      where: { id: productId },
    });

    // แจ้งเตือนแอดมินเมื่อพนักงานประจำร้านลบเมนู
    if (session.role === 'STAFF') {
      try {
        await prisma.systemNotification.create({
          data: {
            category: 'MENU',
            type: 'MENU_DELETE',
            severity: 'WARNING',
            title: `ร้านค้า "${session.name}" ได้ลบเมนู: ${currentProduct.name}`,
            description: `เมนูรหัส ${currentProduct.code} ถูกลบออกจากระบบของร้านค้าแล้ว`,
            actionUrl: `/admin/products`,
            actionLabel: 'ดูรายการสินค้า',
            storeId: session.id,
            storeName: session.name,
            actorId: session.id,
            actorName: session.name,
          },
        });
      } catch (e) {
        console.error('Failed to log system notification:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ลบสินค้าออกจากระบบเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

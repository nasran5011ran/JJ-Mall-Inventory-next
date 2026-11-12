import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: Fetch single requisition by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const reqId = parseInt(id, 10);

    const requisition = await prisma.stockRequisition.findUnique({
      where: { id: reqId },
      include: {
        store: { select: { id: true, name: true, username: true } },
        approvedBy: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json({ success: false, message: 'ไม่พบใบขอเบิก' }, { status: 404 });
    }

    if (session.role === 'STAFF' && requisition.storeId !== session.id) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
    }

    return NextResponse.json({ success: true, requisition });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE: Cancel a pending requisition (Staff can cancel their own pending request)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const reqId = parseInt(id, 10);

    const requisition = await prisma.stockRequisition.findUnique({
      where: { id: reqId },
    });

    if (!requisition) {
      return NextResponse.json({ success: false, message: 'ไม่พบใบขอเบิก' }, { status: 404 });
    }

    if (session.role === 'STAFF' && requisition.storeId !== session.id) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ยกเลิกใบขอเบิกนี้' }, { status: 403 });
    }

    if (requisition.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: 'สามารถยกเลิกได้เฉพาะใบขอเบิกที่รออนุมัติเท่านั้น' }, { status: 400 });
    }

    await prisma.stockRequisition.delete({
      where: { id: reqId },
    });

    return NextResponse.json({ success: true, message: 'ยกเลิกใบขอเบิกเรียบร้อยแล้ว' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

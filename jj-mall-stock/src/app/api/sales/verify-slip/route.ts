import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { verifyBankSlip } from '@/lib/slip-verification';

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
    const { qrData, imageBase64, expectedAmount } = body;

    const amountNum = Number(expectedAmount);
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json(
        { success: false, message: 'ยอดเงินที่ต้องชำระไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // 1. Verify slip authenticity and amount
    const verifyResult = await verifyBankSlip({
      qrData,
      imageBase64,
      expectedAmount: amountNum,
    });

    if (!verifyResult.success || !verifyResult.data) {
      return NextResponse.json(
        { success: false, message: verifyResult.message },
        { status: 400 }
      );
    }

    const { transRef } = verifyResult.data;

    // 2. Anti-fraud: Check duplicate slip usage across all past sales!
    if (transRef) {
      const existingSaleWithSlip = await prisma.sale.findFirst({
        where: {
          note: {
            contains: transRef,
          },
        },
        select: {
          id: true,
          saleNumber: true,
          totalAmount: true,
          createdAt: true,
        },
      });

      if (existingSaleWithSlip) {
        return NextResponse.json(
          {
            success: false,
            message: `⚠️ สลิปนี้ถูกใช้งานไปแล้วในใบเสร็จเลขที่ "${existingSaleWithSlip.saleNumber}" เมื่อเวลา ${new Date(existingSaleWithSlip.createdAt).toLocaleString('th-TH')} ไม่สามารถนำมาใช้ซ้ำได้!`,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ตรวจสอบสลิปโอนเงินสำเร็จ ยอดเงินถูกต้อง พร้อมยืนยันการขาย',
      data: verifyResult.data,
    });
  } catch (error: any) {
    console.error('Error verifying slip:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' },
      { status: 500 }
    );
  }
}

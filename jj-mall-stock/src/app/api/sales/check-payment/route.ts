import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkBankPayment, recordBankPayment } from '@/lib/payment-listener';

// GET: POS Terminal checks if money has arrived in the bank
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get('amount');
    const storeIdStr = searchParams.get('storeId');

    const amount = amountStr ? parseFloat(amountStr) : 0;
    const storeId = storeIdStr ? parseInt(storeIdStr, 10) : session.id;

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, paid: false, message: 'Invalid amount' });
    }

    const signal = checkBankPayment(storeId, amount);

    if (signal) {
      return NextResponse.json({
        success: true,
        paid: true,
        message: 'ได้รับเงินเข้าบัญชีธนาคารเรียบร้อยแล้ว',
        signal,
      });
    }

    return NextResponse.json({
      success: true,
      paid: false,
      message: 'กำลังรอการโอนเงินจากลูกค้า...',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Trigger instant payment signal (Webhook / Simulation / Store trigger)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, storeId, txRef, bank } = body;

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      return NextResponse.json({ success: false, message: 'ยอดเงินไม่ถูกต้อง' }, { status: 400 });
    }

    const ref = txRef || `TXN${Date.now()}`;
    recordBankPayment({
      txRef: ref,
      storeId: storeId ? parseInt(storeId, 10) : null,
      amount: amountNum,
      bank: bank || 'BANK_TRANSFER',
    });

    return NextResponse.json({
      success: true,
      message: `บันทึกสัญญาณเงินเข้า ฿${amountNum.toFixed(2)} สำเร็จ`,
      txRef: ref,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

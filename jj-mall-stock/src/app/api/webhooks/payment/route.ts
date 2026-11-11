import { NextRequest, NextResponse } from 'next/server';
import { recordBankPayment } from '@/lib/payment-listener';

/**
 * Universal Bank & Payment Gateway Webhook Receiver
 * Compatible with GB Prime Pay, Omise, SCB, KBank, and Bank Notification Webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Parse form-urlencoded if sent as form
      const params = new URLSearchParams(rawBody);
      params.forEach((value, key) => {
        body[key] = value;
      });
    }

    // Extract amount and reference from various gateway formats
    const amount =
      body.amount ??
      body.totalAmount ??
      body.value ??
      (body.charge ? body.charge.amount / 100 : 0);

    const txRef =
      body.referenceNo ??
      body.referenceId ??
      body.transactionId ??
      body.id ??
      body.orderId ??
      `TXN_${Date.now()}`;

    const storeId = body.storeId ?? body.merchantId ?? null;
    const bank = body.bank ?? body.paymentType ?? 'PROMPTPAY';

    if (amount && Number(amount) > 0) {
      recordBankPayment({
        txRef: String(txRef),
        storeId: storeId ? parseInt(storeId, 10) : null,
        amount: Number(amount),
        bank: String(bank),
      });

      console.log(`[Bank Webhook] Payment Received: ฿${amount} (Ref: ${txRef})`);
    }

    return NextResponse.json({ success: true, message: 'Webhook received and processed' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * In-memory Payment Notification Listener & Store
 * Manages real-time bank payment signals for POS terminals
 */

interface PaymentSignal {
  txRef: string;
  storeId?: number | null;
  amount: number;
  bank?: string;
  timestamp: number;
}

// Store recent payment signals for 5 minutes
const paymentSignals: Map<string, PaymentSignal> = new Map();

/**
 * Register incoming payment from Bank Webhook or Gateway
 */
export function recordBankPayment(signal: {
  txRef: string;
  storeId?: number | null;
  amount: number;
  bank?: string;
}) {
  const key = `${signal.storeId ?? 'CENTRAL'}_${signal.amount.toFixed(2)}`;
  paymentSignals.set(key, {
    ...signal,
    timestamp: Date.now(),
  });

  // Cleanup old signals older than 5 minutes
  const now = Date.now();
  for (const [k, v] of paymentSignals.entries()) {
    if (now - v.timestamp > 5 * 60 * 1000) {
      paymentSignals.delete(k);
    }
  }
}

/**
 * Check if payment has been received for a store and amount
 */
export function checkBankPayment(storeId: number | null | undefined, amount: number): PaymentSignal | null {
  const key = `${storeId ?? 'CENTRAL'}_${amount.toFixed(2)}`;
  const signal = paymentSignals.get(key);

  if (signal && Date.now() - signal.timestamp <= 5 * 60 * 1000) {
    // Consume signal so it isn't used twice
    paymentSignals.delete(key);
    return signal;
  }

  // Also check without storeId constraint (fallback for single-store setups)
  for (const [k, v] of paymentSignals.entries()) {
    if (Math.abs(v.amount - amount) < 0.01 && Date.now() - v.timestamp <= 5 * 60 * 1000) {
      paymentSignals.delete(k);
      return v;
    }
  }

  return null;
}

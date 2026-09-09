import { PaymentMode } from './enums';

/** Response from POST /api/receipts/scan. */
export interface ScannedReceipt {
  merchantName: string | null;
  date: string;
  totalAmount: number;
  subTotal: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  currency: string;
  paymentMode: PaymentMode;
  category: string;
  notes: string | null;
  items: { name: string; price: number; qty: number }[];
  confidence: number;
  /** Non-fatal issues to surface before the user saves. */
  warnings: string[];
  meta: {
    model: string;
    scannedAt: string;
    processingMs: number;
    itemsTotal: number;
  };
}

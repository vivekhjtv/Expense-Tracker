import { ExpenseCategory, PaymentMode } from '../../../common/enums';

/** Raw, untrusted shape as it comes back from the model. Everything optional. */
export interface RawReceiptExtraction {
  merchantName?: string | null;
  date?: string | null;
  totalAmount?: number | null;
  subTotal?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  currency?: string | null;
  paymentMode?: string | null;
  category?: string | null;
  notes?: string | null;
  confidence?: number | null;
  isReceipt?: boolean | null;
  items?: Array<{
    name?: string | null;
    price?: number | null;
    qty?: number | null;
  } | null> | null;
}

/** Normalised, validated shape the Angular form can trust. */
export interface ReceiptLineItem {
  name: string;
  price: number;
  qty: number;
}

export interface ScannedReceipt {
  merchantName: string | null;
  date: string; // ISO-8601, always present (falls back to today)
  totalAmount: number;
  subTotal: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  currency: string;
  paymentMode: PaymentMode;
  category: ExpenseCategory;
  notes: string | null;
  items: ReceiptLineItem[];
  /** 0–1, the model's self-reported legibility confidence. */
  confidence: number;
  /** Non-fatal issues the user should eyeball before saving. */
  warnings: string[];
  meta: {
    model: string;
    scannedAt: string;
    processingMs: number;
    itemsTotal: number;
  };
}

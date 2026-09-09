import { PaymentMode, TransactionType } from './enums';

export interface LineItem {
  name: string;
  price: number;
  qty: number;
  /** Virtual from the API — price * qty. */
  lineTotal?: number;
}

export interface Transaction {
  _id: string;
  amount: number;
  type: TransactionType;
  paymentMode: PaymentMode;
  category: string;
  date: string;
  items?: LineItem[];
  notes?: string;
  merchantName?: string;
  tags?: string[];
  source: 'MANUAL' | 'AI_SCAN' | 'IMPORT';
  createdAt: string;
  updatedAt: string;
}

export interface TransactionPayload {
  amount: number;
  type?: TransactionType;
  paymentMode: PaymentMode;
  category?: string;
  date: string;
  items?: LineItem[];
  notes?: string;
  merchantName?: string;
  tags?: string[];
  source?: 'MANUAL' | 'AI_SCAN' | 'IMPORT';
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

import { PaymentMode } from './enums';

export interface DashboardSummary {
  totalSpend: number;
  totalIncome: number;
  cashSpend: number;
  onlineSpend: number;
  cashSharePct: number;
  onlineSharePct: number;
  transactionCount: number;
  averageDailySpend: number;
  largestSpend: number;
  topCategory: { category: string; total: number } | null;
  range: { from: string | null; to: string | null };
}

export interface DailyPoint {
  date: string;
  total: number;
  count: number;
}

export interface CategorySlice {
  category: string;
  total: number;
  count: number;
  sharePct: number;
}

export interface PaymentModeSlice {
  paymentMode: PaymentMode;
  total: number;
  count: number;
  sharePct: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  dailyTrend: DailyPoint[];
  categories: CategorySlice[];
  paymentModes: PaymentModeSlice[];
}

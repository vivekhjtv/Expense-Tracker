/**
 * Mirrors the API enums exactly. Kept as `as const` objects rather than TS
 * `enum`s so the values erase to plain strings at runtime — that keeps them
 * safe to compare against raw JSON straight off the wire.
 */

export const TransactionType = {
  EXPENSE: 'EXPENSE',
  INCOME: 'INCOME',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const PaymentMode = {
  CASH: 'CASH',
  ONLINE_BANKING: 'ONLINE_BANKING',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const DateRangePreset = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH',
  THIS_YEAR: 'THIS_YEAR',
  ALL: 'ALL',
  CUSTOM: 'CUSTOM',
} as const;
export type DateRangePreset = (typeof DateRangePreset)[keyof typeof DateRangePreset];

export interface CategoryMeta {
  readonly value: string;
  readonly label: string;
  readonly icon: string;
}

/** Order is deliberate: the categories an Indian user reaches for most come first. */
export const EXPENSE_CATEGORIES: readonly CategoryMeta[] = [
  { value: 'GROCERIES', label: 'Groceries', icon: '🛒' },
  { value: 'FOOD_DINING', label: 'Food & Dining', icon: '🍽️' },
  { value: 'TRANSPORT', label: 'Transport', icon: '🚕' },
  { value: 'FUEL', label: 'Fuel', icon: '⛽' },
  { value: 'SHOPPING', label: 'Shopping', icon: '🛍️' },
  { value: 'UTILITIES', label: 'Utilities', icon: '💡' },
  { value: 'RENT', label: 'Rent', icon: '🏠' },
  { value: 'HEALTH', label: 'Health', icon: '💊' },
  { value: 'ENTERTAINMENT', label: 'Entertainment', icon: '🎬' },
  { value: 'EDUCATION', label: 'Education', icon: '📚' },
  { value: 'TRAVEL', label: 'Travel', icon: '✈️' },
  { value: 'PERSONAL_CARE', label: 'Personal Care', icon: '💇' },
  { value: 'SUBSCRIPTIONS', label: 'Subscriptions', icon: '🔁' },
  { value: 'INVESTMENTS', label: 'Investments', icon: '📈' },
  { value: 'OTHER', label: 'Other', icon: '🏷️' },
] as const;

export const INCOME_CATEGORIES: readonly CategoryMeta[] = [
  { value: 'SALARY', label: 'Salary', icon: '💰' },
  { value: 'INVESTMENTS', label: 'Investments', icon: '📈' },
  { value: 'OTHER', label: 'Other', icon: '🏷️' },
] as const;

export function categoryMeta(value: string | null | undefined): CategoryMeta {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return (
    all.find((c) => c.value === value) ?? {
      value: value ?? 'OTHER',
      label: (value ?? 'Other').replace(/_/g, ' ').toLowerCase(),
      icon: '🏷️',
    }
  );
}

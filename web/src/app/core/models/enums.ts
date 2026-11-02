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

export const CUSTOM_CATEGORIES_STORAGE_KEY = 'expense-tracker.custom-categories';
export const CATEGORY_OVERRIDES_STORAGE_KEY = 'expense-tracker.category-overrides';
export const DELETED_CATEGORIES_STORAGE_KEY = 'expense-tracker.deleted-categories';

export interface CategoryMeta {
  readonly value: string;
  readonly label: string;
  readonly icon: string;
  readonly isCustom?: boolean;
  readonly isEdited?: boolean;
  readonly originalLabel?: string;
  readonly originalIcon?: string;
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
  if (!value) {
    return { value: 'OTHER', label: 'Other', icon: '🏷️' };
  }

  try {
    // 1. Check custom categories
    const customRaw = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (customRaw) {
      const parsed = JSON.parse(customRaw);
      if (Array.isArray(parsed)) {
        const custom = parsed.find((c: any) => c.value === value);
        if (custom) return { ...custom, isCustom: true };
      }
    }

    // 2. Check category overrides for default categories
    const overridesRaw = localStorage.getItem(CATEGORY_OVERRIDES_STORAGE_KEY);
    const overrides: Record<string, { label: string; icon: string }> = overridesRaw
      ? JSON.parse(overridesRaw)
      : {};

    const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
    const base = all.find((c) => c.value === value);
    if (base) {
      const override = overrides[value];
      if (override) {
        return {
          ...base,
          label: override.label || base.label,
          icon: override.icon || base.icon,
          isEdited: true,
          originalLabel: base.label,
          originalIcon: base.icon,
        };
      }
      return base;
    }
  } catch {
    // ignore in environments without localStorage
  }

  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return (
    all.find((c) => c.value === value) ?? {
      value: value,
      label: value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      icon: '🏷️',
    }
  );
}

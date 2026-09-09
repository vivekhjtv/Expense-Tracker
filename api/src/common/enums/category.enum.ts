/**
 * Canonical category list. Shared verbatim with the Gemini `responseSchema`
 * so the model can never invent a category the ledger cannot filter on.
 */
export enum ExpenseCategory {
  GROCERIES = 'GROCERIES',
  FOOD_DINING = 'FOOD_DINING',
  TRANSPORT = 'TRANSPORT',
  FUEL = 'FUEL',
  SHOPPING = 'SHOPPING',
  UTILITIES = 'UTILITIES',
  RENT = 'RENT',
  HEALTH = 'HEALTH',
  ENTERTAINMENT = 'ENTERTAINMENT',
  EDUCATION = 'EDUCATION',
  TRAVEL = 'TRAVEL',
  PERSONAL_CARE = 'PERSONAL_CARE',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
  INVESTMENTS = 'INVESTMENTS',
  SALARY = 'SALARY',
  OTHER = 'OTHER',
}

export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

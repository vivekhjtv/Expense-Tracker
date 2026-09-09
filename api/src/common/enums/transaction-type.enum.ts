export enum TransactionType {
  /** Money spent. */
  EXPENSE = 'EXPENSE',
  /** Money received. */
  INCOME = 'INCOME',
}

export const TRANSACTION_TYPES = Object.values(TransactionType);

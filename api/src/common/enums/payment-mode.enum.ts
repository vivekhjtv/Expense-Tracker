export enum PaymentMode {
  CASH = 'CASH',
  /** UPI, NetBanking, Debit or Credit card — anything that is not physical cash. */
  ONLINE_BANKING = 'ONLINE_BANKING',
}

export const PAYMENT_MODES = Object.values(PaymentMode);

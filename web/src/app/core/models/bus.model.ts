/**
 * Daily bus ticket spend log.
 *
 * `date` is a calendar day ("YYYY-MM-DD").
 */
export interface BusEntry {
  _id: string;
  date: string;
  /** Amount spent on bus tickets in rupees. */
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusMonth {
  /** "YYYY-MM". */
  month: string;
  entries: BusEntry[];
  summary: {
    totalAmount: number;
    daysRecorded: number;
    /** Average spend per travel day. */
    averageAmount: number;
  };
}

/** Standard bus ticket fare presets in ₹ */
export const COMMON_BUS_FARES: readonly number[] = [15, 20, 25, 30, 40, 50, 70, 100] as const;

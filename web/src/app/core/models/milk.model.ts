/**
 * Daily milk log.
 *
 * `date` is a calendar day ("YYYY-MM-DD"), never an instant: which day the
 * milk arrived must not shift with a timezone. The API stores and returns the
 * same string, so nothing here ever parses it into a Date.
 */
export interface MilkEntry {
  _id: string;
  date: string;
  /** Litres, always a multiple of 0.5. */
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilkMonth {
  /** "YYYY-MM". */
  month: string;
  entries: MilkEntry[];
  summary: {
    totalLitres: number;
    daysRecorded: number;
    /** Across the days that were RECORDED, not across the whole month. */
    averageLitres: number;
  };
}

export interface MilkQuantityOption {
  readonly value: number;
  readonly label: string;
}

/** What the doodhwala actually leaves at the door. */
export const MILK_QUANTITIES: readonly MilkQuantityOption[] = [
  { value: 0.5, label: '0.5 L' },
  { value: 1, label: '1 L' },
  { value: 1.5, label: '1.5 L' },
  { value: 2, label: '2 L' },
  { value: 2.5, label: '2.5 L' },
  { value: 3, label: '3 L' },
] as const;

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CALENDAR_DAY_PATTERN } from '../../common/utils/calendar-day.util';

export type MilkEntryDocument = HydratedDocument<MilkEntry>;

/** Litres per delivery, as a doodhwala actually measures them. */
export const MIN_LITRES = 0.5;
export const MAX_LITRES = 20;
export const LITRE_STEP = 0.5;

/** Snaps to the nearest half litre — the only quantities that can be bought. */
export function roundLitres(value: number): number {
  return Math.round(value / LITRE_STEP) * LITRE_STEP;
}

/**
 * One day's milk.
 *
 * `date` is a calendar day string rather than a Date: see calendar-day.util.
 * At most one row per user per day — milk is a daily quantity, not a list of
 * purchases, so recording the same day twice should correct the figure rather
 * than add a second one. The unique index below is what enforces that, and it
 * doubles as the index the month view range-scans.
 */
@Schema({ timestamps: true, collection: 'milk_entries' })
export class MilkEntry {
  @Prop({ required: true, match: CALENDAR_DAY_PATTERN })
  date: string;

  @Prop({ required: true, min: MIN_LITRES, max: MAX_LITRES, set: roundLitres })
  quantity: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const MilkEntrySchema = SchemaFactory.createForClass(MilkEntry);

// One row per day, and the range scan behind every month view.
MilkEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

MilkEntrySchema.set('toJSON', { virtuals: true });
MilkEntrySchema.set('toObject', { virtuals: true });

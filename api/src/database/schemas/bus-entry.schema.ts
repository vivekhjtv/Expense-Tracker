import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CALENDAR_DAY_PATTERN } from '../../common/utils/calendar-day.util';
import { roundMoney } from '../../common/utils/money.util';

export type BusEntryDocument = HydratedDocument<BusEntry>;

export const MIN_BUS_PRICE = 0.01;
export const MAX_BUS_PRICE = 100_000;

/**
 * One day's bus ticket spend.
 *
 * `date` is a calendar day string ("YYYY-MM-DD") rather than a Date.
 * At most one row per user per day — bus spend is recorded per day.
 * Unique index on { userId, date } enforces this.
 */
@Schema({ timestamps: true, collection: 'bus_entries' })
export class BusEntry {
  @Prop({ required: true, match: CALENDAR_DAY_PATTERN })
  date: string;

  @Prop({ required: true, min: MIN_BUS_PRICE, max: MAX_BUS_PRICE, set: roundMoney })
  price: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const BusEntrySchema = SchemaFactory.createForClass(BusEntry);

// One row per day, and the range scan behind every month view.
BusEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

BusEntrySchema.set('toJSON', { virtuals: true });
BusEntrySchema.set('toObject', { virtuals: true });

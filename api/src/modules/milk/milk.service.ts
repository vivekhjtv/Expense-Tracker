import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  isCalendarDay,
  isCalendarMonth,
  monthBounds,
  monthOf,
} from '../../common/utils/calendar-day.util';
import {
  MilkEntry,
  MilkEntryDocument,
  roundLitres,
} from '../../database/schemas/milk-entry.schema';
import { QueryMilkDto } from './dto/query-milk.dto';
import { UpsertMilkEntryDto } from './dto/upsert-milk-entry.dto';

export interface MilkMonth {
  month: string;
  entries: MilkEntryDocument[];
  summary: {
    totalLitres: number;
    daysRecorded: number;
    averageLitres: number;
  };
}

/**
 * Daily milk log.
 *
 * Deliberately not a transaction: this answers "how much milk did we get this
 * month", which is a quantity per day, not money. Keeping it separate means
 * the spending log stays exactly what it claims to be, and a day's milk can be
 * corrected without touching a single expense.
 */
@Injectable()
export class MilkService {
  private readonly logger = new Logger(MilkService.name);

  constructor(
    @InjectModel(MilkEntry.name) private readonly milkModel: Model<MilkEntryDocument>,
  ) {}

  /**
   * Records a day's milk, replacing whatever that day held.
   *
   * Upsert rather than insert: the unique (userId, date) index makes a second
   * insert for the same day an error, and an error is the wrong answer to
   * "actually it was 1.5 litres".
   */
  async upsert(userId: Types.ObjectId, dto: UpsertMilkEntryDto): Promise<MilkEntryDocument> {
    this.assertDay(dto.date);

    const quantity = roundLitres(dto.quantity);

    const entry = await this.milkModel
      .findOneAndUpdate(
        { userId, date: dto.date },
        { $set: { quantity }, $setOnInsert: { userId, date: dto.date } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.logger.log(`Milk on ${dto.date}: ${quantity}L`);
    return entry;
  }

  /** Every entry in a month, oldest first, with the month's totals. */
  async findMonth(userId: Types.ObjectId, query: QueryMilkDto): Promise<MilkMonth> {
    const month = query.month ?? monthOf(new Date().toISOString().slice(0, 10));
    if (!isCalendarMonth(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }

    const { from, until } = monthBounds(month);

    const entries = await this.milkModel
      .find({ userId, date: { $gte: from, $lt: until } })
      .sort({ date: 1 })
      .exec();

    // Half litres are exact in binary floating point, so this sum cannot
    // drift the way a money total would.
    const totalLitres = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const daysRecorded = entries.length;

    return {
      month,
      entries,
      summary: {
        totalLitres,
        daysRecorded,
        averageLitres: daysRecorded ? Math.round((totalLitres / daysRecorded) * 100) / 100 : 0,
      },
    };
  }

  async remove(userId: Types.ObjectId, date: string): Promise<{ message: string }> {
    this.assertDay(date);

    const result = await this.milkModel.deleteOne({ userId, date }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('No milk recorded on that day');
    }
    return { message: 'Entry removed.' };
  }

  private assertDay(date: string): void {
    // The DTO's pattern accepts 2026-02-31; the calendar does not.
    if (!isCalendarDay(date)) {
      throw new BadRequestException('date must be a real calendar day, as YYYY-MM-DD');
    }
  }
}

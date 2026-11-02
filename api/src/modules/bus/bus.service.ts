import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  isCalendarDay,
  isCalendarMonth,
  monthBounds,
  monthOf,
} from '../../common/utils/calendar-day.util';
import { roundMoney, sumMoney } from '../../common/utils/money.util';
import {
  BusEntry,
  BusEntryDocument,
} from '../../database/schemas/bus-entry.schema';
import { QueryBusDto } from './dto/query-bus.dto';
import { UpsertBusEntryDto } from './dto/upsert-bus-entry.dto';

export interface BusMonth {
  month: string;
  entries: BusEntryDocument[];
  summary: {
    totalAmount: number;
    daysRecorded: number;
    averageAmount: number;
  };
}

@Injectable()
export class BusService {
  private readonly logger = new Logger(BusService.name);

  constructor(
    @InjectModel(BusEntry.name) private readonly busModel: Model<BusEntryDocument>,
  ) {}

  /** Records or updates a day's bus ticket price. */
  async upsert(userId: Types.ObjectId, dto: UpsertBusEntryDto): Promise<BusEntryDocument> {
    this.assertDay(dto.date);

    const price = roundMoney(dto.price);

    const entry = await this.busModel
      .findOneAndUpdate(
        { userId, date: dto.date },
        { $set: { price }, $setOnInsert: { userId, date: dto.date } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
      .exec();

    this.logger.log(`Bus on ${dto.date}: ₹${price}`);
    return entry;
  }

  /** Every entry in a month, oldest first, with the month's totals. */
  async findMonth(userId: Types.ObjectId, query: QueryBusDto): Promise<BusMonth> {
    const month = query.month ?? monthOf(new Date().toISOString().slice(0, 10));
    if (!isCalendarMonth(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }

    const { from, until } = monthBounds(month);

    const entries = await this.busModel
      .find({ userId, date: { $gte: from, $lt: until } })
      .sort({ date: 1 })
      .exec();

    const totalAmount = sumMoney(entries.map((e) => e.price));
    const daysRecorded = entries.length;
    const averageAmount = daysRecorded ? roundMoney(totalAmount / daysRecorded) : 0;

    return {
      month,
      entries,
      summary: {
        totalAmount,
        daysRecorded,
        averageAmount,
      },
    };
  }

  async remove(userId: Types.ObjectId, date: string): Promise<{ message: string }> {
    this.assertDay(date);

    const result = await this.busModel.deleteOne({ userId, date }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('No bus ticket recorded on that day');
    }
    return { message: 'Entry removed.' };
  }

  private assertDay(date: string): void {
    if (!isCalendarDay(date)) {
      throw new BadRequestException('date must be a real calendar day, as YYYY-MM-DD');
    }
  }
}

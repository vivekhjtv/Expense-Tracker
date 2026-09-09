import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { PaymentMode, TransactionType } from '../../common/enums';
import {
  DateRangePreset,
  DEFAULT_TZ_OFFSET_MINUTES,
  eachLocalDay,
  resolveDateRange,
  toUtcOffsetString,
} from '../../common/utils/date-range.util';
import { addMoney, fromMinor, roundMoney } from '../../common/utils/money.util';
import { Transaction, TransactionDocument } from '../../database/schemas/transaction.schema';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

export interface DashboardSummary {
  totalSpend: number;
  totalIncome: number;
  cashSpend: number;
  onlineSpend: number;
  cashSharePct: number;
  onlineSharePct: number;
  transactionCount: number;
  averageDailySpend: number;
  largestSpend: number;
  topCategory: { category: string; total: number } | null;
  range: { from: string | null; to: string | null };
}

export interface DailyPoint {
  date: string;
  total: number;
  count: number;
}

export interface CategorySlice {
  category: string;
  total: number;
  count: number;
  sharePct: number;
}

export interface PaymentModeSlice {
  paymentMode: PaymentMode;
  total: number;
  count: number;
  sharePct: number;
}

/**
 * Read-only aggregation pipelines behind the dashboard.
 *
 * Sums are computed in integer paise inside Mongo (`$multiply` by 100 then
 * `$round`) and converted back in JS — `$sum` over doubles accumulates the
 * same float drift the money util exists to avoid.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  /** Sums `amount` exactly, by accumulating minor units. */
  private static readonly SUM_PAISE = {
    $sum: { $round: [{ $multiply: ['$amount', 100] }, 0] },
  };

  private matchStage(userId: Types.ObjectId, query: AnalyticsQueryDto): PipelineStage.Match {
    const range = this.resolve(query);
    const match: Record<string, unknown> = { userId };

    if (range.from || range.to) {
      match.date = {
        ...(range.from ? { $gte: range.from } : {}),
        ...(range.to ? { $lt: range.to } : {}),
      };
    }

    return { $match: match };
  }

  private resolve(query: AnalyticsQueryDto) {
    return resolveDateRange(
      query.range ?? DateRangePreset.THIS_MONTH,
      query.tzOffset ?? DEFAULT_TZ_OFFSET_MINUTES,
      { from: query.from, to: query.to },
    );
  }

  /* ---------------------------------------------------------------- */
  /* Metric cards                                                      */
  /* ---------------------------------------------------------------- */

  async getSummary(userId: Types.ObjectId, query: AnalyticsQueryDto): Promise<DashboardSummary> {
    const range = this.resolve(query);

    const [totals, categories] = await Promise.all([
      this.transactionModel.aggregate<{
        _id: { type: TransactionType; paymentMode: PaymentMode };
        paise: number;
        count: number;
        maxPaise: number;
      }>([
        this.matchStage(userId, query),
        {
          $group: {
            _id: { type: '$type', paymentMode: '$paymentMode' },
            paise: AnalyticsService.SUM_PAISE,
            count: { $sum: 1 },
            maxPaise: { $max: { $round: [{ $multiply: ['$amount', 100] }, 0] } },
          },
        },
      ]),
      this.getCategoryBreakdown(userId, query),
    ]);

    let totalSpend = 0;
    let totalIncome = 0;
    let cashSpend = 0;
    let onlineSpend = 0;
    let transactionCount = 0;
    let largestSpendPaise = 0;

    for (const row of totals) {
      const value = fromMinor(row.paise);
      transactionCount += row.count;

      if (row._id.type === TransactionType.EXPENSE) {
        totalSpend = addMoney(totalSpend, value);
        largestSpendPaise = Math.max(largestSpendPaise, row.maxPaise);
        if (row._id.paymentMode === PaymentMode.CASH) {
          cashSpend = addMoney(cashSpend, value);
        } else {
          onlineSpend = addMoney(onlineSpend, value);
        }
      } else {
        totalIncome = addMoney(totalIncome, value);
      }
    }

    const share = (part: number): number =>
      totalSpend > 0 ? Math.round((part / totalSpend) * 1000) / 10 : 0;

    return {
      totalSpend,
      totalIncome,
      cashSpend,
      onlineSpend,
      cashSharePct: share(cashSpend),
      onlineSharePct: share(onlineSpend),
      transactionCount,
      averageDailySpend: this.perDay(totalSpend, range.from, range.to),
      largestSpend: fromMinor(largestSpendPaise),
      topCategory: categories.length
        ? { category: categories[0].category, total: categories[0].total }
        : null,
      range: {
        from: range.from?.toISOString() ?? null,
        to: range.to?.toISOString() ?? null,
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /* Charts                                                            */
  /* ---------------------------------------------------------------- */

  /** Daily spend trend, with zero-filled gaps so the line chart has no holes. */
  async getDailyTrend(userId: Types.ObjectId, query: AnalyticsQueryDto): Promise<DailyPoint[]> {
    const tzOffset = query.tzOffset ?? DEFAULT_TZ_OFFSET_MINUTES;
    const timezone = toUtcOffsetString(tzOffset);

    const rows = await this.transactionModel.aggregate<{
      _id: string;
      paise: number;
      count: number;
    }>([
      this.matchStage(userId, query),
      { $match: { type: TransactionType.EXPENSE } },
      {
        $group: {
          // Bucket by the user's local day, not the UTC day, so a 1am spend
          // lands on the date the user actually remembers.
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone } },
          paise: AnalyticsService.SUM_PAISE,
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byDate = new Map(rows.map((r) => [r._id, r]));
    const days = eachLocalDay(this.resolve(query), tzOffset);

    // An unbounded range (ALL) has no day list to walk, so fall back to the
    // days that actually have data.
    if (days.length === 0) {
      return rows.map((r) => ({ date: r._id, total: fromMinor(r.paise), count: r.count }));
    }

    return days.map((date) => {
      const row = byDate.get(date);
      return { date, total: row ? fromMinor(row.paise) : 0, count: row?.count ?? 0 };
    });
  }

  /** Donut chart. Sorted biggest-first so the legend reads top-down. */
  async getCategoryBreakdown(
    userId: Types.ObjectId,
    query: AnalyticsQueryDto,
  ): Promise<CategorySlice[]> {
    const rows = await this.transactionModel.aggregate<{
      _id: string;
      paise: number;
      count: number;
    }>([
      this.matchStage(userId, query),
      { $match: { type: TransactionType.EXPENSE } },
      {
        $group: {
          _id: { $ifNull: ['$category', 'OTHER'] },
          paise: AnalyticsService.SUM_PAISE,
          count: { $sum: 1 },
        },
      },
      { $sort: { paise: -1 } },
    ]);

    const total = rows.reduce((sum, row) => sum + row.paise, 0);

    return rows.map((row) => ({
      category: row._id,
      total: fromMinor(row.paise),
      count: row.count,
      sharePct: total > 0 ? Math.round((row.paise / total) * 1000) / 10 : 0,
    }));
  }

  /** Cash vs Online split. */
  async getPaymentModeSplit(
    userId: Types.ObjectId,
    query: AnalyticsQueryDto,
  ): Promise<PaymentModeSlice[]> {
    const rows = await this.transactionModel.aggregate<{
      _id: PaymentMode;
      paise: number;
      count: number;
    }>([
      this.matchStage(userId, query),
      { $match: { type: TransactionType.EXPENSE } },
      {
        $group: {
          _id: '$paymentMode',
          paise: AnalyticsService.SUM_PAISE,
          count: { $sum: 1 },
        },
      },
    ]);

    const total = rows.reduce((sum, row) => sum + row.paise, 0);

    // Always emit both modes, even at zero — a chart that changes from two
    // segments to one between months is disorienting.
    return Object.values(PaymentMode).map((mode) => {
      const row = rows.find((r) => r._id === mode);
      const paise = row?.paise ?? 0;
      return {
        paymentMode: mode,
        total: fromMinor(paise),
        count: row?.count ?? 0,
        sharePct: total > 0 ? Math.round((paise / total) * 1000) / 10 : 0,
      };
    });
  }

  private perDay(total: number, from: Date | null, to: Date | null): number {
    if (!from || !to || total === 0) return 0;
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
    return roundMoney(total / days);
  }
}

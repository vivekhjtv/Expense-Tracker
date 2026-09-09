import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ExpenseCategory, TransactionType } from '../../common/enums';
import { DateRangePreset, resolveDateRange, toDateFilter } from '../../common/utils/date-range.util';
import { roundMoney } from '../../common/utils/money.util';
import {
  Transaction,
  TransactionDocument,
  TransactionSource,
} from '../../database/schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

export interface PaginatedTransactions {
  data: TransactionDocument[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Spending log.
 *
 * Each transaction is one self-contained document, so create, update and
 * delete are single atomic writes — no sessions, no balance side effects, and
 * critically no rule that can ever refuse to record what you actually spent.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async create(userId: Types.ObjectId, dto: CreateTransactionDto): Promise<TransactionDocument> {
    const created = await this.transactionModel.create({
      ...dto,
      amount: roundMoney(dto.amount),
      type: dto.type ?? TransactionType.EXPENSE,
      category: dto.category?.trim() || ExpenseCategory.OTHER,
      items: dto.items?.length ? dto.items : undefined,
      source: dto.source ?? TransactionSource.MANUAL,
      userId,
    });

    this.logger.log(`Recorded ${created.type} of ${created.amount} (${created.paymentMode})`);
    return created;
  }

  async update(
    userId: Types.ObjectId,
    id: Types.ObjectId,
    dto: UpdateTransactionDto,
  ): Promise<TransactionDocument> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No changes were supplied');
    }

    const existing = await this.transactionModel.findOne({ _id: id, userId }).exec();
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    Object.assign(existing, dto);

    if (dto.amount !== undefined) {
      existing.amount = roundMoney(dto.amount);
    }
    if (dto.category !== undefined) {
      existing.category = dto.category.trim() || ExpenseCategory.OTHER;
    }
    if (dto.items !== undefined) {
      existing.items = dto.items.length ? dto.items : undefined;
    }

    await existing.save();
    return existing;
  }

  async remove(userId: Types.ObjectId, id: Types.ObjectId): Promise<{ message: string }> {
    const result = await this.transactionModel.deleteOne({ _id: id, userId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Transaction not found');
    }
    return { message: 'Transaction deleted.' };
  }

  async findAll(
    userId: Types.ObjectId,
    query: QueryTransactionsDto,
  ): Promise<PaginatedTransactions> {
    const filter = this.buildFilter(userId, query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const sortBy = query.sortBy ?? 'date';
    const sortDir = query.sortDir ?? -1;

    const [data, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        // `_id` breaks ties so pagination is stable — without it, two rows
        // sharing a timestamp can swap pages and the user sees one twice.
        .sort({ [sortBy]: sortDir, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasMore: page * limit < total,
      },
    };
  }

  async findOne(userId: Types.ObjectId, id: Types.ObjectId): Promise<TransactionDocument> {
    const transaction = await this.transactionModel.findOne({ _id: id, userId }).exec();
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  /** Shared by the ledger and every analytics pipeline, so filters agree. */
  buildFilter(
    userId: Types.ObjectId,
    query: QueryTransactionsDto,
  ): FilterQuery<TransactionDocument> {
    const filter: FilterQuery<TransactionDocument> = { userId };

    const dateFilter = toDateFilter(
      resolveDateRange(query.range ?? DateRangePreset.THIS_MONTH, query.tzOffset, {
        from: query.from,
        to: query.to,
      }),
    );
    if (dateFilter) {
      filter.date = dateFilter;
    }

    if (query.paymentMode) {
      filter.paymentMode = query.paymentMode;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [
        { merchantName: rx },
        { notes: rx },
        { category: rx },
        { 'items.name': rx },
        { tags: rx },
      ];
    }

    return filter;
  }
}

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MilkEntry, MilkEntryDocument } from './schemas/milk-entry.schema';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

/**
 * Builds the schema indexes before the app serves traffic.
 *
 * Replaces Mongoose's `autoIndex`, which builds in the BACKGROUND (leaving a
 * window after boot where indexes are missing) and is conventionally disabled
 * in production, where it would mean they are never created at all.
 * `createIndexes()` only adds what is missing; unlike `syncIndexes()` it will
 * not drop an index someone added by hand.
 */
@Injectable()
export class IndexInitializer implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexInitializer.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(MilkEntry.name) private readonly milkModel: Model<MilkEntryDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const started = Date.now();
    try {
      await Promise.all([
        this.transactionModel.createIndexes(),
        // The milk log's (userId, date) index is UNIQUE — it is what keeps a
        // day to a single quantity, so it has to exist before the first write.
        this.milkModel.createIndexes(),
      ]);
      this.logger.log(`Indexes ready in ${Date.now() - started}ms`);
    } catch (err) {
      this.logger.error(`Failed to build indexes: ${(err as Error).message}`);
      throw err;
    }
  }
}

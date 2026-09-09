import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  PaymentMode,
  PAYMENT_MODES,
  TransactionType,
  TRANSACTION_TYPES,
} from '../../common/enums';
import { LineItem, LineItemSchema } from './line-item.schema';

export type TransactionDocument = HydratedDocument<Transaction>;

/** How the record got into the ledger — useful for measuring scanner accuracy. */
export enum TransactionSource {
  MANUAL = 'MANUAL',
  AI_SCAN = 'AI_SCAN',
  IMPORT = 'IMPORT',
}

@Schema({ _id: false, versionKey: false })
export class ReceiptMeta {
  @Prop({ trim: true, maxlength: 200 })
  merchantName?: string;

  /** Gemini's own 0–1 confidence in the extraction. */
  @Prop({ min: 0, max: 1 })
  confidence?: number;

  @Prop({ trim: true, maxlength: 64 })
  model?: string;

  @Prop()
  scannedAt?: Date;
}

export const ReceiptMetaSchema = SchemaFactory.createForClass(ReceiptMeta);

/**
 * A single spending (or earning) record.
 *
 * This is a spending LOG, not a double-entry ledger: there are no accounts and
 * no running balances, so a transaction is one self-contained document. That
 * is what lets every write be a single atomic insert with no session, and it
 * means nothing can ever block you from recording what you actually spent.
 *
 * `amount` is always POSITIVE — direction is carried by `type`, never by the
 * sign, so `$sum: '$amount'` in an aggregation stays honest.
 */
@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction {
  @Prop({ required: true, min: 0.01, set: (v: number) => Math.round(v * 100) / 100 })
  amount: number;

  @Prop({ required: true, type: String, enum: TRANSACTION_TYPES, index: true })
  type: TransactionType;

  @Prop({ required: true, type: String, enum: PAYMENT_MODES })
  paymentMode: PaymentMode;

  @Prop({ required: true, trim: true, maxlength: 60, default: 'OTHER' })
  category: string;

  /** When the money actually moved (user-editable), not when the row was created. */
  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ type: [LineItemSchema], default: undefined })
  items?: LineItem[];

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;

  @Prop({ trim: true, maxlength: 200 })
  merchantName?: string;

  @Prop({ type: [String], default: undefined })
  tags?: string[];

  @Prop({ type: String, enum: Object.values(TransactionSource), default: TransactionSource.MANUAL })
  source: TransactionSource;

  @Prop({ type: ReceiptMetaSchema, default: undefined })
  receipt?: ReceiptMeta;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

/* ------------------------------------------------------------------ */
/* Indexes — one per query the ledger and dashboard actually run.       */
/* ------------------------------------------------------------------ */

// Default ledger view + every date-range filter.
TransactionSchema.index({ userId: 1, date: -1 });

// Cash vs Online split card and the "Cash only / Online only" ledger toggle.
TransactionSchema.index({ userId: 1, paymentMode: 1, date: -1 });

// Category donut and category search.
TransactionSchema.index({ userId: 1, type: 1, category: 1, date: -1 });

TransactionSchema.pre('validate', function (next) {
  const doc = this as unknown as TransactionDocument;

  // An empty items array carries no information and would render as an
  // empty expandable drawer in the UI — normalise it away.
  if (Array.isArray(doc.items) && doc.items.length === 0) {
    doc.items = undefined;
  }

  return next();
});

TransactionSchema.set('toJSON', { virtuals: true });
TransactionSchema.set('toObject', { virtuals: true });

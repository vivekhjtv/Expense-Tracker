import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { multiplyMoney } from '../../common/utils/money.util';

/**
 * One row on a bill ("Amul Milk 1L x2 — ₹64"). Embedded inside Transaction:
 * line items are never queried independently and always live and die with
 * their parent, so a subdocument array beats a separate collection here.
 */
@Schema({ _id: false, versionKey: false })
export class LineItem {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, min: 0, set: (v: number) => Math.round(v * 100) / 100 })
  price: number;

  @Prop({ required: true, min: 0.001, default: 1 })
  qty: number;
}

export const LineItemSchema = SchemaFactory.createForClass(LineItem);

// price * qty, exposed to the client without being stored (it is derivable,
// so storing it would just be a second source of truth able to drift).
LineItemSchema.virtual('lineTotal').get(function (this: LineItem): number {
  return multiplyMoney(this.price, this.qty);
});

LineItemSchema.set('toJSON', { virtuals: true });
LineItemSchema.set('toObject', { virtuals: true });

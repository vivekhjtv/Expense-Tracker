import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, unique: true, maxlength: 254 })
  email: string;

  /**
   * scrypt hash as `salt:hash`, both hex.
   *
   * `select: false` so the hash is never returned by an ordinary query — a
   * findOne() that accidentally gets serialised into a response cannot leak
   * it. AuthService opts back in explicitly with `.select('+passwordHash')`.
   */
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ default: 'INR', uppercase: true, minlength: 3, maxlength: 3 })
  baseCurrency: string;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Emails are stored lowercase, so this also enforces case-insensitive uniqueness.
UserSchema.index({ email: 1 }, { unique: true });

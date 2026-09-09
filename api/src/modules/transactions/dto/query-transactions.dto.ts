import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaymentMode, TransactionType } from '../../../common/enums';
import { DateRangePreset, DEFAULT_TZ_OFFSET_MINUTES } from '../../../common/utils/date-range.util';

/** Drives the ledger's filter bar. Every field is optional and composable. */
export class QueryTransactionsDto {
  @IsOptional()
  @IsEnum(DateRangePreset)
  range?: DateRangePreset = DateRangePreset.THIS_MONTH;

  /** Used only when range=CUSTOM. Inclusive of the whole day. */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  /**
   * Minutes east of UTC, from `-new Date().getTimezoneOffset()` on the client.
   * Without it "Today" would be computed in UTC and drop late-night spends.
   */
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  @Type(() => Number)
  tzOffset?: number = DEFAULT_TZ_OFFSET_MINUTES;

  /** Omit for the "All" tab. */
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  /** Free-text across merchant, notes, category, tags and line-item names. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === 'amount' ? 'amount' : 'date'))
  sortBy?: 'date' | 'amount' = 'date';

  @IsOptional()
  @Transform(({ value }) => (value === 'asc' ? 1 : -1))
  sortDir?: 1 | -1 = -1;
}

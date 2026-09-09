import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDate, IsEnum, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PaymentMode, TransactionType } from '../../../common/enums';
import { TransactionSource } from '../../../database/schemas/transaction.schema';
import { MAX_MONEY } from '../../../common/utils/money.util';
import { LineItemDto } from './line-item.dto';

export class CreateTransactionDto {
  /** Always positive. Direction comes from `type`, never from the sign. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(MAX_MONEY)
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsDate({ message: 'A valid date is required' })
  @Type(() => Date)
  date: Date;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  items?: LineItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  merchantName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;
}

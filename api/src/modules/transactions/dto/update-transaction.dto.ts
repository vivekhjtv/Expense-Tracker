import { PartialType } from '@nestjs/mapped-types';
import { CreateTransactionDto } from './create-transaction.dto';

/**
 * Every field is editable. Each transaction is a self-contained document with
 * no balance side effects, so an edit is a single atomic write.
 */
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}

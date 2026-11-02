import { IsNotEmpty, IsNumber, Matches, Max, Min } from 'class-validator';
import { CALENDAR_DAY_PATTERN } from '../../../common/utils/calendar-day.util';
import { MAX_BUS_PRICE, MIN_BUS_PRICE } from '../../../database/schemas/bus-entry.schema';

export class UpsertBusEntryDto {
  @IsNotEmpty()
  @Matches(CALENDAR_DAY_PATTERN, { message: 'date must be a real calendar day, as YYYY-MM-DD' })
  date: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(MIN_BUS_PRICE)
  @Max(MAX_BUS_PRICE)
  price: number;
}

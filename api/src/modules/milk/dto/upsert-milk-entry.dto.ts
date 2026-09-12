import { Type } from 'class-transformer';
import { IsNumber, IsString, Matches, Max, Min } from 'class-validator';
import { CALENDAR_DAY_PATTERN } from '../../../common/utils/calendar-day.util';
import { MAX_LITRES, MIN_LITRES } from '../../../database/schemas/milk-entry.schema';

/**
 * Records (or corrects) one day's milk.
 *
 * There is no separate create/update pair: a day either has a quantity or it
 * does not, so the same call covers "I bought 1L today" and "no, it was 1.5L".
 */
export class UpsertMilkEntryDto {
  @IsString()
  @Matches(CALENDAR_DAY_PATTERN, { message: 'date must be a calendar day, as YYYY-MM-DD' })
  date: string;

  /** Litres. Anything between the steps is snapped to the nearest half litre. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_LITRES, { message: `Quantity must be at least ${MIN_LITRES}L` })
  @Max(MAX_LITRES)
  @Type(() => Number)
  quantity: number;
}

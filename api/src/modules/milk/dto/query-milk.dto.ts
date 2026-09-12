import { IsOptional, IsString, Matches } from 'class-validator';
import { CALENDAR_MONTH_PATTERN } from '../../../common/utils/calendar-day.util';

/** The milk screen is a month calendar, so it asks for exactly one month. */
export class QueryMilkDto {
  /**
   * "YYYY-MM". Defaults to the current month, but the client should always
   * send its own: the server's idea of "this month" is the server's timezone.
   */
  @IsOptional()
  @IsString()
  @Matches(CALENDAR_MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month?: string;
}

import { IsOptional, Matches } from 'class-validator';
import { CALENDAR_MONTH_PATTERN } from '../../../common/utils/calendar-day.util';

export class QueryBusDto {
  @IsOptional()
  @Matches(CALENDAR_MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month?: string;
}

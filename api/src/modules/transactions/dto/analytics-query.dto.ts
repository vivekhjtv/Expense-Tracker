import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DateRangePreset, DEFAULT_TZ_OFFSET_MINUTES } from '../../../common/utils/date-range.util';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(DateRangePreset)
  range?: DateRangePreset = DateRangePreset.THIS_MONTH;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  @Type(() => Number)
  tzOffset?: number = DEFAULT_TZ_OFFSET_MINUTES;
}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryMilkDto } from './dto/query-milk.dto';
import { UpsertMilkEntryDto } from './dto/upsert-milk-entry.dto';
import { MilkService } from './milk.service';

@Controller('milk')
export class MilkController {
  constructor(private readonly milkService: MilkService) {}

  /** One month of entries plus its totals — everything the calendar renders. */
  @Get()
  findMonth(@CurrentUser() userId: Types.ObjectId, @Query() query: QueryMilkDto) {
    return this.milkService.findMonth(userId, query);
  }

  /**
   * PUT, not POST: a day holds one quantity, so this is idempotent — sending
   * the same day twice leaves the same single row.
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  upsert(@CurrentUser() userId: Types.ObjectId, @Body() dto: UpsertMilkEntryDto) {
    return this.milkService.upsert(userId, dto);
  }

  /** The day itself is the identifier here — there is nothing else to name it by. */
  @Delete(':date')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() userId: Types.ObjectId, @Param('date') date: string) {
    return this.milkService.remove(userId, date);
  }
}

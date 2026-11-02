import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryBusDto } from './dto/query-bus.dto';
import { UpsertBusEntryDto } from './dto/upsert-bus-entry.dto';
import { BusService } from './bus.service';

@Controller('bus')
export class BusController {
  constructor(private readonly busService: BusService) {}

  /** One month of bus entries plus totals for the calendar view. */
  @Get()
  findMonth(@CurrentUser() userId: Types.ObjectId, @Query() query: QueryBusDto) {
    return this.busService.findMonth(userId, query);
  }

  /** Upserts bus ticket price for a specific day. */
  @Put()
  @HttpCode(HttpStatus.OK)
  upsert(@CurrentUser() userId: Types.ObjectId, @Body() dto: UpsertBusEntryDto) {
    return this.busService.upsert(userId, dto);
  }

  /** Removes bus entry for the specified day. */
  @Delete(':date')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() userId: Types.ObjectId, @Param('date') date: string) {
    return this.busService.remove(userId, date);
  }
}

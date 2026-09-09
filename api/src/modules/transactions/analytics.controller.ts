import { Controller, Get, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Everything the dashboard's metric cards need, in one round trip. */
  @Get('summary')
  getSummary(@CurrentUser() userId: Types.ObjectId, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSummary(userId, query);
  }

  @Get('daily-trend')
  getDailyTrend(@CurrentUser() userId: Types.ObjectId, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDailyTrend(userId, query);
  }

  @Get('categories')
  getCategories(@CurrentUser() userId: Types.ObjectId, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getCategoryBreakdown(userId, query);
  }

  @Get('payment-modes')
  getPaymentModes(@CurrentUser() userId: Types.ObjectId, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPaymentModeSplit(userId, query);
  }

  /**
   * One call that fills the whole dashboard. The mobile client is usually on
   * a mobile network, where four sequential round trips cost far more than
   * running four independent pipelines server-side in parallel.
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() userId: Types.ObjectId, @Query() query: AnalyticsQueryDto) {
    const [summary, dailyTrend, categories, paymentModes] = await Promise.all([
      this.analyticsService.getSummary(userId, query),
      this.analyticsService.getDailyTrend(userId, query),
      this.analyticsService.getCategoryBreakdown(userId, query),
      this.analyticsService.getPaymentModeSplit(userId, query),
    ]);
    return { summary, dailyTrend, categories, paymentModes };
  }
}

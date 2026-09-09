import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { HealthController } from './modules/health.controller';
import { ReceiptModule } from './modules/receipts/receipt.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    DatabaseModule,
    AuthModule,
    ReceiptModule,
    TransactionsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      // Deny by default: every route requires a valid token unless it is
      // explicitly marked @Public(). A new controller is protected the moment
      // it is written, rather than when someone remembers to guard it.
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

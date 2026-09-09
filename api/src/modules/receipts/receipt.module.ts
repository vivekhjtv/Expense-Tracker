import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ParseImageFilePipe } from '../../common/pipes/parse-image-file.pipe';
import { GeminiClientProvider } from './gemini.provider';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';

@Module({
  imports: [ConfigModule],
  controllers: [ReceiptController],
  providers: [GeminiClientProvider, ReceiptService, ParseImageFilePipe],
  exports: [ReceiptService],
})
export class ReceiptModule {}

import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ParseImageFilePipe, ValidatedImage } from '../../common/pipes/parse-image-file.pipe';
import { ScannedReceipt } from './interfaces/receipt-extraction.interface';
import { ReceiptService } from './receipt.service';

@Controller('receipts')
export class ReceiptController {
  private readonly logger = new Logger(ReceiptController.name);

  constructor(private readonly receiptService: ReceiptService) {}

  /**
   * POST /api/receipts/scan   (multipart/form-data, field name: "image")
   *
   * Stateless on purpose: the photo is held in memory, sent to Gemini, and
   * dropped. We never write the image to disk or to Atlas — receipts are the
   * most sensitive thing in this app, and the extracted numbers are all the
   * ledger needs.
   */
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      // Hard ceiling so a huge upload cannot exhaust heap before the pipe
      // runs; the pipe applies the configurable, user-facing limit.
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
  )
  async scan(
    @UploadedFile(ParseImageFilePipe) image: ValidatedImage,
  ): Promise<ScannedReceipt> {
    this.logger.log(`Receipt scan requested: ${image.originalName || 'camera-capture'}`);
    return this.receiptService.scan(image);
  }
}

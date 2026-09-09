import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { detectImageMimeType, SupportedImageMimeType } from '../utils/image-signature.util';

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: SupportedImageMimeType;
  sizeBytes: number;
  originalName: string;
}

/**
 * Turns multer's loose `Express.Multer.File` into a buffer we have actually
 * verified, so the service downstream never has to re-check anything.
 */
@Injectable()
export class ParseImageFilePipe implements PipeTransform<Express.Multer.File, ValidatedImage> {
  constructor(private readonly config: ConfigService) {}

  transform(file: Express.Multer.File | undefined): ValidatedImage {
    if (!file) {
      throw new BadRequestException(
        'No image received. Send the file as multipart/form-data under the field name "image".',
      );
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('The uploaded image is empty.');
    }

    const maxBytes = this.config.getOrThrow<number>('app.maxUploadBytes');
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ` +
          `${(maxBytes / 1024 / 1024).toFixed(0)}MB. Retake the photo at a lower resolution.`,
      );
    }

    const mimeType = detectImageMimeType(file.buffer);
    if (!mimeType) {
      throw new BadRequestException(
        'That file is not a supported image. Please upload a JPEG, PNG, WEBP or HEIC photo.',
      );
    }

    return {
      buffer: file.buffer,
      mimeType,
      sizeBytes: file.size,
      originalName: file.originalname,
    };
  }
}

import { GoogleGenAI } from '@google/genai';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpenseCategory, PaymentMode } from '../../common/enums';
import { ValidatedImage } from '../../common/pipes/parse-image-file.pipe';
import { differsBeyond, multiplyMoney, roundMoney, sumMoney } from '../../common/utils/money.util';
import { GEMINI_CLIENT } from './gemini.provider';
import {
  RawReceiptExtraction,
  ReceiptLineItem,
  ScannedReceipt,
} from './interfaces/receipt-extraction.interface';
import { RECEIPT_RESPONSE_SCHEMA, RECEIPT_SYSTEM_INSTRUCTION } from './receipt-response.schema';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);
  private readonly model: string;
  private readonly thinkingBudget: number;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly genai: GoogleGenAI,
    private readonly config: ConfigService,
  ) {
    this.model = this.config.getOrThrow<string>('gemini.model');
    this.thinkingBudget = this.config.getOrThrow<number>('gemini.thinkingBudget');
  }

  /**
   * Sends the photo to Gemini Vision and returns a normalised, form-ready
   * receipt. Nothing is persisted here — the user reviews and edits the
   * result in the Angular form, and only then does it become a Transaction.
   */
  async scan(image: ValidatedImage): Promise<ScannedReceipt> {
    const startedAt = Date.now();

    this.logger.log(
      `Scanning ${image.mimeType} (${(image.sizeBytes / 1024).toFixed(0)}KB) with ${this.model}`,
    );

    const raw = await this.extract(image);
    const result = this.normalise(raw, Date.now() - startedAt);

    this.logger.log(
      `Extracted total=${result.totalAmount} items=${result.items.length} ` +
        `confidence=${result.confidence} in ${result.meta.processingMs}ms`,
    );

    return result;
  }

  /* ---------------------------------------------------------------- */
  /* Model call                                                        */
  /* ---------------------------------------------------------------- */

  private async extract(image: ValidatedImage): Promise<RawReceiptExtraction> {
    let text: string | undefined;

    try {
      const response = await this.genai.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.buffer.toString('base64'),
                },
              },
              {
                text:
                  'Extract the structured purchase data from this receipt image. ' +
                  'Follow the schema exactly and do not invent any value you cannot read.',
              },
            ],
          },
        ],
        config: {
          systemInstruction: RECEIPT_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RECEIPT_RESPONSE_SCHEMA,
          // Deterministic transcription, not creative writing.
          temperature: 0,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: this.thinkingBudget },
        },
      });

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new UnprocessableEntityException(
          `The image was rejected by the vision model (${blockReason}). Please try another photo.`,
        );
      }

      text = response.text;
    } catch (err) {
      if (err instanceof UnprocessableEntityException) throw err;
      throw this.toHttpException(err);
    }

    if (!text?.trim()) {
      throw new UnprocessableEntityException(
        'The vision model returned an empty result. Please retake the photo in better light.',
      );
    }

    try {
      return JSON.parse(text) as RawReceiptExtraction;
    } catch {
      // Structured output makes this near-impossible, but a truncated
      // response (hit maxOutputTokens on a very long bill) can still land here.
      this.logger.error(`Non-JSON model output: ${text.slice(0, 500)}`);
      throw new UnprocessableEntityException(
        'Could not read the receipt reliably. Please enter the amount manually.',
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* Normalisation — never trust model output straight into a form      */
  /* ---------------------------------------------------------------- */

  private normalise(raw: RawReceiptExtraction, processingMs: number): ScannedReceipt {
    const warnings: string[] = [];

    if (raw.isReceipt === false) {
      throw new UnprocessableEntityException(
        "That doesn't look like a receipt. Please photograph a bill or invoice.",
      );
    }

    const items = this.normaliseItems(raw.items, warnings);
    const itemsTotal = sumMoney(items.map((item) => multiplyMoney(item.price, item.qty)));

    let totalAmount = this.toMoney(raw.totalAmount) ?? 0;

    if (totalAmount <= 0) {
      if (itemsTotal > 0) {
        // The grand total was illegible but the line items were not — a sum
        // the user can correct beats a zero they must retype from scratch.
        totalAmount = itemsTotal;
        warnings.push('Total was unreadable, so it was summed from the line items. Please verify.');
      } else {
        throw new UnprocessableEntityException(
          'No amount could be read from this receipt. Please enter it manually.',
        );
      }
    } else if (items.length > 0 && differsBeyond(itemsTotal, totalAmount, 1)) {
      // Usually legitimate (tax, delivery fee, discount) — surface it, never "fix" it.
      warnings.push(
        `Line items add up to ₹${itemsTotal.toFixed(2)} but the bill total is ` +
          `₹${totalAmount.toFixed(2)}. This is normal if there is tax, a discount ` +
          'or a delivery fee — otherwise check the items.',
      );
    }

    const date = this.normaliseDate(raw.date, warnings);
    const confidence = this.clamp(raw.confidence ?? 0.5, 0, 1);

    if (confidence < 0.5) {
      warnings.push('The image was hard to read. Please double-check every field before saving.');
    }

    return {
      merchantName: this.toText(raw.merchantName, 200),
      date,
      totalAmount,
      subTotal: this.toMoney(raw.subTotal),
      taxAmount: this.toMoney(raw.taxAmount),
      discountAmount: this.toAbsMoney(raw.discountAmount),
      currency: (this.toText(raw.currency, 3) ?? 'INR').toUpperCase(),
      paymentMode: this.normalisePaymentMode(raw.paymentMode),
      category: this.normaliseCategory(raw.category),
      notes: this.toText(raw.notes, 1000),
      items,
      confidence: roundMoney(confidence),
      warnings,
      meta: {
        model: this.model,
        scannedAt: new Date().toISOString(),
        processingMs,
        itemsTotal,
      },
    };
  }

  private normaliseItems(
    rawItems: RawReceiptExtraction['items'],
    warnings: string[],
  ): ReceiptLineItem[] {
    if (!Array.isArray(rawItems)) return [];

    const items: ReceiptLineItem[] = [];
    let dropped = 0;

    for (const rawItem of rawItems) {
      const name = this.toText(rawItem?.name, 200);
      const price = this.toMoney(rawItem?.price);

      // A nameless row, an unreadable price, or a negative (discount/return)
      // row is noise here — rendering it would just make the user delete a
      // junk line from the FormArray on their phone.
      if (!name || price === null) {
        dropped += 1;
        continue;
      }

      const rawQty = typeof rawItem?.qty === 'number' ? rawItem.qty : 1;
      const qty = Number.isFinite(rawQty) && rawQty > 0 ? roundMoney(rawQty) : 1;

      items.push({ name, price, qty });
    }

    if (dropped > 0) {
      warnings.push(`${dropped} unreadable line item(s) were skipped.`);
    }

    // 200 rows would lock up the mobile FormArray; no real receipt is that long.
    if (items.length > 100) {
      warnings.push(`Only the first 100 of ${items.length} line items were kept.`);
      return items.slice(0, 100);
    }

    return items;
  }

  private normaliseDate(rawDate: string | null | undefined, warnings: string[]): string {
    const today = new Date();

    if (!rawDate) {
      warnings.push("No date was printed on the receipt, so today's date was used.");
      return today.toISOString();
    }

    // The schema asks for YYYY-MM-DD; anchor to midday UTC so that rendering
    // the date in IST (or any other timezone) cannot shift it by a day.
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate.trim());
    const parsed = match ? new Date(`${match[0]}T12:00:00.000Z`) : new Date(rawDate);

    if (Number.isNaN(parsed.getTime())) {
      warnings.push(`Could not understand the date "${rawDate}", so today's date was used.`);
      return today.toISOString();
    }

    // A future date is always a misread (or a DD/MM swap) — a bill cannot
    // predate its own purchase.
    if (parsed.getTime() > today.getTime() + 24 * 60 * 60 * 1000) {
      warnings.push(`The scanned date (${rawDate}) is in the future. Please confirm it.`);
    }

    return parsed.toISOString();
  }

  private normalisePaymentMode(value: string | null | undefined): PaymentMode {
    return value === PaymentMode.ONLINE_BANKING ? PaymentMode.ONLINE_BANKING : PaymentMode.CASH;
  }

  private normaliseCategory(value: string | null | undefined): ExpenseCategory {
    const candidate = (value ?? '').toUpperCase();
    return Object.values(ExpenseCategory).includes(candidate as ExpenseCategory)
      ? (candidate as ExpenseCategory)
      : ExpenseCategory.OTHER;
  }

  /* ---------------------------------------------------------------- */
  /* Small helpers                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Strict: a negative is REJECTED, not silently made positive. A negative
   * line price on a bill is a discount/return row, and flipping its sign
   * would quietly inflate the total the user is asked to approve.
   */
  private toMoney(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    const rounded = roundMoney(value);
    return rounded > 0 ? rounded : null;
  }

  /** For fields where a sign is meaningless noise (a discount is a magnitude). */
  private toAbsMoney(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return this.toMoney(Math.abs(value));
  }

  private toText(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed.length > 0 && trimmed.toLowerCase() !== 'null' ? trimmed : null;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  /** Maps SDK/transport failures onto honest HTTP status codes for the mobile client. */
  private toHttpException(err: unknown): Error {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number })?.status;

    this.logger.error(`Gemini call failed: ${message}`);

    if (status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
      return new ServiceUnavailableException(
        'The free scanning quota is exhausted for now. Please wait a minute or enter the ' +
          'expense manually.',
      );
    }

    if (status === 401 || status === 403 || /API key|PERMISSION_DENIED/i.test(message)) {
      // Never leak key details to the client; the log above has the detail.
      return new ServiceUnavailableException('Receipt scanning is not configured correctly.');
    }

    if (/timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed/i.test(message)) {
      return new ServiceUnavailableException(
        'Could not reach the scanning service. Check your connection and try again.',
      );
    }

    return new ServiceUnavailableException('Receipt scanning is temporarily unavailable.');
  }
}

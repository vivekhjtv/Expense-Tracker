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

  /**
   * Maps SDK/transport failures onto honest HTTP status codes.
   *
   * The Gen AI SDK reports the real cause inside a JSON string on the error
   * message, so it is unpacked here rather than collapsed into one generic
   * "unavailable". A deployment that cannot scan needs to say WHY — the
   * previous version logged the reason and told the caller nothing, which
   * made a misconfigured key indistinguishable from a Google outage.
   *
   * The API key is redacted from anything that leaves this method.
   */
  private toHttpException(err: unknown): Error {
    const raw = err instanceof Error ? err.message : String(err);
    const detail = this.parseGeminiError(raw);
    const status = (err as { status?: number })?.status ?? detail.code;

    this.logger.error(
      `Gemini call failed [status=${status ?? 'n/a'} reason=${detail.reason ?? 'n/a'}]: ${this.redact(raw)}`,
    );

    if (status === 429 || detail.reason === 'RESOURCE_EXHAUSTED' || /quota|rate limit/i.test(raw)) {
      return new ServiceUnavailableException(
        'The free scanning quota is used up for now. Wait a minute, or enter the expense manually.',
      );
    }

    if (detail.reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(raw)) {
      return new ServiceUnavailableException(
        'Scanning is not enabled for this API key: the Generative Language API is turned off ' +
          'for its Google Cloud project. Enable it, or create a fresh key in Google AI Studio.',
      );
    }

    if (status === 400 && /API[_ ]?key not valid|API_KEY_INVALID/i.test(raw)) {
      return new ServiceUnavailableException(
        'The GEMINI_API_KEY is not valid. Check it was copied in full and has no stray spaces.',
      );
    }

    if (status === 401 || status === 403 || /PERMISSION_DENIED|API key/i.test(raw)) {
      return new ServiceUnavailableException(
        'The GEMINI_API_KEY was rejected. Check the key is correct and not restricted to ' +
          'other referrers or IP addresses.',
      );
    }

    if (/User location is not supported/i.test(raw)) {
      return new ServiceUnavailableException(
        'Google does not serve the Gemini API from the region this server runs in. ' +
          'Deploy the API to a supported region.',
      );
    }

    if (
      status === 404 ||
      detail.reason === 'NOT_FOUND' ||
      /not found for API version|not supported for generateContent/i.test(raw)
    ) {
      return new ServiceUnavailableException(
        `The model "${this.model}" is not available to this API key. Set GEMINI_MODEL to a ` +
          'model your key can use (gemini-2.5-flash is the default).',
      );
    }

    if (status === 400) {
      return new ServiceUnavailableException(
        `The vision request was rejected: ${detail.message ?? 'invalid request'}.`,
      );
    }

    if (/timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed/i.test(raw)) {
      return new ServiceUnavailableException(
        'Could not reach the scanning service. Check your connection and try again.',
      );
    }

    return new ServiceUnavailableException(
      `Receipt scanning failed${detail.message ? `: ${detail.message}` : ''}.`,
    );
  }

  /** Digs the structured error out of the SDK's message string. */
  private parseGeminiError(raw: string): {
    code?: number;
    reason?: string;
    message?: string;
  } {
    const jsonStart = raw.indexOf('{');
    if (jsonStart === -1) return {};

    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: {
          code?: number;
          status?: string;
          message?: string;
          details?: { reason?: string }[];
        };
      };
      const error = parsed.error;
      if (!error) return {};

      return {
        code: error.code,
        reason: error.details?.find((d) => d.reason)?.reason ?? error.status,
        message: error.message ? this.redact(error.message) : undefined,
      };
    } catch {
      return {};
    }
  }

  /** Never let the key reach a log line or an HTTP response. */
  private redact(text: string): string {
    const key = this.config.get<string>('gemini.apiKey');
    const withoutKey = key ? text.split(key).join('***') : text;
    return withoutKey.replace(/AIza[0-9A-Za-z_-]{10,}/g, 'AIza***').slice(0, 500);
  }

  /**
   * Confirms the Gemini credentials work, without needing a receipt photo.
   *
   * Exists so a broken deployment can be diagnosed from the client instead of
   * by reading server logs — "scanning is broken" is otherwise indisting-
   * uishable from "that photo was unreadable".
   */
  async checkConfiguration(): Promise<{
    ok: boolean;
    model: string;
    message: string;
    availableModels?: string[];
    suggestion?: string;
  }> {
    try {
      const response = await this.genai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
        config: { maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
      });

      return {
        ok: true,
        model: this.model,
        message: `Gemini responded: "${(response.text ?? '').trim().slice(0, 40)}"`,
      };
    } catch (err) {
      const mapped = this.toHttpException(err);

      // "That model is unavailable" is only half an answer — the other half
      // is which models this key CAN use. Listing them turns a dead end into
      // a value to paste into GEMINI_MODEL.
      const availableModels = await this.listUsableModels();

      return {
        ok: false,
        model: this.model,
        message: mapped.message,
        ...(availableModels.length ? { availableModels } : {}),
        ...(availableModels.length
          ? { suggestion: `Set GEMINI_MODEL to one of these, e.g. "${pickBest(availableModels)}"` }
          : {}),
      };
    }
  }

  /** Models this API key may call generateContent on. */
  private async listUsableModels(): Promise<string[]> {
    try {
      const pager = await this.genai.models.list();
      const names: string[] = [];

      for await (const model of pager) {
        // A key can expose dozens of models including embedding-only ones;
        // cap the walk so a diagnostic never turns into a long paginated crawl.
        if (names.length >= 40) break;

        const actions = model.supportedActions;
        const usable = !actions || actions.includes('generateContent');
        if (usable && model.name) {
          names.push(model.name.replace(/^models\//, ''));
        }
      }

      return names;
    } catch (err) {
      this.logger.warn(`Could not list models: ${this.redact((err as Error).message)}`);
      return [];
    }
  }
}

/** Prefers a current flash model — cheapest and fastest for OCR. */
function pickBest(models: string[]): string {
  const preference = [
    (m: string) => /^gemini-[\d.]+-flash$/.test(m),
    (m: string) => /^gemini-.*flash.*$/.test(m) && !/thinking|8b|lite/.test(m),
    (m: string) => /^gemini-.*flash/.test(m),
    (m: string) => /^gemini-.*pro/.test(m),
    () => true,
  ];

  for (const matches of preference) {
    const hit = models.find(matches);
    if (hit) return hit;
  }
  return models[0];
}

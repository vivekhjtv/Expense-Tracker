import { Schema, Type } from '@google/genai';
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from '../../common/enums';

/**
 * Structured-output contract for Gemini.
 *
 * With `responseMimeType: application/json` + this schema, the model is
 * constrained during decoding — it cannot emit prose, markdown fences, a
 * missing field, or a category outside our enum. That removes the entire
 * class of "parse the LLM's freeform text" bugs; JSON.parse still gets a
 * try/catch, but it is a genuine edge case rather than the normal path.
 *
 * `propertyOrdering` matters more than it looks: generation is sequential, so
 * emitting merchant/date/items BEFORE totalAmount lets the model read the
 * line items it just transcribed when it decides the total.
 */
export const RECEIPT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  propertyOrdering: [
    'isReceipt',
    'merchantName',
    'date',
    'currency',
    'items',
    'subTotal',
    'taxAmount',
    'discountAmount',
    'totalAmount',
    'paymentMode',
    'category',
    'notes',
    'confidence',
  ],
  required: ['isReceipt', 'totalAmount', 'paymentMode', 'category', 'items', 'confidence'],
  properties: {
    isReceipt: {
      type: Type.BOOLEAN,
      description:
        'True only if this image is a purchase receipt, bill, invoice or payment confirmation. ' +
        'False for selfies, screenshots of chats, documents, or anything unreadable.',
    },
    merchantName: {
      type: Type.STRING,
      nullable: true,
      description:
        'Shop/business name exactly as printed at the top of the bill, e.g. "DMart", ' +
        '"Reliance Fresh", "Swiggy". Null if not visible.',
    },
    date: {
      type: Type.STRING,
      nullable: true,
      description:
        'Purchase date in strict YYYY-MM-DD format. Indian receipts are usually DD/MM/YYYY — ' +
        'convert accordingly (05/11/2025 means 2025-11-05). Null if no date is printed.',
    },
    currency: {
      type: Type.STRING,
      nullable: true,
      description: 'ISO-4217 code inferred from the symbol. Rs/₹/INR -> "INR". Default "INR".',
    },
    items: {
      type: Type.ARRAY,
      description:
        'Every purchased line item. Transcribe product names as printed (expand obvious ' +
        'abbreviations only). EXCLUDE non-product rows: subtotal, tax/GST/CGST/SGST, ' +
        'discounts, round-off, tip, delivery fee, grand total. Empty array if illegible.',
      items: {
        type: Type.OBJECT,
        propertyOrdering: ['name', 'qty', 'price'],
        required: ['name', 'qty', 'price'],
        properties: {
          name: { type: Type.STRING, description: 'Product name as printed on the bill.' },
          qty: {
            type: Type.NUMBER,
            description: 'Quantity purchased. Use 1 when the bill does not print one.',
          },
          price: {
            type: Type.NUMBER,
            description:
              'UNIT price for ONE of this item, not the line total. If the receipt shows ' +
              'only a line total, divide it by qty.',
          },
        },
      },
    },
    subTotal: {
      type: Type.NUMBER,
      nullable: true,
      description: 'Pre-tax subtotal if printed, else null.',
    },
    taxAmount: {
      type: Type.NUMBER,
      nullable: true,
      description: 'Total tax (GST/CGST+SGST/VAT) if printed, else null.',
    },
    discountAmount: {
      type: Type.NUMBER,
      nullable: true,
      description: 'Total discount/savings as a POSITIVE number if printed, else null.',
    },
    totalAmount: {
      type: Type.NUMBER,
      description:
        'The final amount actually paid — the grand total AFTER tax and discounts. ' +
        'This is the single most important field; prefer the largest clearly-labelled ' +
        'total ("Grand Total", "Net Payable", "Amount Paid"). Never return a negative value.',
    },
    paymentMode: {
      type: Type.STRING,
      enum: [...PAYMENT_MODES],
      description:
        'ONLINE_BANKING when the bill mentions UPI, GPay, PhonePe, Paytm, card, VISA, ' +
        'Mastercard, RuPay, NetBanking, wallet, or shows a transaction/approval/RRN code. ' +
        'CASH when it says Cash, "Cash Tendered", or shows change returned. ' +
        'When genuinely unclear, answer CASH.',
    },
    category: {
      type: Type.STRING,
      enum: [...EXPENSE_CATEGORIES],
      description:
        'Best-fit spending category for the whole bill. Supermarket/kirana -> GROCERIES. ' +
        'Restaurant/cafe/food delivery -> FOOD_DINING. Petrol pump -> FUEL. ' +
        'Cab/bus/train/metro -> TRANSPORT. Chemist/clinic/hospital -> HEALTH. ' +
        'Electricity/water/mobile/internet bill -> UTILITIES. Use OTHER only as a last resort.',
    },
    notes: {
      type: Type.STRING,
      nullable: true,
      description:
        'At most one short sentence of useful context (e.g. invoice number, table number). ' +
        'Null if nothing noteworthy.',
    },
    confidence: {
      type: Type.NUMBER,
      description:
        'Your confidence from 0.0 to 1.0 that totalAmount and items are correct. ' +
        'Be honest: use below 0.5 for blurry, cropped, crumpled or partially cut-off bills.',
    },
  },
};

export const RECEIPT_SYSTEM_INSTRUCTION = `You are a precise receipt-and-invoice data extraction engine for an Indian personal finance app.

Rules:
1. Transcribe ONLY what is visibly printed on the image. Never guess, complete, or invent a value you cannot read. Use null for anything not present.
2. Numbers must be plain decimals with no currency symbol, no thousands separator, no spaces. "Rs. 1,234.50" -> 1234.50.
3. Indian dates are day-first. "05/11/2025" is 2025-11-05, not 2025-05-11.
4. totalAmount is the FINAL payable amount after tax and discount.
5. item.price is the price of ONE unit, never the line total.
6. Never include subtotal, tax, discount, round-off or total rows inside the items array.
7. If the image is not a receipt/bill/invoice, set isReceipt=false, totalAmount=0, items=[] and confidence=0.
8. Respond with JSON conforming to the provided schema and nothing else.`;

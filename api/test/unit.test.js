/**
 * Unit tests: money precision, image signature sniffing, and receipt
 * normalisation against malformed model output (no network, no database).
 *
 * Run: npm run build && npm run test:unit
 */
const path = require('path').join(__dirname, '..', 'dist');
const money = require(path + '/common/utils/money.util');
const sig = require(path + '/common/utils/image-signature.util');
const { ReceiptService } = require(path + '/modules/receipts/receipt.service');

let pass = 0, fail = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` + (ok ? '' : `\n        got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`));
};

console.log('--- money ---');
eq('0.1 + 0.2 === 0.3', money.addMoney(0.1, 0.2), 0.3);
eq('raw float would drift', 0.1 + 0.2 === 0.3, false);
eq('subtract 4999.99 - 0.99', money.subtractMoney(4999.99, 0.99), 4999);
eq('sum of 3x 0.07', money.sumMoney([0.07, 0.07, 0.07]), 0.21);
eq('price*qty 12.35*3', money.multiplyMoney(12.35, 3), 37.05);
eq('differsBeyond(100,100.5,1)', money.differsBeyond(100, 100.5, 1), false);
eq('differsBeyond(100,105,1)', money.differsBeyond(100, 105, 1), true);

console.log('--- image signatures ---');
eq('jpeg', sig.detectImageMimeType(Buffer.from([0xff,0xd8,0xff,0xe0,0,0,0,0,0,0,0,0])), 'image/jpeg');
eq('png', sig.detectImageMimeType(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0])), 'image/png');
eq('webp', sig.detectImageMimeType(Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP')])), 'image/webp');
eq('heic', sig.detectImageMimeType(Buffer.concat([Buffer.alloc(4),Buffer.from('ftyp'),Buffer.from('heic')])), 'image/heic');
eq('pdf rejected', sig.detectImageMimeType(Buffer.from('%PDF-1.7 aaaaaaaa')), null);

console.log('--- receipt normalisation ---');
const cfg = { getOrThrow: (k) => ({ 'gemini.model': 'gemini-2.5-flash', 'gemini.thinkingBudget': 0 }[k]) };
const makeSvc = (payload) => new ReceiptService(
  { models: { generateContent: async () => ({ text: JSON.stringify(payload), promptFeedback: undefined }) } },
  cfg,
);
const img = { buffer: Buffer.from([0xff,0xd8,0xff]), mimeType: 'image/jpeg', sizeBytes: 3, originalName: 'r.jpg' };

(async () => {
  // Happy path: Indian grocery bill with GST
  let r = await makeSvc({
    isReceipt: true, merchantName: 'DMart', date: '2025-11-05', currency: 'INR',
    items: [{ name: 'Amul Milk 1L', qty: 2, price: 32 }, { name: 'Aashirvaad Atta 5kg', qty: 1, price: 265.50 }],
    subTotal: 329.50, taxAmount: 16.48, discountAmount: null, totalAmount: 345.98,
    paymentMode: 'ONLINE_BANKING', category: 'GROCERIES', notes: null, confidence: 0.94,
  }).scan(img);
  eq('total', r.totalAmount, 345.98);
  eq('items count', r.items.length, 2);
  eq('itemsTotal 32*2+265.50', r.meta.itemsTotal, 329.5);
  eq('category', r.category, 'GROCERIES');
  eq('paymentMode', r.paymentMode, 'ONLINE_BANKING');
  eq('date normalised to noon UTC', r.date, '2025-11-05T12:00:00.000Z');
  eq('no warnings (GST gap < Rs.1? no, 16.48 gap)', r.warnings.length, 1);

  // Junk defence: negative price, missing name, string qty, bogus category
  r = await makeSvc({
    isReceipt: true, merchantName: '   ', date: 'garbage', totalAmount: 500,
    items: [{ name: 'Good', qty: 0, price: 10 }, { name: null, qty: 1, price: 5 }, { name: 'Neg', qty: 1, price: -3 }],
    paymentMode: 'CRYPTO', category: 'SPACESHIPS', confidence: 0.3, notes: 'null',
  }).scan(img);
  eq('bad items dropped', r.items.length, 1);
  eq('qty 0 -> 1', r.items[0].qty, 1);
  eq('unknown paymentMode -> CASH', r.paymentMode, 'CASH');
  eq('unknown category -> OTHER', r.category, 'OTHER');
  eq('blank merchant -> null', r.merchantName, null);
  eq('"null" string note -> null', r.notes, null);
  eq('bad date falls back', r.date.slice(0, 4), String(new Date().getFullYear()));
  eq('low confidence warns', r.warnings.some(w => /hard to read/.test(w)), true);

  // Total unreadable -> summed from items
  r = await makeSvc({ isReceipt: true, totalAmount: 0, items: [{ name: 'A', qty: 3, price: 19.99 }], paymentMode: 'CASH', category: 'OTHER', confidence: 0.8 }).scan(img);
  eq('total recovered from items', r.totalAmount, 59.97);
  eq('recovery warned', r.warnings.some(w => /summed from the line items/.test(w)), true);

  // Not a receipt
  try {
    await makeSvc({ isReceipt: false, totalAmount: 0, items: [], paymentMode: 'CASH', category: 'OTHER', confidence: 0 }).scan(img);
    eq('non-receipt rejected', 'no throw', 'throws 422');
  } catch (e) { eq('non-receipt rejected 422', e.status, 422); }

  // Nothing readable at all
  try {
    await makeSvc({ isReceipt: true, totalAmount: 0, items: [], paymentMode: 'CASH', category: 'OTHER', confidence: 0.1 }).scan(img);
    eq('no amount rejected', 'no throw', 'throws 422');
  } catch (e) { eq('no-amount rejected 422', e.status, 422); }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

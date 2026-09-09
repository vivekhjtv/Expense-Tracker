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
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` + (ok ? '' : `\n        ${detail}`));
};
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
})();

/* ---- Gemini error mapping ------------------------------------------- */
(() => {
  console.log('\n--- Gemini error mapping ---');
  const cfg = {
    getOrThrow: (k) => ({ 'gemini.model': 'gemini-2.5-flash', 'gemini.thinkingBudget': 0 }[k]),
    get: (k) => (k === 'gemini.apiKey' ? 'AIzaSyFAKEKEY1234567890abcdef' : undefined),
  };
  const svc = new ReceiptService({ models: {} }, cfg);
  const map = (err) => svc.toHttpException(err).message;

  const geminiErr = (code, status, message, reason) => {
    const e = new Error(JSON.stringify({ error: { code, status, message, ...(reason ? { details: [{ reason }] } : {}) } }));
    e.status = code;
    return e;
  };

  const has = (label, actual, needle) =>
    check(label, actual.toLowerCase().includes(needle.toLowerCase()),
          `got="${actual}"  want to contain "${needle}"`);

  has('invalid API key names the key',
    map(geminiErr(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.')),
    'GEMINI_API_KEY is not valid');
  has('disabled API tells you to enable it',
    map(geminiErr(403, 'PERMISSION_DENIED', 'Generative Language API has not been used in project 123 before', 'SERVICE_DISABLED')),
    'Generative Language API is turned off');
  has('quota exhausted is distinguishable',
    map(geminiErr(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded')),
    'quota is used up');
  has('unknown model names the model',
    map(geminiErr(404, 'NOT_FOUND', 'models/gemini-9-ultra is not found for API version v1beta')),
    'gemini-2.5-flash');
  has('restricted key is explained',
    map(geminiErr(403, 'PERMISSION_DENIED', 'Requests from referer are blocked.')),
    'restricted');
  has('unsupported region is explained',
    map(geminiErr(400, 'FAILED_PRECONDITION', 'User location is not supported for the API use.')),
    'region');
  has('network failure is distinguishable',
    map(new Error('fetch failed')),
    'Could not reach');
  has('unknown failure still says something',
    map(new Error('something bizarre happened')),
    'Receipt scanning failed');

  // The key must never escape into a message the client receives.
  const leaked = map(geminiErr(400, 'INVALID_ARGUMENT', 'Bad key AIzaSyFAKEKEY1234567890abcdef supplied'));
  check('API key is redacted from error messages',
        !leaked.includes('AIzaSyFAKEKEY1234567890abcdef'), `got="${leaked}"`);
})();

/* ---- diagnostic probing ---------------------------------------------- */
(() => {
  console.log('\n--- diagnostic probing ---');
  const cfg = {
    getOrThrow: (k) => ({ 'gemini.model': 'gemini-2.5-flash', 'gemini.thinkingBudget': 0 }[k]),
    get: () => undefined,
  };

  const notFound = (model) => {
    const e = new Error(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: `models/${model} is not found for API version v1beta` } }));
    e.status = 404;
    return e;
  };

  // A key where the configured model 404s but others answer — exactly the
  // situation a stale or retired model name produces.
  const makeGenai = (workingSet, models) => ({
    models: {
      generateContent: async ({ model }) => {
        if (!workingSet.has(model)) throw notFound(model);
        return { text: 'ok' };
      },
      list: async () => ({
        async *[Symbol.asyncIterator]() {
          for (const name of models) yield { name: `models/${name}`, supportedActions: ['generateContent'] };
        },
      }),
    },
  });

  const catalogue = ['gemini-2.5-flash', 'gemini-2.5-flash-preview-tts', 'gemini-flash-latest', 'gemini-3.5-flash'];

  const svc = new ReceiptService(makeGenai(new Set(['gemini-flash-latest', 'gemini-3.5-flash']), catalogue), cfg);
  svc.checkConfiguration().then((r) => {
    check('reports failure for the configured model', r.ok === false && r.model === 'gemini-2.5-flash');
    check('quotes what Google actually said', (r.googleSaid || '').includes('not found'), `got="${r.googleSaid}"`);
    check('finds models that really work', (r.workingModels || []).includes('gemini-flash-latest'), `got=${JSON.stringify(r.workingModels)}`);
    check('never claims a working model is broken', !(r.workingModels || []).includes('gemini-2.5-flash'));
    check('suggestion is actionable', (r.suggestion || '').startsWith('GEMINI_MODEL=') || (r.suggestion || '').includes('GEMINI_MODEL='), `got="${r.suggestion}"`);
    check('skips tts variants when picking', !(r.workingModels || []).includes('gemini-2.5-flash-preview-tts'));

    // A healthy config must short-circuit without probing anything.
    let calls = 0;
    const healthyGenai = makeGenai(new Set(catalogue), catalogue);
    const inner = healthyGenai.models.generateContent;
    healthyGenai.models.generateContent = async (a) => { calls++; return inner(a); };
    new ReceiptService(healthyGenai, cfg).checkConfiguration().then((ok) => {
      check('healthy config reports ok', ok.ok === true);
      check('healthy config makes exactly one call', calls === 1, `made ${calls}`);

      // Total failure must blame the key, not the model.
      new ReceiptService(makeGenai(new Set(), catalogue), cfg).checkConfiguration().then((dead) => {
        check('when nothing works, points at the API key', (dead.suggestion || '').includes('aistudio.google.com'), `got="${dead.suggestion}"`);
        check('no false workingModels when nothing works', !dead.workingModels);

        // An explicit ?model= override must be honoured.
        new ReceiptService(makeGenai(new Set(['gemini-3.5-flash']), catalogue), cfg)
          .checkConfiguration('gemini-3.5-flash')
          .then((over) => {
            check('honours an explicit model override', over.ok === true && over.model === 'gemini-3.5-flash');
            retrySuite();
          });
      });
    });
  });
})();

/* ---- transient overload retry ---------------------------------------- */
function retrySuite() {
  console.log('\n--- overload retry ---');
  const cfg = {
    getOrThrow: (k) => ({ 'gemini.model': 'gemini-flash-latest', 'gemini.thinkingBudget': 0 }[k]),
    get: () => undefined,
  };

  const overloaded = () => {
    const e = new Error(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.' } }));
    e.status = 503;
    return e;
  };
  const badKey = () => {
    const e = new Error(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }));
    e.status = 400;
    return e;
  };

  const payload = { isReceipt: true, merchantName: 'DMart', totalAmount: 100, items: [], paymentMode: 'CASH', category: 'GROCERIES', confidence: 0.9 };
  const img = { buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg', sizeBytes: 3, originalName: 'r.jpg' };

  // Fails twice with overload, then succeeds — the real-world spike shape.
  let calls = 0;
  const flaky = { models: { generateContent: async () => {
    calls++;
    if (calls < 3) throw overloaded();
    return { text: JSON.stringify(payload) };
  } } };

  const started = Date.now();
  new ReceiptService(flaky, cfg).scan(img).then((r) => {
    check('recovers from a transient overload', r.totalAmount === 100);
    check('retried rather than failing on the first spike', calls === 3, `made ${calls} calls`);
    check('backed off between attempts', Date.now() - started >= 1000, `took ${Date.now() - started}ms`);

    // Persistent overload must give up and say something useful.
    let alwaysBusy = 0;
    const dead = { models: { generateContent: async () => { alwaysBusy++; throw overloaded(); } } };
    new ReceiptService(dead, cfg).scan(img).then(
      () => check('persistent overload should reject', false),
      (err) => {
        check('gives up after a bounded number of attempts', alwaysBusy === 3, `made ${alwaysBusy}`);
        check('tells the user it is busy, not broken', /busy right now/i.test(err.message), `got="${err.message}"`);
        check('no doubled full stop', !/\.\./.test(err.message), `got="${err.message}"`);

        // A permanent error must NOT be retried — that just burns quota.
        let keyCalls = 0;
        const broken = { models: { generateContent: async () => { keyCalls++; throw badKey(); } } };
        new ReceiptService(broken, cfg).scan(img).then(
          () => check('bad key should reject', false),
          (err2) => {
            check('does not retry a permanent failure', keyCalls === 1, `made ${keyCalls}`);
            check('still names the key problem', /GEMINI_API_KEY is not valid/.test(err2.message), `got="${err2.message}"`);
            console.log(`\n${pass} passed, ${fail} failed`);
            process.exit(fail ? 1 : 0);
          },
        );
      },
    );
  });
}

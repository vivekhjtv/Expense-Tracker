/**
 * Integration tests: full HTTP stack against a real MongoDB instance.
 *
 * This is a spending LOG — no accounts, no balances. The guarantees that
 * matter here are that a transaction can always be recorded, that filters and
 * aggregations agree with each other, and that money maths never drifts.
 *
 * Run: npm run test:integration
 */
require('reflect-metadata');
const path = require('path');
const API = 'http://localhost:3998/api';
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        ${detail}`}`);
};
const eq = (label, actual, expected) =>
  check(label, JSON.stringify(actual) === JSON.stringify(expected),
        `got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`);

let TOKEN = null;

async function req(method, p, body, token = TOKEN) {
  const res = await fetch(API + p, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const day = (d) => `2026-09-${String(d).padStart(2, '0')}T12:00:00.000Z`;
const expense = (over = {}) => ({
  amount: 100, paymentMode: 'CASH', category: 'GROCERIES', date: day(5), ...over,
});

(async () => {
  const replset = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = replset.getUri('expense_test');
  process.env.GEMINI_API_KEY = 'test-key-placeholder';
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';
  process.env.PORT = '3998';
  process.env.NODE_ENV = 'test';

  const D = path.join(__dirname, '..', 'dist');
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require(D + '/app.module');
  const { AllExceptionsFilter } = require(D + '/common/filters/all-exceptions.filter');

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3998);

  try {
    console.log('=== auth ===');
    eq('unauthenticated request -> 401', (await req('GET', '/transactions', null, null)).status, 401);
    eq('garbage token -> 401', (await req('GET', '/transactions', null, 'not-a-jwt')).status, 401);

    const reg = await req('POST', '/auth/register',
      { name: 'Vivek', email: 'Vivek@Example.COM ', password: 'correct horse battery' }, null);
    eq('registered', reg.status, 201);
    check('returns a token', typeof reg.body.accessToken === 'string' && reg.body.accessToken.length > 20);
    eq('email normalised to lowercase', reg.body.user.email, 'vivek@example.com');
    check('password never echoed back', !JSON.stringify(reg.body).toLowerCase().includes('horse'));
    TOKEN = reg.body.accessToken;

    eq('duplicate email -> 409',
      (await req('POST', '/auth/register', { name: 'Someone', email: 'vivek@example.com', password: 'another password' }, null)).status, 409);
    eq('short password -> 400',
      (await req('POST', '/auth/register', { name: 'X', email: 'x@y.com', password: 'short' }, null)).status, 400);
    eq('bad email -> 400',
      (await req('POST', '/auth/register', { name: 'X', email: 'not-an-email', password: 'long enough pw' }, null)).status, 400);

    const login = await req('POST', '/auth/login', { email: 'vivek@example.com', password: 'correct horse battery' }, null);
    eq('login ok', login.status, 200);
    eq('wrong password -> 401',
      (await req('POST', '/auth/login', { email: 'vivek@example.com', password: 'wrong' }, null)).status, 401);
    eq('unknown email -> 401',
      (await req('POST', '/auth/login', { email: 'nobody@example.com', password: 'whatever pass' }, null)).status, 401);

    const me = await req('GET', '/auth/me');
    eq('me returns the signed-in user', me.body.email, 'vivek@example.com');
    check('me never leaks the hash', !JSON.stringify(me.body).includes('passwordHash'));

    console.log('\n=== recording spends ===');
    const first = await req('POST', '/transactions', expense({ amount: 249.5, merchantName: 'DMart' }));
    eq('created', first.status, 201);
    eq('defaults to EXPENSE', first.body.type, 'EXPENSE');
    eq('amount stored', first.body.amount, 249.5);
    eq('source defaults to MANUAL', first.body.source, 'MANUAL');

    console.log('\n=== nothing can block a spend ===');
    // The whole point of removing accounts: no balance rule can ever refuse
    // to record what actually happened.
    const huge = await req('POST', '/transactions', expense({ amount: 999999999, category: 'OTHER' }));
    eq('a huge cash spend is accepted', huge.status, 201);
    await req('DELETE', `/transactions/${huge.body._id}`);

    console.log('\n=== validation still applies ===');
    eq('zero amount -> 400', (await req('POST', '/transactions', expense({ amount: 0 }))).status, 400);
    eq('negative amount -> 400', (await req('POST', '/transactions', expense({ amount: -5 }))).status, 400);
    eq('missing paymentMode -> 400', (await req('POST', '/transactions', { amount: 10, date: day(5) })).status, 400);
    eq('bad paymentMode -> 400', (await req('POST', '/transactions', expense({ paymentMode: 'CRYPTO' }))).status, 400);
    eq('missing date -> 400', (await req('POST', '/transactions', { amount: 10, paymentMode: 'CASH' })).status, 400);
    eq('TRANSFER no longer exists', (await req('POST', '/transactions', expense({ type: 'TRANSFER' }))).status, 400);
    eq('accountId is rejected as unknown', (await req('POST', '/transactions', expense({ accountId: '507f1f77bcf86cd799439011' }))).status, 400);

    console.log('\n=== itemised expense ===');
    const itemized = await req('POST', '/transactions', expense({
      amount: 345.98, paymentMode: 'ONLINE_BANKING', merchantName: 'Reliance Fresh', date: day(6),
      items: [{ name: 'Amul Milk 1L', price: 32, qty: 2 }, { name: 'Atta 5kg', price: 265.5, qty: 1 }],
    }));
    eq('items stored', itemized.body.items.length, 2);
    eq('lineTotal virtual', itemized.body.items[0].lineTotal, 64);

    console.log('\n=== edit ===');
    const upd = await req('PATCH', `/transactions/${first.body._id}`, { amount: 300, category: 'FUEL', paymentMode: 'ONLINE_BANKING' });
    eq('amount updated', upd.body.amount, 300);
    eq('category updated', upd.body.category, 'FUEL');
    eq('paymentMode updated', upd.body.paymentMode, 'ONLINE_BANKING');
    eq('empty patch -> 400', (await req('PATCH', `/transactions/${first.body._id}`, {})).status, 400);
    eq('unknown id -> 404', (await req('PATCH', '/transactions/507f1f77bcf86cd799439011', { amount: 5 })).status, 404);

    console.log('\n=== delete ===');
    const doomed = await req('POST', '/transactions', expense({ amount: 42 }));
    eq('deleted', (await req('DELETE', `/transactions/${doomed.body._id}`)).status, 200);
    eq('gone', (await req('GET', `/transactions/${doomed.body._id}`)).status, 404);
    eq('double delete -> 404', (await req('DELETE', `/transactions/${doomed.body._id}`)).status, 404);

    console.log('\n=== float precision ===');
    for (let i = 0; i < 10; i++) {
      await req('POST', '/transactions', expense({ amount: 0.1, category: 'PRECISION', date: day(20) }));
    }
    const precise = (await req('GET', '/analytics/categories?range=ALL')).body.find(c => c.category === 'PRECISION');
    eq('10 x 0.10 sums to exactly 1', precise.total, 1);

    console.log('\n=== income ===');
    await req('POST', '/transactions', { amount: 95000, type: 'INCOME', paymentMode: 'ONLINE_BANKING', category: 'SALARY', date: day(1) });
    const withIncome = (await req('GET', '/analytics/summary?range=ALL')).body;
    eq('income tracked separately', withIncome.totalIncome, 95000);
    check('income excluded from spend', !JSON.stringify(withIncome.totalSpend).includes('95000'), `spend=${withIncome.totalSpend}`);

    console.log('\n=== filters ===');
    const cashOnly = (await req('GET', '/transactions?range=ALL&paymentMode=CASH&limit=100')).body;
    check('cash filter', cashOnly.data.every(t => t.paymentMode === 'CASH'), 'non-cash leaked');
    const onlineOnly = (await req('GET', '/transactions?range=ALL&paymentMode=ONLINE_BANKING&limit=100')).body;
    check('online filter', onlineOnly.data.every(t => t.paymentMode === 'ONLINE_BANKING'));
    eq('cash + online === all', cashOnly.meta.total + onlineOnly.meta.total,
       (await req('GET', '/transactions?range=ALL&limit=100')).body.meta.total);
    const byCat = (await req('GET', '/transactions?range=ALL&category=FUEL&limit=100')).body;
    check('category filter', byCat.data.every(t => t.category === 'FUEL'));
    eq('search matches merchant', (await req('GET', '/transactions?range=ALL&search=Reliance&limit=100')).body.meta.total, 1);
    eq('search matches a line item', (await req('GET', '/transactions?range=ALL&search=Amul&limit=100')).body.meta.total, 1);
    eq('search escapes regex metacharacters', (await req('GET', '/transactions?range=ALL&search=.*&limit=100')).body.meta.total, 0);
    eq('limit is capped', (await req('GET', '/transactions?limit=500')).status, 400);

    console.log('\n=== date ranges ===');
    await req('POST', '/transactions', expense({ amount: 77, date: new Date().toISOString(), category: 'TODAYS' }));
    eq('TODAY finds it', (await req('GET', '/transactions?range=TODAY&limit=100')).body.data.some(t => t.category === 'TODAYS'), true);
    const custom = (await req('GET', '/transactions?range=CUSTOM&from=2026-09-05&to=2026-09-06&limit=100')).body;
    check('custom range is inclusive of both days', custom.meta.total >= 2, `got ${custom.meta.total}`);

    console.log('\n=== analytics agree with the ledger ===');
    const dash = (await req('GET', '/analytics/dashboard?range=ALL')).body;
    const s = dash.summary;
    eq('cash + online === total spend', Math.round((s.cashSpend + s.onlineSpend) * 100) / 100, s.totalSpend);
    eq('shares sum to 100', Math.round(s.cashSharePct + s.onlineSharePct), 100);
    eq('categories sum === total spend',
       Math.round(dash.categories.reduce((a, c) => a + c.total, 0) * 100) / 100, s.totalSpend);
    eq('payment split sum === total spend',
       Math.round(dash.paymentModes.reduce((a, p) => a + p.total, 0) * 100) / 100, s.totalSpend);
    eq('payment split always has 2 entries', dash.paymentModes.length, 2);
    check('categories sorted biggest-first',
      dash.categories.every((c, i, a) => i === 0 || a[i - 1].total >= c.total));
    check('largestSpend is the biggest single row',
      dash.categories.every(c => c.total >= 0) && s.largestSpend > 0, `largest=${s.largestSpend}`);

    console.log('\n=== zero-filled trend ===');
    const sept = (await req('GET', '/analytics/daily-trend?range=THIS_MONTH&tzOffset=330')).body;
    eq('september has 30 points', sept.length, 30);
    check('gaps are zero, not missing', sept.every(p => typeof p.total === 'number'));

    console.log('\n=== empty state ===');
    const empty = (await req('GET', '/analytics/dashboard?range=CUSTOM&from=2001-01-01&to=2001-01-02')).body;
    eq('no spend -> zero, not NaN', empty.summary.totalSpend, 0);
    eq('no divide-by-zero on shares', empty.summary.cashSharePct, 0);
    eq('still emits both payment modes', empty.paymentModes.length, 2);
    eq('no top category', empty.summary.topCategory, null);

    console.log('\n=== data is scoped to the signed-in user ===');
    const other = await req('POST', '/auth/register',
      { name: 'Someone Else', email: 'other@example.com', password: 'a different password' }, null);
    const otherToken = other.body.accessToken;

    const mine = (await req('GET', '/transactions?range=ALL&limit=100')).body.meta.total;
    const theirs = (await req('GET', '/transactions?range=ALL&limit=100', null, otherToken)).body.meta.total;
    check('a new user sees an empty ledger', theirs === 0, `saw ${theirs} of my ${mine} rows`);

    // The decisive test: knowing another user's row id must not be enough.
    const myRow = (await req('GET', '/transactions?range=ALL&limit=1')).body.data[0];
    eq('cannot read another user\'s transaction',
      (await req('GET', `/transactions/${myRow._id}`, null, otherToken)).status, 404);
    eq('cannot edit another user\'s transaction',
      (await req('PATCH', `/transactions/${myRow._id}`, { amount: 1 }, otherToken)).status, 404);
    eq('cannot delete another user\'s transaction',
      (await req('DELETE', `/transactions/${myRow._id}`, null, otherToken)).status, 404);
    eq('their dashboard is empty',
      (await req('GET', '/analytics/summary?range=ALL', null, otherToken)).body.totalSpend, 0);
    check('my data is untouched',
      (await req('GET', '/transactions?range=ALL&limit=100')).body.meta.total === mine);

    console.log('\n=== receipt scanning is protected too ===');
    eq('scan without a token -> 401', (await req('POST', '/receipts/scan', null, null)).status, 401);

  } catch (e) {
    fail++; console.log('THREW: ' + (e.stack || e));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await app.close();
  await replset.stop();
  process.exit(fail ? 1 : 0);
})();

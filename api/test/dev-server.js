/**
 * Runs the API against a throwaway in-memory MongoDB replica set.
 *
 * Lets you develop the whole app — including transfers and every ACID path —
 * without an Atlas connection string. Data is discarded on exit.
 *
 * If GEMINI_API_KEY is not set, receipt scanning is served by a stub so the
 * camera flow can still be exercised offline.
 *
 * Run: npm run start:memory
 */
require('reflect-metadata');
const path = require('path');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

(async () => {
  const replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  process.env.MONGODB_URI = replset.getUri('expense_tracker_dev');
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.PORT = process.env.PORT || '3000';

  if (!process.env.JWT_SECRET) {
    // Dev-only fallback so `npm run start:memory` needs no setup. Tokens are
    // invalidated on every restart, which is fine for a throwaway database.
    process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
  }

  const useStubGemini = !process.env.GEMINI_API_KEY;
  if (useStubGemini) {
    process.env.GEMINI_API_KEY = 'stub-key-for-local-development';
  }

  const D = path.join(__dirname, '..', 'dist');
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe, Logger } = require('@nestjs/common');
  const { AppModule } = require(D + '/app.module');
  const { AllExceptionsFilter } = require(D + '/common/filters/all-exceptions.filter');
  const { GEMINI_CLIENT } = require(D + '/modules/receipts/gemini.provider');

  const builder = NestFactory.create(AppModule);
  const app = await builder;

  if (useStubGemini) {
    // Deterministic sample so the scan-to-form flow works with no API key.
    const stub = app.get(GEMINI_CLIENT);
    stub.models.generateContent = async () => ({
      text: JSON.stringify({
        isReceipt: true,
        merchantName: 'Reliance Fresh',
        date: new Date().toISOString().slice(0, 10),
        currency: 'INR',
        items: [
          { name: 'Amul Gold Milk 1L', qty: 2, price: 34 },
          { name: 'Aashirvaad Atta 5kg', qty: 1, price: 265.5 },
          { name: 'Tata Salt 1kg', qty: 1, price: 28 },
        ],
        subTotal: 361.5,
        taxAmount: 18.08,
        discountAmount: null,
        totalAmount: 379.58,
        paymentMode: 'ONLINE_BANKING',
        category: 'GROCERIES',
        notes: 'Stubbed scan — set GEMINI_API_KEY for the real thing',
        confidence: 0.93,
      }),
    });
  }

  app.setGlobalPrefix(process.env.API_PREFIX || 'api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT);
  new Logger('DevServer').log(
    `In-memory API on http://localhost:${process.env.PORT}/api` +
      (useStubGemini ? '  (Gemini stubbed — set GEMINI_API_KEY for real scans)' : ''),
  );

  const shutdown = async () => {
    await app.close();
    await replset.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();

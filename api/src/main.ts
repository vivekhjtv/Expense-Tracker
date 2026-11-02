import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const logger = new Logger('Bootstrap');

// Prevent transient MongoDB Atlas TLS socket resets from crashing the process
process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.warn(`Intercepted unhandled rejection: ${err.message}`);
});

process.on('uncaughtException', (err: Error) => {
  if (err.name === 'MongoNetworkError' || err.message?.includes('decryption failed')) {
    logger.warn(`Recovered from Mongo network reset: ${err.message}`);
    return;
  }
  logger.error(`Fatal uncaught exception: ${err.message}`, err.stack);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  const prefix = config.getOrThrow<string>('app.apiPrefix');
  const port = config.getOrThrow<number>('app.port');
  const corsOrigins = config.getOrThrow<string[]>('app.corsOrigins');

  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown keys outright rather than silently dropping them, so a
      // client typo becomes a visible 400 instead of a missing field.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`API ready on http://localhost:${port}/${prefix}`);
}

void bootstrap();

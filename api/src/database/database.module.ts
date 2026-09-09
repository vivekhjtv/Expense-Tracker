import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { IndexInitializer } from './index-initializer.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';

const logger = new Logger('Database');

/**
 * MongoDB connection.
 *
 * Each transaction is a single self-contained document, so every write is
 * atomic on its own and no multi-document sessions are needed. That also
 * means a plain standalone `mongod` works fine here — a replica set is no
 * longer a requirement.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('database.uri'),
        // Fail fast rather than buffering writes forever behind a dead socket.
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
        retryWrites: true,
        // Off deliberately — IndexInitializer builds them, awaited, before
        // the server accepts traffic. See that file for why.
        autoIndex: false,
        connectionFactory: (connection: Connection) => {
          connection.on('connected', () =>
            logger.log(`Connected to MongoDB database "${connection.name}"`),
          );
          connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
          connection.on('error', (err: Error) => logger.error(`MongoDB error: ${err.message}`));
          return connection;
        },
      }),
    }),
    MongooseModule.forFeature([{ name: Transaction.name, schema: TransactionSchema }]),
  ],
  providers: [IndexInitializer],
  exports: [MongooseModule],
})
export class DatabaseModule {}

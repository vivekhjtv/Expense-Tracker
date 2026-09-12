import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MilkEntry, MilkEntrySchema } from '../../database/schemas/milk-entry.schema';
import { MilkController } from './milk.controller';
import { MilkService } from './milk.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: MilkEntry.name, schema: MilkEntrySchema }])],
  controllers: [MilkController],
  providers: [MilkService],
  exports: [MilkService],
})
export class MilkModule {}

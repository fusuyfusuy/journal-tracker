import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Journal } from '@journal/database';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Journal])],
  controllers: [JournalsController],
  providers: [JournalsService],
})
export class JournalsModule {}

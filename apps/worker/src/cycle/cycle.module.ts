import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FetchersModule } from '../fetchers/fetchers.module';
import { NotifiersModule } from '../notifiers/notifiers.module';
import { CycleProcessor, CYCLE_QUEUE } from './cycle.processor';
import { CycleService } from './cycle.service';
import { SchedulerBootstrap } from './scheduler.bootstrap';

@Module({
  imports: [
    BullModule.registerQueue({ name: CYCLE_QUEUE }),
    FetchersModule,
    NotifiersModule,
  ],
  providers: [CycleService, CycleProcessor, SchedulerBootstrap],
  exports: [CycleService],
})
export class CycleModule {}

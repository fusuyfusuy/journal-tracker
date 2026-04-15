import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StructuredLogger } from '@journal/shared';
import { AppModule } from './app.module';
import { CycleService } from './cycle/cycle.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(StructuredLogger));
  const log = app.get(StructuredLogger);

  const once = process.argv.includes('--once');

  if (once) {
    const cycle = app.get(CycleService);
    try {
      const summary = await cycle.run();
      log.info('worker.once.done', { ...summary });
      await app.close();
      process.exit(0);
    } catch (e) {
      log.error('worker.once.failed', { message: (e as Error).message });
      await app.close();
      process.exit(1);
    }
  }

  log.info('worker.started', {});

  const shutdown = async (signal: string): Promise<void> => {
    log.info('worker.shutdown', { signal });
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', msg: 'worker.fatal', error: String(err) }));
  process.exit(1);
});

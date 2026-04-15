import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppConfig, StructuredLogger } from '@journal/shared';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLogger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = app.get(ConfigService);
  const cfg = config.getOrThrow<AppConfig>('app');
  const logger = app.get(StructuredLogger);

  if (cfg.apiKeys.length === 0 && process.env.NODE_ENV === 'production') {
    logger.warn('api.no_api_keys', {
      message: 'API_KEYS is empty — all requests will be rejected in production',
    });
  }

  await app.listen(cfg.api.port);
  logger.info('api.listening', { port: cfg.api.port });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', msg: 'api.fatal', error: String(err) }));
  process.exit(1);
});

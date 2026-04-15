import { registerAs } from '@nestjs/config';

export interface AppConfig {
  checkIntervalMs: number;
  dbPath: string;
  userAgent: string;
  redis: { host: string; port: number; password?: string };
  resend: { apiKey: string; from: string };
  api: { port: number };
}

const MIN_CHECK_INTERVAL_MS = 3_600_000;
const DEFAULT_CHECK_INTERVAL_MS = 21_600_000;

export const appConfig = registerAs('app', (): AppConfig => {
  const resendApiKey = process.env.RESEND_API_KEY ?? '';
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is required');
  }

  const rawInterval = process.env.CHECK_INTERVAL_MS;
  let checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  if (rawInterval !== undefined) {
    const parsed = Number.parseInt(rawInterval, 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`CHECK_INTERVAL_MS must be an integer, got "${rawInterval}"`);
    }
    checkIntervalMs = Math.max(parsed, MIN_CHECK_INTERVAL_MS);
  }

  return {
    checkIntervalMs,
    dbPath: process.env.DB_PATH ?? './data/journal-tracker.db',
    userAgent: 'academic-journal-tracker/2.0',
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    resend: {
      apiKey: resendApiKey,
      from: process.env.RESEND_FROM ?? 'notifications@example.com',
    },
    api: {
      port: Number.parseInt(process.env.API_PORT ?? '3000', 10),
    },
  };
});

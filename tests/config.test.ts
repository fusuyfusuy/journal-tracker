import { describe, it, expect } from 'bun:test';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('returns AppConfig with defaults when env has only RESEND_API_KEY', () => {
    const prev = { ...process.env };
    process.env.RESEND_API_KEY = 'rk_test';
    delete process.env.CHECK_INTERVAL_MS;
    delete process.env.DB_PATH;
    try {
      const cfg = loadConfig();
      expect(cfg.resendApiKey).toBe('rk_test');
      expect(cfg.checkIntervalMs).toBeGreaterThanOrEqual(3_600_000);
      expect(typeof cfg.dbPath).toBe('string');
      expect(typeof cfg.userAgent).toBe('string');
    } finally {
      process.env = prev;
    }
  });

  it('throws when RESEND_API_KEY is missing (negative case)', () => {
    const prev = { ...process.env };
    delete process.env.RESEND_API_KEY;
    try {
      expect(() => loadConfig()).toThrow();
    } finally {
      process.env = prev;
    }
  });

  it('clamps CHECK_INTERVAL_MS below 1h up to 1h minimum', () => {
    const prev = { ...process.env };
    process.env.RESEND_API_KEY = 'rk_test';
    process.env.CHECK_INTERVAL_MS = '1000';
    try {
      const cfg = loadConfig();
      expect(cfg.checkIntervalMs).toBeGreaterThanOrEqual(3_600_000);
    } finally {
      process.env = prev;
    }
  });
});

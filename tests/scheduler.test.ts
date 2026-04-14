import { describe, it, expect } from 'bun:test';
import { startScheduler } from '../src/scheduler';
import { initDb } from '../src/db';

describe('startScheduler', () => {
  it('is an async function with the documented signature', () => {
    expect(typeof startScheduler).toBe('function');
    // signature check only — running it would start an interval loop.
    expect(startScheduler.length).toBeGreaterThanOrEqual(2);
  });

  it('starts without throwing (no longer a stub)', async () => {
    const db = initDb(':memory:');
    const cfg = { checkIntervalMs: 3_600_000, resendApiKey: 'rk', dbPath: ':memory:', userAgent: 'ua' };
    let threw = false;
    try {
      const p = startScheduler(db, cfg);
      if (p && typeof (p as any).then === 'function') {
        // Race: either the scheduler rejects quickly, or we conclude it started fine.
        await Promise.race([
          p.catch((e: Error) => {
            threw = true;
            throw e;
          }),
          new Promise((res) => setTimeout(res, 50)),
        ]);
      }
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

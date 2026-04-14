// scheduler.ts — single-flight interval loop with SIGINT/SIGTERM graceful shutdown.
// Owns the long-running mode of the statechart (Flow 4).

import type { Database } from 'bun:sqlite';
import type { AppConfig } from './config';
import { runCycle } from './cycle';
import { log } from './log';

/**
 * Starts the scheduler loop.
 * - Runs one cycle immediately on start.
 * - Repeats every config.checkIntervalMs milliseconds.
 * - Skips if a cycle is already running (single-flight guard).
 * - Exits cleanly on SIGINT / SIGTERM.
 */
export async function startScheduler(db: Database, config: AppConfig): Promise<void> {
  let running = false;
  let shutdown = false;

  process.on('SIGINT', () => {
    shutdown = true;
    log.info('scheduler.shutdown', { signal: 'SIGINT' });
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    shutdown = true;
    log.info('scheduler.shutdown', { signal: 'SIGTERM' });
    process.exit(0);
  });

  async function tick(): Promise<void> {
    if (running || shutdown) {
      log.warn('scheduler.skip', { reason: running ? 'overrun' : 'shutdown' });
      return;
    }
    running = true;
    try {
      await runCycle(db, config);
    } finally {
      running = false;
    }
  }

  await tick(); // immediate first run
  const timer = setInterval(tick, config.checkIntervalMs);
  // Keep process alive — Bun keeps alive while interval is set; no need for explicit park
}

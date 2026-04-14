// Entry point — parses CLI args and dispatches to one-shot (Flow 3) or long-running scheduler (Flow 4).

import { loadConfig } from './config';
import { initDb } from './db';
import { runCycle } from './cycle';
import { startScheduler } from './scheduler';
import { log } from './log';

/**
 * Parse CLI arguments from process.argv.
 * Returns { once: boolean } — true if --once flag is present.
 */
export function parseArgs(argv: string[]): { once: boolean } {
  return { once: argv.includes('--once') };
}

/**
 * Main entry point.
 * - Validates config via loadConfig()
 * - Initialises DB via initDb()
 * - If --once: runs runCycle() once then exits (Flow 3)
 * - Otherwise: starts startScheduler() (Flow 4)
 */
async function main(): Promise<void> {
  const { once } = parseArgs(process.argv);

  let config;
  try {
    config = loadConfig();
  } catch (e) {
    log.error('config.invalid', { message: (e as Error).message });
    process.exit(1);
  }

  const db = initDb(config.dbPath);

  log.info('startup', {
    mode: once ? 'once' : 'scheduler',
    checkIntervalMs: config.checkIntervalMs,
    dbPath: config.dbPath,
  });

  if (once) {
    await runCycle(db, config);
    process.exit(0);
  } else {
    await startScheduler(db, config);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'fatal',
        error: String(err),
        ts: new Date().toISOString(),
      })
    );
    process.exit(1);
  });
}

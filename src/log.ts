// Non-action module: Structured JSON stdout logger.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

/**
 * Non-action module: structured JSON logger.
 * Writes one JSON line per call to process.stdout.
 * Field `ts` is always ISO-8601 UTC; `level` is one of debug|info|warn|error.
 */
export const log = {
  debug(msg: string, fields?: Record<string, unknown>): void {
    const record: LogRecord = {
      level: 'debug',
      msg,
      ts: new Date().toISOString(),
      ...fields,
    };
    process.stdout.write(JSON.stringify(record) + '\n');
  },

  info(msg: string, fields?: Record<string, unknown>): void {
    const record: LogRecord = {
      level: 'info',
      msg,
      ts: new Date().toISOString(),
      ...fields,
    };
    process.stdout.write(JSON.stringify(record) + '\n');
  },

  warn(msg: string, fields?: Record<string, unknown>): void {
    const record: LogRecord = {
      level: 'warn',
      msg,
      ts: new Date().toISOString(),
      ...fields,
    };
    process.stdout.write(JSON.stringify(record) + '\n');
  },

  error(msg: string, fields?: Record<string, unknown>): void {
    const record: LogRecord = {
      level: 'error',
      msg,
      ts: new Date().toISOString(),
      ...fields,
    };
    process.stdout.write(JSON.stringify(record) + '\n');
  },
};

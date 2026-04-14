// Non-action module: Env var parsing & validation for CHECK_INTERVAL_MS, RESEND_API_KEY, DB path.

export interface AppConfig {
  /** Polling interval in ms. Min 3_600_000 (1h). Default 21_600_000 (6h). */
  checkIntervalMs: number;
  /** Resend REST API key. Required for email notifications. */
  resendApiKey: string;
  /** Absolute path to SQLite DB file. Default: ./data/journal-tracker.db */
  dbPath: string;
  /** User-Agent string sent with all outbound HTTP requests. */
  userAgent: string;
}

/**
 * Non-action module: Env var parsing & validation.
 * Reads CHECK_INTERVAL_MS, RESEND_API_KEY, DB_PATH from process.env.
 * Throws if required vars are missing or values are out of range.
 */
export function loadConfig(): AppConfig {
  const DEFAULT_CHECK_INTERVAL_MS = 21_600_000; // 6 hours
  const MIN_CHECK_INTERVAL_MS = 3_600_000; // 1 hour
  const DEFAULT_DB_PATH = "./data/journal-tracker.db";
  const USER_AGENT = "academic-journal-tracker/1.0";

  // 1. Read and validate CHECK_INTERVAL_MS
  let checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  const checkIntervalEnv = process.env.CHECK_INTERVAL_MS;
  if (checkIntervalEnv !== undefined) {
    const parsed = parseInt(checkIntervalEnv, 10);
    if (isNaN(parsed)) {
      throw new Error(`CHECK_INTERVAL_MS must be a valid integer, got "${checkIntervalEnv}"`);
    }
    checkIntervalMs = Math.max(parsed, MIN_CHECK_INTERVAL_MS);
  }

  // 2. Read and validate RESEND_API_KEY
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey.trim() === "") {
    throw new Error("RESEND_API_KEY environment variable is required and must not be empty");
  }

  // 3. Read DB_PATH with default
  const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;

  // 4. Return AppConfig object
  return {
    checkIntervalMs,
    resendApiKey,
    dbPath,
    userAgent: USER_AGENT,
  };
}

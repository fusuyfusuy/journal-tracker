# Configuration

All runtime configuration is read from environment variables by `src/config.ts`. Invalid or missing required values abort startup with a structured log line.

## Environment variables

### `RESEND_API_KEY` (required)

Bearer token for the Resend REST API. Sent as `Authorization: Bearer <key>` on every email notification POST to `https://api.resend.com/emails`.

Startup will fail with `config.invalid: RESEND_API_KEY environment variable is required and must not be empty` if unset or empty.

> The key is required even when no email subscribers are configured, because config validation runs before subscriber enumeration. Use a dummy value (`RESEND_API_KEY=unused`) for webhook-only deployments.

### `CHECK_INTERVAL_MS` (optional)

Scheduler polling interval in milliseconds.

- **Default:** `21_600_000` (6 hours)
- **Minimum:** `3_600_000` (1 hour) — smaller values are silently clamped up. The floor exists to discourage aggressive polling of upstream sources; pick a higher value for production (6–12 h is polite per most publishers' terms).
- **Type error** (non-numeric): aborts with `CHECK_INTERVAL_MS must be a valid integer`.

### `DB_PATH` (optional)

Path to the SQLite database file.

- **Default:** `./data/journal-tracker.db`
- Any path `bun:sqlite` accepts works, including `:memory:` for ephemeral runs.
- The file and parent directory are created on first `initDb()` if missing.

## User-Agent

The HTTP `User-Agent` header sent with every outbound fetch (both fetchers and notifiers) is hard-coded as `academic-journal-tracker/1.0` in `config.ts`. Edit there if you need to identify your deployment to upstream publishers.

## Timeouts

Not env-configurable in v1 — edit the call sites:

- **Fetch:** 30 s — set via `AbortSignal.timeout(30_000)` inside each `Fetcher.fetch()` implementation.
- **Notify:** 15 s — set via `AbortSignal.timeout(15_000)` inside each `Notifier.dispatch()` implementation.

## Logging

No env knob — the logger always emits structured JSON to stdout, one record per line. Redirect to a file or pipe into `jq` / a log shipper as needed. Log levels are fixed at source (`log.info` / `log.warn` / `log.error` / `log.debug`); there is no filter.

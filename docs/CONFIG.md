# Configuration

Loaded via `@nestjs/config` + `registerAs('app', ...)` in `libs/shared/src/config/app.config.ts`. Retrieve anywhere via `config.getOrThrow<AppConfig>('app')`.

## Required

### `RESEND_API_KEY`
Bearer token for the Resend REST API. Startup aborts if unset or empty — this is checked eagerly in `appConfig()` so misconfiguration fails fast rather than on the first email dispatch.

Use a dummy value (`RESEND_API_KEY=unused`) for webhook-only deployments.

## Authentication

### `API_KEYS`
Comma-separated list of shared-secret API keys for machine-to-machine access. Each request to the REST API must supply one of these values in the `X-API-Key` header.

- Format: `API_KEYS=key1,key2,key3` (values are trimmed; empty entries ignored)
- If the resulting list is empty, all non-`@Public()` routes will reject requests with 401.

Example:
```bash
API_KEYS=sk-my-secret-key-1,sk-my-secret-key-2
```

## Optional

### `CHECK_INTERVAL_MS`
BullMQ repeatable job interval in milliseconds.
- Default: `21_600_000` (6 h)
- Floor: `3_600_000` (1 h) — smaller values are clamped
- Non-integer: abort with `CHECK_INTERVAL_MS must be an integer`

### `DB_PATH`
SQLite file path for TypeORM.
- Default: `./data/journal-tracker.db`
- Create the parent directory before first run, or TypeORM will error.

### `DB_SYNCHRONIZE`

When `true`, TypeORM will auto-sync the schema on boot (mirrors the old `synchronize: true` behaviour). **Never enable in production.**
- Default: `false`
- In-memory test databases set `synchronize: true` directly and are unaffected by this env var.

### `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
BullMQ connection.
- Defaults: `localhost:6379`, no password.

### `RESEND_FROM`
`from` address used in outgoing emails.
- Default: `notifications@example.com`. Override before sending real mail.

### `API_PORT`
HTTP port for `apps/api`.
- Default: `3000`.

## Queue retry configuration

Hard-coded per queue (see `libs/shared/src/types/queue.constants.ts`):

| Queue | Attempts | Backoff | Type |
|---|---|---|---|
| `cycle` | 3 | 30 s exponential | Per-cycle-run |
| `notify` | 5 | 10 s exponential | Per-notification delivery |

4xx HTTP errors from notifiers throw `UnrecoverableError` and are not retried.

## Timeouts (source-level, not env)

- Fetch: 30 s — `AbortSignal.timeout(30_000)` in each `Fetcher.fetch()`.
- Notify: 15 s — `AbortSignal.timeout(15_000)` in each `Notifier.dispatch()`.

## Logging

Structured JSON to stdout, one record per line (`libs/shared/src/logging/logger.service.ts`). No level filter — pipe to `jq`/`vector`/`promtail` and filter downstream.

## TypeORM / Migrations

`migrationsRun: true` is always set — pending migrations are applied on every boot. `synchronize` is driven by `DB_SYNCHRONIZE` (default `false`).

### Migration workflow

```bash
# Generate a new migration after changing entities (append a name):
bun run migration:generate libs/database/src/migrations/AddFooColumn

# Apply pending migrations manually (also runs automatically on boot):
bun run migration:run

# Revert the last applied migration:
bun run migration:revert
```

After generating a new migration, add the exported class to `libs/database/src/migrations/index.ts` so both `DatabaseModule` and the CLI `DataSource` pick it up — the `MIGRATIONS` array is the single source of truth.

The CLI DataSource file is `libs/database/src/data-source.ts`. It reads `DB_PATH` from the environment, so set that before running CLI commands against a non-default database file.

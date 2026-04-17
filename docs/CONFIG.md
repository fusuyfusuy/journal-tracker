# Configuration

Loaded via `@nestjs/config` + `registerAs('app', ...)` in `libs/shared/src/config/app.config.ts`. Retrieve anywhere via `config.getOrThrow<AppConfig>('app')`.

## Required

### `RESEND_API_KEY`
Bearer token for the Resend REST API. Startup aborts if unset or empty — this is checked eagerly in `appConfig()` so misconfiguration fails fast rather than on the first email dispatch.

Use a dummy value (`RESEND_API_KEY=unused`) for webhook-only deployments.

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

## TypeORM

`synchronize: true` in `DatabaseModule` — the schema is auto-created on boot. Fine for dev and integration tests; before production, generate migrations and set `synchronize: false`:

```bash
bunx typeorm migration:generate -d <data-source-file> <MigrationName>
```

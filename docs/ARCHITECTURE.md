# Architecture

NestJS monorepo. Two apps (`worker`, `api`) share two libraries (`database`, `shared`).

## Monorepo layout

```
apps/
  worker/
    src/
      fetchers/         FetchersModule + RSS/arXiv/stubs + resolver service
      notifiers/        NotifiersModule + email/webhook + resolver service
      cycle/
        cycle.service.ts        Orchestrates one check cycle
        cycle.processor.ts      BullMQ @Processor('cycle')
        scheduler.bootstrap.ts  Registers the repeatable job on boot
      app.module.ts     Wires Config, DB, BullMQ root, CycleModule
      main.ts           Headless bootstrap (--once for one-shot)
  api/
    src/
      journals/         CRUD
      subscribers/      CRUD (destination validated per channel)
      cycles/           Trigger + status endpoints (no DB entity)
      health/           Liveness + readiness endpoints (TerminusModule)
      app.module.ts     HTTP bootstrap
      main.ts           NestFactory.create + listen
libs/
  database/
    src/entities/       Journal, Article, Subscriber (@Entity)
    src/database.module.ts  TypeOrmModule.forRootAsync
  shared/
    src/config/         appConfig (@nestjs/config registerAs)
    src/logging/        StructuredLogger + LoggingModule (global)
    src/types/          Fetcher, Notifier, FetchResult, NotificationEvent, CycleSummary
```

## Data model

Same shape as the pre-Nest implementation, now expressed as TypeORM entities with `synchronize: true` (dev-friendly; swap to migrations before production).

| Table | Key fields |
|---|---|
| `journals` | `id`, `name`, `fetcher_type`, `feed_url`, `active`, `created_at` |
| `articles` | `id`, `journal_id`, `title`, `url`, `doi`, `published_at`, `dedupe_key UNIQUE`, `created_at` |
| `subscribers` | `id`, `channel_type`, `destination`, `active`, `created_at` |

`dedupe_key` = DOI when present, else URL. `UNIQUE` constraint is the dedup primitive.

## The check cycle (BullMQ-driven)

Two queues are involved: `cycle` (orchestration) and `notify` (per-subscriber delivery).

### Queue retry configuration

| Queue | Attempts | Backoff |
|---|---|---|
| `cycle` | 3 | exponential, 30s base |
| `notify` | 5 | exponential, 10s base |

4xx delivery errors throw `UnrecoverableError` in `NotifyProcessor` — BullMQ moves the job straight to failed without retrying.

### Flow

1. **Worker boot** → `SchedulerBootstrap.onApplicationBootstrap()` adds a repeatable job (`jobId: 'cycle-repeat'`) to the `cycle` queue with `repeat.every = CHECK_INTERVAL_MS`. Stable `jobId` means restarts don't create duplicates.
2. **BullMQ fires the cycle job** every interval (or on-demand via `POST /cycles`). Job options: `attempts: 3, backoff: exponential 30s`.
3. **`CycleProcessor.process(job)`** invokes `CycleService.run()`.
4. **`CycleService.run()`** for each active journal:
   - `FetchersService.resolve(journal.fetcher_type).fetch(journal, config)` with 30s abort.
   - On `error !== null`: log and continue — **per-journal fault isolation**.
   - For each normalized article:
     - Check `articles WHERE dedupe_key = ?`; skip if present.
     - `articleRepo.save(...)` new row.
     - For each active subscriber: enqueue a `deliver` job on the `notify` queue with the serialized article and subscriber as payload. The cycle does **not** wait for delivery — it is fire-and-forget at this layer.
   - Emit `journal.processed` structured log.
5. Return a `CycleSummary` which BullMQ stores as the cycle job's return value (accessible via `GET /cycles/:id`).
6. **`NotifyProcessor.process(job)`** (separate worker consumer on the `notify` queue):
   - Deserializes article and subscriber from the job payload (Date fields revived from ISO strings).
   - Resolves the notifier via `NotifiersService.resolve(subscriber.channel_type)` and calls `dispatch(...)`.
   - On `event.status === 'ok'`: logs `deliver.ok` and returns the event.
   - On `event.status === 'error'` with a 4xx `event.error.status`: throws `UnrecoverableError` (no retry — invalid destination).
   - On other errors: throws a regular `Error` so BullMQ retries with exponential backoff (up to 5 attempts, 10s base).

## Dependency injection of fetchers/notifiers

Rather than a hand-rolled `switch (type)`, each fetcher is a `@Injectable()` implementing `Fetcher` with a `readonly type` discriminator. `FetchersModule` collects them into an array and provides it under `FETCHER_TOKEN`:

```ts
{
  provide: FETCHER_TOKEN,
  useFactory: (rss, arxiv, cr, pm, html) => [rss, arxiv, cr, pm, html],
  inject: [RssFetcher, ArxivFetcher, CrossrefFetcher, PubmedFetcher, HtmlFetcher],
}
```

`FetchersService` receives the array, indexes it by `type`, and exposes `resolve(type)`. Same pattern for notifiers. Adding a new source = one file + one line in the factory (see `docs/EXTENDING.md`).

## Fault isolation

Same guarantees as the original design, enforced at service boundaries:

- **Fetcher throws** → `CycleService.processJournal` catches, logs `fetch.error`, increments `errors`, continues.
- **Fetcher returns `{error: non-null}`** → logs `fetch.failed`, same continue path.
- **DB throws during dedupe or insert** → `CycleService.processArticle` returns `'error'`, increments `errors`, moves on.
- **Notify enqueue** → `CycleService` enqueues the job and moves on. Delivery failures are isolated to the `notify` queue and handled by `NotifyProcessor` with BullMQ retries.
- **Notifier 5xx / timeout** → `NotifyProcessor` throws a regular Error; BullMQ retries up to 5 times with exponential backoff.
- **Notifier 4xx** → `NotifyProcessor` throws `UnrecoverableError`; BullMQ immediately moves the job to failed (no retry — invalid destination).
- **Timeouts** use `AbortSignal.timeout()` inside each fetcher/notifier — the thrown `TimeoutError` propagates and triggers a BullMQ retry.

## Processes

- **Worker**: no HTTP listener. Opens the DB, connects to Redis, registers the repeatable job, consumes jobs from the `cycle` queue until SIGINT/SIGTERM.
- **API**: HTTP listener on `API_PORT`. Opens the DB (read+write for CRUD), connects to Redis (produce-only for `/cycles`).
- The worker and API can run on different machines; the DB + Redis are the only shared state.

## External dependencies

- **`@nestjs/typeorm` + `typeorm` + `better-sqlite3`** — DI-aware DataSource + sync schema for dev.
- **`@nestjs/bullmq` + `bullmq` + `ioredis`** — queue, repeatable scheduler, job status.
- **`@nestjs/config`** — env loading + `registerAs('app')` namespace.
- **`fast-xml-parser`** — RSS 2.0 + Atom.
- **`class-validator` + `class-transformer`** — DTO validation in the API.

## Not included in v2

Tracked as GitHub issues:

- [#1](https://github.com/fusuyfusuy/journal-tracker/issues/1) **Migrations**: `synchronize: true` is fine for dev; switch to `typeorm migration:generate` before production.
- [#2](https://github.com/fusuyfusuy/journal-tracker/issues/2) **Auth on the API**: `/journals`, `/subscribers`, `/cycles` are open. Put an auth guard in before exposing publicly.
- [#3](https://github.com/fusuyfusuy/journal-tracker/issues/3) **Retry queue for failed notifications**: ✅ Implemented — `notify` queue with 5 attempts, exponential backoff, `UnrecoverableError` for 4xx.
- [#4](https://github.com/fusuyfusuy/journal-tracker/issues/4) **Containerization**: Dockerfile + docker-compose for worker/api/redis.
- [#5](https://github.com/fusuyfusuy/journal-tracker/issues/5) **Observability**: Prometheus metrics and OpenTelemetry tracing remain open. `/health` and `/ready` endpoints are now implemented (partial #5).

## Health endpoints

`GET /health` — liveness. Always returns `{ status: 'ok', uptime: <seconds> }` without performing any I/O. Safe to use as a Kubernetes liveness probe.

`GET /ready` — readiness. Composed via `@nestjs/terminus` `HealthCheckService`:

- **`db`** — `TypeOrmHealthIndicator.pingCheck('db')` executes `SELECT 1` against the SQLite DataSource.
- **`redis`** — `RedisHealthIndicator` opens a temporary `ioredis` connection, calls `PING`, and closes it.

Returns `200 { status: 'ok', ... }` when both checks pass; `503` with the failing indicator details otherwise. See [`docs/OBSERVABILITY.md`](./OBSERVABILITY.md) for response shapes.

Still out of scope per original [`.mcd/requirements.md`](../.mcd/requirements.md):

- **Functional Crossref / PubMed / HTML fetchers**: interfaces + stubs only.
- **Per-subscriber journal filtering, digest batching**: global fan-out, per-article notifications.

## Tests

See [`docs/TESTING.md`](./TESTING.md) for the full test layout. Highlights that verify the statechart guarantees:

- `apps/worker/src/cycle/cycle.service.spec.ts` exercises per-journal fault isolation, DOI-preferred dedupe, and notifier-exception continuation against an in-memory TypeORM DB.
- Each fetcher/notifier has a `.spec.ts` asserting the "return an error result, don't throw" contract that keeps the cycle loop running.

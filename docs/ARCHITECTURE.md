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

1. **Worker boot** → `SchedulerBootstrap.onApplicationBootstrap()` adds a repeatable job (`jobId: 'cycle-repeat'`) to the `cycle` queue with `repeat.every = CHECK_INTERVAL_MS`. Stable `jobId` means restarts don't create duplicates.
2. **BullMQ fires the job** every interval (or on-demand via `POST /cycles`).
3. **`CycleProcessor.process(job)`** invokes `CycleService.run()`.
4. **`CycleService.run()`** for each active journal:
   - `FetchersService.resolve(journal.fetcher_type).fetch(journal, config)` with 30s abort.
   - On `error !== null`: log and continue — **per-journal fault isolation**.
   - For each normalized article:
     - Check `articles WHERE dedupe_key = ?`; skip if present.
     - `articleRepo.save(...)` new row.
     - For each active subscriber: `NotifiersService.resolve(subscriber.channel_type).dispatch(article, subscriber, config)` with 15s abort. Failures logged but don't abort the cycle.
   - Emit `journal.processed` structured log.
5. Return a `CycleSummary` which BullMQ stores as the job's return value (accessible via `GET /cycles/:id`).

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
- **Notifier throws** → `CycleService.processArticle` catches, logs `deliver.exception`, continues to next subscriber.
- **Timeouts** use `AbortSignal.timeout()` inside each fetcher/notifier — the thrown `TimeoutError` is caught by the try/catch above.

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

- **Migrations**: `synchronize: true` is fine for dev; switch to `typeorm migration:generate` before production.
- **Functional Crossref / PubMed / HTML fetchers**: interfaces + stubs only, as with v1.
- **Auth on the API**: `/journals`, `/subscribers`, `/cycles` are open. Put an auth guard in before exposing publicly.
- **Retry queue for failed notifications**: BullMQ supports per-job retries; not configured yet.
- **Per-subscriber journal filtering, digest batching**: still out of scope per original requirements.

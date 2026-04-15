# academic-journal-tracker

A **NestJS monorepo** that polls academic journal sources on a BullMQ schedule, deduplicates new articles, and fans notifications out to email or webhook subscribers.

- Runtime: **Bun** (Node-compatible)
- ORM: **TypeORM** on `better-sqlite3`
- Queue: **BullMQ** on Redis (repeatable jobs)
- HTTP: **NestJS + Express**

Originally generated via [MCD-Flow](./.mcd/) — see [`.mcd/requirements.md`](./.mcd/requirements.md), [`.mcd/manifest.json`](./.mcd/manifest.json), and [`.mcd/statechart.mmd`](./.mcd/statechart.mmd) for the original spec.

## Workspace layout

```
apps/
  worker/                  # BullMQ processor + scheduler bootstrap
  api/                     # REST: journals, subscribers, cycle triggers
libs/
  database/                # TypeORM entities + DatabaseModule
  shared/                  # Config, logger, Fetcher/Notifier interfaces, DTOs
```

Path aliases: `@journal/database`, `@journal/shared`.

## Quickstart

```bash
bun install
cp .env.example .env           # fill in RESEND_API_KEY at minimum
# start Redis somewhere (docker run -p 6379:6379 redis:7)
bun run start:worker:dev       # boots the worker, registers repeatable job
bun run start:api:dev          # boots the REST API on API_PORT (default 3000)
```

Trigger a one-off cycle from the API:
```bash
curl -X POST http://localhost:3000/cycles
```

## Scripts

| Command | What it does |
|---|---|
| `bun run start:worker` | Run the BullMQ worker + scheduler |
| `bun run start:api` | Run the REST API |
| `bun run start:worker:dev` | Worker with `--watch` |
| `bun run start:api:dev` | API with `--watch` |
| `bun run build` | Build both apps to `dist/` |
| `bun run typecheck` | `tsc --noEmit` across the monorepo |

## Configuration

See [`docs/CONFIG.md`](./docs/CONFIG.md) for the full env var reference.

Minimum:
- `RESEND_API_KEY` — required for email notifications (required for startup even if you use webhooks only).
- `REDIS_HOST`, `REDIS_PORT` — defaults `localhost:6379`.
- `DB_PATH` — default `./data/journal-tracker.db`.

## REST endpoints (`apps/api`)

| Method | Path | Body | Purpose |
|---|---|---|---|
| GET | `/journals` | — | list all journals |
| POST | `/journals` | `{ name, fetcher_type, feed_url, active? }` | create |
| GET | `/journals/:id` | — | fetch one |
| PATCH | `/journals/:id` | partial | update |
| DELETE | `/journals/:id` | — | delete |
| GET | `/subscribers` | — | list |
| POST | `/subscribers` | `{ channel_type, destination, active? }` | create (destination validated per channel) |
| PATCH/DELETE | `/subscribers/:id` | — | update / delete |
| POST | `/cycles` | — | enqueue a one-off cycle job |
| GET | `/cycles` | — | queue counts |
| GET | `/cycles/:id` | — | job state + return value |
| GET | `/health` | — | liveness — always 200 `{ status, uptime }` |
| GET | `/ready` | — | readiness — 200 ok / 503 when DB or Redis is down |

## Testing

44 tests across 11 suites — unit, integration (in-memory TypeORM), and e2e (supertest).

```bash
bun run test              # once
bun run test:watch        # watch mode
```

Layout:
- `apps/**/src/**/*.spec.ts` — unit tests co-located with the code
- `apps/worker/src/cycle/cycle.service.spec.ts` — integration against in-memory `better-sqlite3` with mocked fetchers/notifiers
- `apps/api/test/api.e2e-spec.ts` — HTTP-level e2e with `supertest`

Cycle tests exercise the statechart guarantees that came from the original MCD-Flow spec: per-journal fault isolation, DOI-preferred deduplication, notifier-exception continuation.

## Roadmap before production

Tracked as issues:
- [#1](https://github.com/fusuyfusuy/journal-tracker/issues/1) — TypeORM migrations (replace `synchronize: true`)
- [#2](https://github.com/fusuyfusuy/journal-tracker/issues/2) — API authentication + rate limiting
- [#3](https://github.com/fusuyfusuy/journal-tracker/issues/3) — BullMQ retry + per-notification queue
- [#4](https://github.com/fusuyfusuy/journal-tracker/issues/4) — Dockerfile + docker-compose
- [#5](https://github.com/fusuyfusuy/journal-tracker/issues/5) — Observability (metrics, tracing, health)

## Project history

- **v0.2.0** (current) — NestJS monorepo, TypeORM + better-sqlite3, BullMQ scheduler.
- **v0.1.0** — original single-package Bun + `bun:sqlite` + interval-loop scheduler. Archived at tag [`v0.1.0-bun`](https://github.com/fusuyfusuy/journal-tracker/tree/v0.1.0-bun). Generated via MCD-Flow.

## Further reading

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — modules, data flow, BullMQ integration
- [`docs/CONFIG.md`](./docs/CONFIG.md) — env vars
- [`docs/EXTENDING.md`](./docs/EXTENDING.md) — add a new fetcher/notifier/app
- [`docs/TESTING.md`](./docs/TESTING.md) — test layout, patterns, how to add a new test
- [`.mcd/`](./.mcd/) — original MCD-Flow spec. Cycle semantics still match; file paths reference the v0.1.0 layout — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the current module map.

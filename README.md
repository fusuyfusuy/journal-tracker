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

## Further reading

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — modules, data flow, BullMQ integration
- [`docs/CONFIG.md`](./docs/CONFIG.md) — env vars
- [`docs/EXTENDING.md`](./docs/EXTENDING.md) — add a new fetcher/notifier/app
- [`.mcd/`](./.mcd/) — original MCD-Flow spec (still describes cycle semantics faithfully)

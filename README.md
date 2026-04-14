# academic-journal-tracker

A Bun + TypeScript service that polls academic journal sources on a schedule, deduplicates new articles, and fans notifications out to email or webhook subscribers.

Generated via [MCD-Flow](https://github.com/) — specification lives in [`.mcd/`](./.mcd/), architecture overview in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Quickstart

```bash
bun install
export RESEND_API_KEY=re_xxx          # required
bun run seed                          # insert example journals & subscribers
bun run once                          # one-shot check cycle (good for cron)
bun run start                         # long-running scheduler loop
```

The DB lives at `./data/journal-tracker.db` by default; override with `DB_PATH`.

## Features

- **Multiple fetchers** behind one interface — RSS (functional) and arXiv Atom (functional); Crossref / PubMed / HTML are reserved stubs.
- **Multiple notifiers** — Resend email (raw REST, no SDK) and generic HTTP webhook (POST JSON).
- **Deduplication** by DOI when present, else URL (SQLite `UNIQUE` constraint).
- **Per-journal fault isolation** — one failing feed does not abort the cycle.
- **Single-flight scheduler** — skips ticks while a prior cycle is still running; SIGINT/SIGTERM wait for the in-flight cycle to finish.
- **Structured JSON logging** — one event per line to stdout.

## Scripts

| Command | What it does |
|---|---|
| `bun run start` | Long-running scheduler (polls every `CHECK_INTERVAL_MS`) |
| `bun run once` | Run a single check cycle, then exit (cron-friendly) |
| `bun run seed` | Insert example journals + subscribers into the DB |
| `bun run typecheck` | `tsc --noEmit` across the project |
| `bun test` | Run the full test suite |

## Configuration

All config is env-driven. See [`docs/CONFIG.md`](./docs/CONFIG.md) for the full list.

| Var | Required | Default | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | yes | — | Bearer token for the Resend REST API |
| `CHECK_INTERVAL_MS` | no | `21_600_000` (6h) | Hard floor of 1h; smaller values are clamped |
| `DB_PATH` | no | `./data/journal-tracker.db` | SQLite file path |

## Project layout

```
src/
  types/            Zod schemas for entities + events
  db.ts             bun:sqlite init + CRUD
  fetchers/         Fetcher interface + RSS / arXiv / stub impls
  notifiers/        Notifier interface + email (Resend) / webhook
  cycle.ts          Per-check-cycle orchestrator (statechart actions)
  scheduler.ts      Interval loop + single-flight + signal handling
  config.ts         Env var parsing
  log.ts            Structured JSON logger
  index.ts          CLI entrypoint
  seed.ts           Example data seeder
tests/              bun:test oracle tests mirroring src/
.mcd/               MCD-Flow spec (requirements, manifest, statechart)
docs/               Hand-written docs
```

## Further reading

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — components, check-cycle statechart, data flow
- [`docs/CONFIG.md`](./docs/CONFIG.md) — env vars and tuning
- [`docs/EXTENDING.md`](./docs/EXTENDING.md) — add a new fetcher or notifier
- [`.mcd/requirements.md`](./.mcd/requirements.md) — original actors / flows / constraints
- [`.mcd/statechart.mmd`](./.mcd/statechart.mmd) — Mermaid diagram of the check cycle

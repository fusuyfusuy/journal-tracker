# Architecture

## Components

| Component | File(s) | Role |
|---|---|---|
| **Scheduler** | `src/scheduler.ts` | Fires a check cycle on an interval. Single-flight (skips overlapping ticks). Handles SIGINT/SIGTERM. |
| **Cycle orchestrator** | `src/cycle.ts` | Runs one full check cycle. Implements 17 of the 19 statechart action functions. |
| **Fetchers** | `src/fetchers/` | One module per source type. All implement the `Fetcher` interface and return a normalized `FetchResult`. |
| **Notifiers** | `src/notifiers/` | One module per channel. All implement the `Notifier` interface and return a `NotificationEvent`. |
| **Storage** | `src/db.ts` | `bun:sqlite` DB init + CRUD for journals, articles, subscribers. |
| **Logger** | `src/log.ts` | Structured JSON logger — one event per line on stdout. |
| **Config** | `src/config.ts` | Env-driven `AppConfig` loader with validation. |

## Data model (SQLite)

```
journals(id, name, fetcher_type, feed_url, active, created_at)
articles(id, journal_id, title, url, doi, published_at, dedupe_key UNIQUE, created_at)
subscribers(id, channel_type, destination, active, created_at)
```

`dedupe_key` = DOI when present, else URL. The `UNIQUE` constraint is the dedup primitive — `articleExistsByDedupeKey` is just `SELECT 1`.

## The check cycle

Full diagram: [`.mcd/statechart.mmd`](../.mcd/statechart.mmd). Plain-English flow:

1. `loadActiveJournals(db)` — load all `journals WHERE active = 1`.
2. For each journal:
   1. `fetchJournalArticles(journal, config)` — dispatches to the fetcher matching `fetcher_type` with a 30 s timeout. On HTTP error / timeout / parse failure, returns a `FetchResult` whose `error` field is non-null.
   2. `normalizeArticles(result)` — validates each raw item against `NormalizedArticleSchema`; invalid items are logged and skipped.
   3. For each normalized article:
      1. `dedupeArticle(db, article)` — returns `true` if the dedupe key already exists.
      2. If new: `persistArticle(db, article, journalId)` inserts the row; then `loadSubscribers(db)` + `dispatchNotification(article, subscriber, config)` fans out to every active subscriber with a 15 s timeout per channel.
      3. If existing: `skipArticle(article)` logs and continues.
   4. `logJournalResult(...)` — emits `{journal_id, new, skipped, errors}`.
3. `logCycleSummary(...)` — emits totals for the cycle.

## Fault isolation

Every transition has an explicit error edge that routes back into the iteration loop, so one failing journal / subscriber never aborts the cycle:

- Fetch failure → `handleFetchError` → `nextJournal`
- DB failure → `handleDbError` → `nextArticle`
- Notify failure → `handleNotifyError` → next subscriber
- Timeout (fetch or notify) → `handleTimeout` → same continue-path as the corresponding error

Error-path outcomes are logged via the structured logger and counted in the cycle summary.

## External dependencies

- **`zod`** — runtime validation at boundaries (DB read/write, fetcher output, env config).
- **`fast-xml-parser`** — RSS 2.0 and Atom parsing.
- **`bun:sqlite`** — built into Bun, no driver dependency.
- **Resend** — used via raw `fetch` to `https://api.resend.com/emails`, no SDK.

## Not included in v1

Per [`.mcd/requirements.md`](../.mcd/requirements.md) ("Out of Scope"): per-subscriber journal filtering, digest-style batching, a retry queue for failed notifications, a subscriber/journal management CLI, and functional Crossref / PubMed / HTML fetchers (interfaces and stubs only).

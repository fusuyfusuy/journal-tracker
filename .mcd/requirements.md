# Requirements: academic-journal-tracker

A Bun + TypeScript service that periodically polls academic journal sources (RSS, arXiv, Crossref, PubMed, HTML), deduplicates articles in SQLite, and dispatches notifications about new articles to subscribers over email and webhook channels.

## Actors

- **Operator (Admin / CLI user)** — Human running the process. Can start the scheduler loop, trigger a one-shot check, and (via direct DB access or seed scripts) add/remove journals and subscribers. Owns configuration (poll interval, API keys, secrets).
- **Scheduler** — Internal cron-like process inside the service. Fires at a configurable interval (default 6h) and initiates a check cycle over all active journals.
- **Fetcher (per source type)** — Pluggable adapter (RSS, arXiv, Crossref, PubMed, HTML). Given a journal record, returns a list of `Article` objects from the upstream source. Must implement a common interface.
- **Notifier (per channel type)** — Pluggable adapter (email via Resend, generic HTTP webhook for Discord/Slack/Telegram). Given an article and a subscriber destination, delivers a notification.
- **Subscriber** — External recipient of notifications. Passive: identified by `(channel_type, destination, active)`. Does not interact with the system directly in v1 (no self-service signup).
- **Upstream Journal Source** — Third-party system (arXiv API, RSS endpoint, etc.). Can rate-limit, return errors, time out, or change schema.

## Core Flows

### Flow 1: Scheduled Check Cycle (primary loop)
1. Scheduler fires on interval tick (or Operator invokes one-shot via CLI).
2. System loads all journals where `active = true` from SQLite.
3. For each journal (sequentially, with per-journal try/catch):
   1. Resolve fetcher implementation by `journal.fetcher_type`.
   2. Fetcher pulls articles from upstream source, applying polite rate limiting.
   3. System normalizes results to the `Article` interface (title, url, doi, published_at, journal_id).
   4. For each article, compute dedupe key (DOI if present, else URL).
   5. Query `articles` table for existing row with that key.
   6. If not found: insert article row, then enqueue notification dispatch (Flow 2) for this article.
   7. If found: skip (already seen).
4. System emits structured log line summarizing per-journal result: `{journal, fetched, new, errors}`.
5. Cycle completes; Scheduler sleeps until next tick.

### Flow 2: Notification Dispatch (per new article)
1. System loads all subscribers where `active = true`.
2. For each subscriber:
   1. Resolve notifier by `subscriber.channel_type` (email | webhook).
   2. Notifier renders payload (email body / JSON webhook body) from the article.
   3. Notifier delivers to `subscriber.destination`.
   4. On success: log `{article_id, subscriber_id, channel, status: ok}`.
   5. On failure: log error, continue to next subscriber (do not retry in v1, do not abort cycle).

### Flow 3: One-Shot CLI Run
1. Operator runs `bun run src/index.ts --once` (or equivalent flag).
2. System runs exactly one iteration of Flow 1, then exits with code 0 (or non-zero if a fatal init error occurred — DB unreachable, required env missing).

### Flow 4: Long-Running Scheduler Mode
1. Operator runs `bun run src/index.ts` (no `--once`).
2. System initializes DB, validates config, runs Flow 1 immediately, then enters interval loop.
3. Loop continues until SIGINT/SIGTERM; on signal, system finishes the in-flight cycle (best-effort), closes DB, and exits cleanly.

### Flow 5: Data Seeding (out-of-band)
1. Operator inserts rows into `journals` and `subscribers` via a seed script or direct SQL.
2. Next scheduled cycle picks up the new rows automatically (no restart required — rows are re-queried each cycle).

## Business Constraints

### Data rules
- `articles.dedupe_key` (DOI if present, otherwise URL) MUST be unique. Duplicate inserts are rejected at the SQL layer.
- `journals.fetcher_type` MUST be one of a known set: `rss`, `arxiv`, `crossref`, `pubmed`, `html` (v1 ships `rss` and `arxiv` stub only; others reserved).
- `subscribers.channel_type` MUST be one of: `email`, `webhook`.
- `subscribers.destination` MUST be a syntactically valid email (for `email`) or `https?://` URL (for `webhook`).
- `articles.published_at` is stored as ISO-8601 UTC string; if upstream omits it, fall back to fetch time.
- `journals.feed_url` MUST be non-empty.

### Authorization rules
- v1 has no multi-tenant auth. The Operator has full local access via the filesystem and SQLite file. Secrets (Resend API key, etc.) come from env vars only, never from the DB.

### Ordering rules
- Article MUST be persisted to `articles` BEFORE notification dispatch begins. This guarantees that a crash mid-dispatch does not cause re-notification on next cycle (at-most-once notification per article in v1).
- Scheduler MUST NOT start a new cycle while the previous cycle is still running (single-flight). If a cycle overruns the interval, the next tick is skipped and logged.

### Operational rules
- Default interval is 6 hours; configurable via env var `CHECK_INTERVAL_MS` (minimum enforced: 1 hour to respect polite polling). Override below the minimum is refused at startup.
- Each fetcher MUST set a descriptive `User-Agent` on HTTP requests.
- One failing journal MUST NOT prevent other journals in the same cycle from being processed.
- One failing subscriber MUST NOT prevent other subscribers from being notified for the same article.

## Error Conditions

### Flow 1 (Scheduled Check Cycle) Errors
| Condition | Trigger | Recovery |
|-----------|---------|----------|
| DB unreachable at startup | SQLite file cannot be opened/created | ABORT (exit non-zero) |
| DB error mid-cycle | Query/insert fails on a single journal | RETRY on next cycle (log, continue with next journal) |
| Fetcher HTTP error | Upstream returns 5xx / network timeout | RETRY on next cycle (log, skip this journal) |
| Fetcher rate-limited | Upstream returns 429 | RETRY on next cycle (log with backoff hint; no in-cycle retry in v1) |
| Fetcher parse error | Malformed RSS/JSON from upstream | RETRY on next cycle (log, skip this journal) |
| Unknown fetcher_type | Journal row has unsupported type | RETRY on next cycle (log; row stays; operator must fix) |
| Duplicate insert race | Two cycles detect same new article concurrently | ABORT insert for second (UNIQUE constraint); no notification for second |
| Cycle overrun | Previous cycle still running when tick fires | SKIP this tick (log) |

### Flow 2 (Notification Dispatch) Errors
| Condition | Trigger | Recovery |
|-----------|---------|----------|
| Email provider error | Resend returns non-2xx | ABORT for this subscriber (log, continue to next subscriber; no retry in v1) |
| Webhook delivery error | Target URL 4xx/5xx/timeout | ABORT for this subscriber (log, continue) |
| Missing API key | `RESEND_API_KEY` unset but email subscribers exist | ABORT dispatch per-subscriber (log loud warning once per cycle) |
| Invalid destination | Destination fails syntactic check | ABORT for this subscriber (log) |

### Flow 3 / 4 (CLI) Errors
| Condition | Trigger | Recovery |
|-----------|---------|----------|
| Missing required env | DB path unresolvable | ABORT at startup |
| Invalid interval | `CHECK_INTERVAL_MS` < 1h or NaN | ABORT at startup |
| SIGINT mid-cycle | Operator Ctrl-C | Finish in-flight dispatch, close DB, exit 0 |

## Out of Scope (v1)

- **Self-service subscriber signup / web UI.** Subscribers are inserted by the Operator.
- **Authentication, multi-tenancy, per-user journal lists.** Single global set of journals and subscribers.
- **Per-subscriber journal filtering.** All active subscribers receive notifications for all new articles. (Excluded interpretation: "subscribers choose which journals to follow" — deferred.)
- **Notification retry / dead-letter queue.** Failed notifications are logged and dropped.
- **Digest / batching.** Each new article fires an individual notification. (Excluded interpretation: "daily digest email" — deferred.)
- **Crossref, PubMed, and generic HTML fetchers.** Interface must accommodate them; implementations are stubs or deferred.
- **robots.txt parsing.** Politeness is via fixed minimum interval and `User-Agent`, not live robots.txt checks.
- **In-cycle retries / exponential backoff.** A failing fetch waits for the next scheduled cycle.
- **Metrics / tracing export.** Only structured stdout logging in v1.
- **Migrations framework.** Schema is created via `CREATE TABLE IF NOT EXISTS` on startup; no versioned migrations.
- **Full-text article content ingestion.** Only metadata (title, url, doi, published_at) is stored.
- **Admin CLI for managing journals/subscribers.** Operator uses seed script or raw SQL.

## Assumptions (pending user confirmation)

The following defaults were applied where the prompt was ambiguous. See "Ambiguities" in the Phase 0 summary for the questions; these are the chosen defaults the Architect will build against:

1. **Email provider:** Resend (prompt lists "Resend or SendGrid"; Resend chosen — simpler API, single provider in v1).
2. **Per-subscriber journal filtering:** Not supported. All active subscribers get all new articles.
3. **Notification granularity:** One notification per new article (no digest).
4. **Retry policy:** No in-cycle retries; failures wait for next cycle.
5. **Fetcher coverage in v1:** RSS (full) + arXiv (stub returning empty or minimal implementation). Crossref, PubMed, HTML: interface only.
6. **Dedupe key precedence:** DOI when present, else canonical URL.
7. **Minimum poll interval:** 1 hour enforced at startup (prompt says 6–12h is polite; we hard-floor at 1h to allow testing while discouraging abuse).
8. **CLI surface:** `--once` flag for one-shot; bare invocation starts the interval loop. No sub-commands for CRUD.
9. **Logging:** Structured JSON to stdout (one line per event). No log levels filtering in v1 beyond info/warn/error.
10. **Signal handling:** SIGINT/SIGTERM allows in-flight cycle to complete best-effort before exit.

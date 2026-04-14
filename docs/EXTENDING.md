# Extending

How to add a new fetcher or notifier without breaking the statechart.

## Add a new fetcher

A fetcher pulls articles from one source type (RSS, arXiv, Crossref, etc.). The interface is in `src/fetchers/index.ts`:

```ts
export interface Fetcher {
  fetch(journal: Journal, config: AppConfig): Promise<FetchResult>;
}
```

### Steps

1. **Add the source to the `FetcherType` enum** in `src/types/entities.ts`:
   ```ts
   export const FetcherTypeSchema = z.enum([
     'rss', 'arxiv', 'crossref', 'pubmed', 'html',
     'biorxiv', // ← new
   ]);
   ```

2. **Create `src/fetchers/biorxiv.ts`** implementing `Fetcher`. Model it on `src/fetchers/rss.ts`. Required behavior:
   - Use `fetch()` with `AbortSignal.timeout(30_000)`.
   - Set `User-Agent: config.userAgent` on the request.
   - Return a `FetchResult` on both success and failure — **do not throw**. Error is communicated via the `error` field (see `src/types/events.ts` for `FetchError` kinds).
   - Every returned article must conform to `NormalizedArticleSchema`. Normalization is the fetcher's job.

3. **Wire it into `resolveFetcher()`** in `src/fetchers/index.ts`:
   ```ts
   case 'biorxiv': return new BiorxivFetcher();
   ```

4. **Add an oracle test** at `tests/fetchers/biorxiv.test.ts`. At minimum: one happy-path test mocking `globalThis.fetch` with a sample response, and one negative-case test asserting the error path (non-2xx, network error, or malformed body).

That's it. No changes to `cycle.ts`, the statechart, or the manifest — `fetchJournalArticles` already dispatches polymorphically through `resolveFetcher`.

## Add a new notifier

Same pattern for a new delivery channel. Interface in `src/notifiers/index.ts`:

```ts
export interface Notifier {
  dispatch(article: Article, subscriber: Subscriber, config: AppConfig): Promise<NotificationEvent>;
}
```

### Steps

1. **Add the channel to `ChannelType`** in `src/types/entities.ts`:
   ```ts
   export const ChannelTypeSchema = z.enum(['email', 'webhook', 'slack']);
   ```
   If the channel has a distinct destination format (like `slack://…` or a channel ID), extend the destination-matches-channel `.refine(...)` check on `SubscriberSchema` / `SubscriberInsertSchema`.

2. **Create `src/notifiers/slack.ts`**. Model on `src/notifiers/webhook.ts`. Required behavior:
   - Use `fetch()` with `AbortSignal.timeout(15_000)`.
   - Return a `NotificationEvent` on success or failure — do not throw; the orchestrator treats an unhandled throw as a timeout/unknown error.

3. **Wire it into `resolveNotifier()`** in `src/notifiers/index.ts`.

4. **Add `tests/notifiers/slack.test.ts`** with a 2xx happy path and a non-2xx negative.

## Changing the check cycle itself

If you need to change *how* the cycle runs — e.g. parallel-per-journal fetching, batched notifications, a retry queue — that's a statechart change, not an extension. Do it through MCD-Flow:

1. `/mcd-import` to bring the current codebase into the manifest.
2. `/mcd "<your feature>"` in diff mode — it extends the statechart additively, keeps existing transitions stable, and regenerates only the affected files.

Hand-editing `cycle.ts` without touching `.mcd/manifest.json` + `.mcd/statechart.mmd` will drift the spec from the code.

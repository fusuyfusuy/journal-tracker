# Extending

## Add a new fetcher

1. **Create** `apps/worker/src/fetchers/biorxiv.fetcher.ts`:

   ```ts
   @Injectable()
   export class BiorxivFetcher implements Fetcher {
     readonly type = 'biorxiv' as const;
     async fetch(journal: Journal, config: AppConfig): Promise<FetchResult> {
       // use fetch() with AbortSignal.timeout(30_000), set User-Agent to config.userAgent
       // return { journal_id, articles, fetched_at, error: null | FetchError } — do NOT throw
     }
   }
   ```

2. **Register** in `apps/worker/src/fetchers/fetchers.module.ts`:

   ```ts
   providers: [
     RssFetcher, ArxivFetcher, ..., BiorxivFetcher,
     {
       provide: FETCHER_TOKEN,
       useFactory: (rss, arxiv, cr, pm, html, biorxiv) => [rss, arxiv, cr, pm, html, biorxiv],
       inject: [RssFetcher, ArxivFetcher, CrossrefFetcher, PubmedFetcher, HtmlFetcher, BiorxivFetcher],
     },
     ...
   ]
   ```

3. **Extend** the `FetcherType` union in `libs/shared/src/types/fetcher.interface.ts` and the `IsIn` list in `apps/api/src/journals/journals.dto.ts`. Also update the `fetcher_type` column type on the `Journal` entity.

4. **Test** (`apps/worker/src/fetchers/biorxiv.fetcher.spec.ts`) with at least one 2xx and one non-2xx case, mocking `globalThis.fetch`.

No changes to `CycleService` — `FetchersService.resolve()` dispatches polymorphically.

## Add a new notifier

Same pattern against `libs/shared/src/types/notifier.interface.ts` and `apps/worker/src/notifiers/notifiers.module.ts`. Extend `ChannelType`, update the `channel_type` column on `Subscriber`, and update the destination-validation logic in `apps/api/src/subscribers/subscribers.service.ts` if the new channel has a distinct format.

## Add a new app

`nest generate app <name>` scaffolds a new entry under `apps/`. Add a matching `projects.<name>` block in `nest-cli.json` and a `tsconfig.app.json` modeled on the existing ones. Pull in `DatabaseModule` and/or `@nestjs/bullmq` as needed.

## Change the cycle semantics

The cycle is plain TS in `CycleService.run()` — not a declared statechart any more. Modify directly. If you want the MCD-Flow spec to stay in sync, run `/mcd-import` to rebuild `.mcd/` from the current code, then `/mcd "<change>"` in diff mode to extend the statechart.

## Migrations

Swap `synchronize: true` in `DatabaseModule` for migrations before production:

```bash
bunx typeorm migration:generate -d ormconfig.ts libs/database/src/migrations/Init
```

Wire the generated migrations into `TypeOrmModule.forRootAsync` via `migrations: [...]` + `migrationsRun: true`.

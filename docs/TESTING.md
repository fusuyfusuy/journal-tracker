# Testing

Run everything:
```bash
bun run test           # once
bun run test:watch     # watch
```

Runner: **Jest** + `ts-jest`. Config is in `package.json` under `"jest"` — includes path aliases for `@journal/database` and `@journal/shared`.

## Layout

| File pattern | Scope | Uses |
|---|---|---|
| `apps/**/*.spec.ts` | Unit test for the file it sits next to | `@nestjs/testing` for DI-backed services |
| `apps/worker/src/cycle/cycle.service.spec.ts` | Integration — full DI graph minus HTTP, real TypeORM on `:memory:` | Mocked `FetchersService` and `NotifiersService` |
| `apps/api/test/api.e2e-spec.ts` | HTTP-level e2e | `supertest` against a `NestApplication` with in-memory SQLite |

## Patterns

### Mocking HTTP

Fetcher and notifier tests swap `globalThis.fetch` in `beforeEach` and restore in `afterEach`. Response bodies are plain `new Response(...)` values — no HTTP mock library.

```ts
const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

### Fresh DB per test

Integration and e2e tests rely on `TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', synchronize: true, dropSchema: true })` in a `beforeEach`. `dropSchema: true` guarantees isolation across tests in the same file.

### DI-backed unit tests

Resolvers like `FetchersService` are tested via `Test.createTestingModule(...)` with a `useValue` provider for the injected array:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [
    { provide: FETCHER_TOKEN, useValue: [fakeRss, fakeArxiv] },
    FetchersService,
  ],
}).compile();
```

### Silencing logs

`StructuredLogger` is a global provider that writes to stdout on every call. Integration tests override it:

```ts
.overrideProvider(StructuredLogger).useValue({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  log: jest.fn(), verbose: jest.fn(),
})
```

## Adding a test for a new fetcher/notifier

Model on `rss.fetcher.spec.ts` / `email.notifier.spec.ts`. Minimum coverage:

1. One happy-path parse.
2. One non-2xx path — asserts the `FetchError` / `NotificationEvent` error shape, **does not throw**.
3. One network-error path — mock `fetch` to reject, assert the returned `error.kind`.
4. Assert that `User-Agent` is set from `config.userAgent` and that `signal` is attached.

## Not yet tested

- BullMQ processor behavior end-to-end (requires Redis or `ioredis-mock`). Issue #3 will cover this.
- Authentication (issue #2).
- Migration idempotency (issue #1).

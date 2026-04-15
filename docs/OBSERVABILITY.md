# Observability

## Health endpoints

Both endpoints are unauthenticated and intended for use by container orchestrators (Kubernetes probes, load-balancer health checks).

### `GET /health` — liveness

Returns immediately without I/O. If the process can serve this response, it is alive.

**Response (always 200)**

```json
{
  "status": "ok",
  "uptime": 42.3
}
```

`uptime` is `process.uptime()` in seconds.

### `GET /ready` — readiness

Checks that both backing services are reachable before declaring the API ready to handle traffic. Powered by [`@nestjs/terminus`](https://docs.nestjs.com/recipes/terminus).

Checks performed:

| Key | What it does |
|---|---|
| `db` | `TypeOrmHealthIndicator.pingCheck('db')` — executes `SELECT 1` against the SQLite DataSource |
| `redis` | `RedisHealthIndicator.isHealthy('redis')` — opens a temporary `ioredis` connection, issues `PING`, closes |

**Response (200 — all checks pass)**

```json
{
  "status": "ok",
  "info": {
    "db": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "db": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

**Response (503 — one or more checks fail)**

```json
{
  "status": "error",
  "info": {
    "db": { "status": "up" }
  },
  "error": {
    "redis": { "status": "down", "message": "connect ECONNREFUSED 127.0.0.1:6379" }
  },
  "details": {
    "db": { "status": "up" },
    "redis": { "status": "down", "message": "connect ECONNREFUSED 127.0.0.1:6379" }
  }
}
```

## Prometheus metrics + tracing

Prometheus scrape endpoint and OpenTelemetry tracing are deferred to a follow-up on [issue #5](https://github.com/fusuyfusuy/journal-tracker/issues/5).

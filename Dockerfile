# --- builder ---
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs
RUN bunx nest build && bunx nest build api

# --- runtime base (shared) ---
FROM oven/bun:1-slim AS runtime-base
WORKDIR /app
# bun user exists in oven/bun images
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
EXPOSE 3000

# --- api runtime ---
FROM runtime-base AS api
ENV APP=api
# Probe /health; only a 2xx response is healthy. Connection/fetch failures
# exit 1 so orchestrators can restart the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.API_PORT || 3000) + '/health').then(r => process.exit(r.status >= 200 && r.status < 300 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "bun dist/apps/${APP}/main.js"]

# --- worker runtime (no HEALTHCHECK; orchestration restarts on process exit) ---
FROM runtime-base AS worker
ENV APP=worker
CMD ["sh", "-c", "bun dist/apps/${APP}/main.js"]

# Default target preserves prior `--target runtime` behavior via APP build arg.
FROM runtime-base AS runtime
ARG APP=worker
ENV APP=${APP}
CMD ["sh", "-c", "bun dist/apps/${APP}/main.js"]

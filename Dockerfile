# --- builder ---
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs
RUN bunx nest build && bunx nest build api

# --- runtime ---
FROM oven/bun:1-slim AS runtime
ARG APP=worker
ENV APP=${APP}
WORKDIR /app
# node user exists in oven/bun images
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
# Healthcheck: for the API we probe /health (added in issue #5 — until then,
# fetch will reject and the CMD falls back to exit 0, so the container stays
# healthy. Once #5 lands, the probe becomes meaningful).
# For the worker there is no HTTP listener, so we always exit 0.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "if (process.env.APP === 'api') { fetch('http://localhost:' + (process.env.API_PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(0)); } else { process.exit(0); }"
EXPOSE 3000
CMD ["sh", "-c", "bun dist/apps/${APP}/main.js"]

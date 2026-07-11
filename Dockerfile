# NyumatFlix app image. FlareSolverr runs as a separate sidecar — see docker-compose.yml.
# On the box, always set FLARESOLVERR_URL=http://flaresolverr:8191/v1 at runtime.
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:24.15.0-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Leave room for native allocations, streaming buffers, Docker, and sidecars on
# the 8 GiB production host. The container has a separate 3 GiB hard limit.
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["node", "server.js"]

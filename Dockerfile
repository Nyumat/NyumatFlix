FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages/
RUN bun install --frozen-lockfile --ignore-scripts

FROM oven/bun:1 AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG TMDB_API_KEY
ARG CAP_API_ENDPOINT
ENV TMDB_API_KEY=$TMDB_API_KEY
ENV CAP_API_ENDPOINT=$CAP_API_ENDPOINT

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages
RUN test -f packages/player/dist/wasm/movi.js || (echo "missing packages/player/dist/wasm/movi.js — run: bunx turbo build:wasm --filter=@nyumatflix/player" && exit 1)
RUN node apps/web/scripts/prepare-anime-mappings.mjs
RUN bunx turbo build --filter=@calluspirates/shared --filter=@nyumatflix/playback
RUN bun --cwd packages/player run build
RUN bun --cwd apps/web run build

FROM node:24.15.0-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=3840
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/data/anime-mappings ./apps/web/data/anime-mappings

WORKDIR /app/apps/web

EXPOSE 8080

CMD ["node", "server.js"]

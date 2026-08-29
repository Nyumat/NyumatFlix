FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/calluspirates-shared ./packages/calluspirates-shared
RUN bun install --frozen-lockfile --ignore-scripts

FROM oven/bun:1 AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG TMDB_API_KEY
ARG CAP_API_ENDPOINT
ENV TMDB_API_KEY=$TMDB_API_KEY
ENV CAP_API_ENDPOINT=$CAP_API_ENDPOINT

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY packages/calluspirates-shared ./packages/calluspirates-shared
COPY . .
RUN node scripts/prepare-anime-mappings.mjs
RUN bun run build

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

COPY --from=builder /app/data/anime-mappings ./data/anime-mappings
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080

CMD ["node", "server.js"]

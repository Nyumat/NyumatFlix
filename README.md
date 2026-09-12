![NyumatFlix](/preview.png)

<div align="center">
  <h3 style="font-size: 3rem; font-weight: 600;"><a href="https://nyumatflix.com">NyumatFlix</a></h3>
  <p><em>Yet another Anilist and TMDB metadata aggregator.</em></p>
</div>




<!-- NyumatFlix is a platform for streaming movies and TV shows. It is a open-source, no-cost, and ad-free movie and tv show stream aggregator. Streams are curated from some of the most popular API providers.

## ⚡️ Tech Stack

- [Bun](https://bun.sh/)
- [Next.js](https://nextjs.org/)
- [Resend](https://resend.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Postgres](https://www.postgresql.org/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Husky](https://typicode.github.io/husky/#/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Jest](https://jestjs.io/)
- [NextAuth.js](https://next-auth.js.org/)
- [TMDb API](https://www.themoviedb.org/documentation/api)
- [Biome](https://biomejs.dev/) -->

<!--
## 🏃🏾‍♂️ Run NyumatFlix Locally

> [!IMPORTANT]
> **Required**
>
> - [Bun](https://bun.sh/) `1.3+` (see `packageManager` in root `package.json`)
> - [Docker](https://www.docker.com/) — scrape stack on `bun run dev`, and first-time Movi player WASM build
> - [PostgreSQL](https://www.postgresql.org/) (or [Neon](https://neon.tech/))
> - [TMDb](https://www.themoviedb.org/) API key
> - [Resend](https://resend.com/) API key (`AUTH_RESEND_KEY`)
> - `AUTH_SECRET` — e.g. `openssl rand -base64 32`
>
> **Optional (feature-specific)**
>
> - `ID_MOE_API_KEY` — anime ↔ TMDB mapping
> - `MAL_CLIENT_ID` / `MAL_CLIENT_SECRET` — MyAnimeList sync on login
> - `scripts/gluetun/.env` — Surfshark (or other) WireGuard creds for scrape VPN egress
> - `CALLUSPIRATES_*` — Direct playback provider (nyumatflix.com only in prod)
> - `bun run cap:up` — self-hosted Cap instead of dev bypass on `/login`

Monorepo layout: app in `apps/web`, shared packages in `packages/*`. Env lives at **repo root** (`.env.local`); `apps/web` symlinks to it on build/dev.

1. Clone or fork the repository

```bash
git clone git@github.com:Nyumat/NyumatFlix.git
cd NyumatFlix
```

2. Environment

```bash
cp .env.example .env.local
```

Fill in at minimum: `TMDB_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_RESEND_KEY`. Local URLs are prefilled (`APP_URL` / `AUTH_URL` / `NEXTAUTH_URL` → `http://localhost:3000`). See `.env.example` for scrape (`FLARESOLVERR_URL`, `SCRAPE_PROXY_URL`), feature flags (`FLIPT_*`), and Cap.

> [!TIP]
> Any Postgres-compatible host works. Neon is fine for dev and prod.

3. Install dependencies

```bash
bun install
```

4. Configure magic strings (optional)

Hardcoded branding/metadata: `apps/web/lib/constants.ts`, `apps/web/emails/`, and `metadata` in `apps/web/app/`.

> [!NOTE]
> If you ship without changing these, credit is appreciated.

5. Database

```bash
cd apps/web && bun run db:migrate
# optional: bun run db:studio
```

Fresh schema only (no migration history): `bun run db:push`. After pulling schema changes: `bun run db:migrate`. Existing DBs from older deploys: `bun run db:ensure-baseline` then `db:migrate`.

6. Local scrape stack (optional but recommended for playback)

`bun run dev` runs `scripts/bootstrap-scrape-vpn.sh ensure-local` first — starts **FlareSolverr** (`:8191`), **Flipt** (`:8090`), and **Gluetun** (`:8888` proxy, `:8000` control) when Docker is available. Writes scrape-related vars into `.env.local`.

```bash
# full bootstrap + prod env sync (needs SSH host `leetbot` unless you skip)
bun run dev:stack

# scrape stack only, no Next.js
./scripts/bootstrap-scrape-vpn.sh ensure-local

# skip scrape containers (metadata/browse still works; many scrapes will fail)
SKIP_SCRAPE_STACK=1 bun run dev
```

Gluetun needs VPN creds in `scripts/gluetun/.env` (copy from `scripts/gluetun/.env.example`). Without VPN, FlareSolverr still helps; vixsrc/vidsrc/vidrock often need the proxy.

7. Run the development server

```bash
bun run dev
```

First run may build `@nyumatflix/player` via Docker if `public/vendor/player/` is missing.

8. Open [http://localhost:3000](http://localhost:3000)
-->

<!-- ## Production infrastructure

Production uses one idempotent reconciler for Gluetun, FlareSolverr, and Flipt. The regular application deploy syncs the desired Compose files, runs the reconciler on the VPS, verifies the services over the Docker network, and then performs the blue-green NyumatFlix rollout.

For first-time VPN provisioning from a workstation, populate the gitignored `.env.vpn` file and run:

```bash
./scripts/setup-vpn.sh bootstrap
```

The remaining operational commands all use the same reconciliation path:

```bash
./scripts/setup-vpn.sh ensure  # repair drift without updating images
./scripts/setup-vpn.sh update  # explicitly pull and reconcile infrastructure images
./scripts/setup-vpn.sh status
./scripts/setup-vpn.sh test
./scripts/setup-vpn.sh rotate
```

`bootstrap` securely streams the VPN seed to the VPS once. Generated control credentials are preserved on later runs. Existing standalone Gluetun or FlareSolverr containers are migrated only when they are unowned; containers owned by an unexpected Compose project fail closed instead of being deleted. -->

<!--
## 🐳 Run with Docker

Docker uses the same image shape for local and production. Build-time secrets are not used. Copy the example env file and fill in the values:

```bash
cp .env.example .env.local
```

For local Docker, use `APP_URL=http://localhost:8080`, then run:

```bash
./scripts/local-compose.sh up --build -d
```

The app will be available at [http://localhost:8080](http://localhost:8080). To use a different port:

```bash
APP_PORT=3001 ./scripts/local-compose.sh up --build -d
```

For production, build and publish the image without secrets:

```bash
docker build -t registry.example.com/nyumatflix:latest .
```

Then inject runtime variables through your host or platform. For plain Docker Compose on a VPS, keep the real env file outside git and pass it explicitly:

```bash
docker compose \
  --env-file /etc/nyumatflix/env \
  up -d
```

Set `APP_URL`, `AUTH_URL`, and `NEXTAUTH_URL` to your public origin in production. `AUTH_URL` and `NEXTAUTH_URL` default to `APP_URL` in Docker Compose, so most deployments can set all three to the same value. Server-only values such as `DATABASE_URL`, `AUTH_SECRET`, `TMDB_API_KEY`, and `AUTH_RESEND_KEY` are runtime secrets and should never be copied into the Docker image. -->

<!--
## FAQ

### How do I add a new stream provider?

Embed providers live in `apps/web/lib/stores/server-store.ts` (`videoServers`). Scrape providers are under `apps/web/lib/scrape/providers/`. Each embed provider implements `VideoServer` (`id`, `name`, `baseUrl`, `getMovieUrl`, `getTvUrl`, `getEpisodeUrl`, optional anime helpers).

### How do I sign-in locally?

1. `bun run dev`
2. Go to `http://localhost:3000/login`
3. Submit your email
4. **Dev:** magic link prints in the terminal (and there's an in-UI redirect). Cap is bypassed when `NODE_ENV=development`.
5. **Prod:** link emailed via Resend (`AUTH_RESEND_KEY`, verified `RESEND_FROM_EMAIL` domain).

## Local services

| Service | Port | Start | Purpose |
| --- | --- | --- | --- |
| Next.js | `3000` | `bun run dev` | App |
| FlareSolverr | `8191` | auto / `bun run flaresolverr:up` | Cloudflare / Turnstile bypass for scrapes |
| Gluetun | `8888`, `8000` | auto via bootstrap | VPN egress for blocked providers |
| Flipt | `8090` | auto / `bun run flipt:up` | Feature flags / provider order |
| Cap | `3030` | `bun run cap:up` | Login challenge (dev uses bypass without this) |

Compose project: `./scripts/local-compose.sh <cmd>`. Stack status: `bun run stack:status`.

## 📝 Scripts

Root (`package.json`):

| Script | Description |
| --- | --- |
| `dev` | Turbo → Next dev + scrape bootstrap |
| `dev:stack` | Full scrape/VPN bootstrap (`bootstrap-scrape-vpn.sh local`) |
| `dev:sync` | Sync scrape env from prod VPS into `.env.local` |
| `build` / `test` / `lint` / `typecheck` | Turbo across workspaces |
| `flaresolverr:up` / `flipt:up` / `cap:up` | Start individual compose services |
| `stack:status` | `docker compose ps` for local stack |

`apps/web`:

| Script | Description |
| --- | --- |
| `dev` | Next.js (Turbopack) |
| `build` / `start` | Production build / server |
| `format` / `check-format` / `lint` / `lint:fix` | Biome |
| `type-check` | `tsc` |
| `test` / `test:watch` / `test-ci` | Vitest |
| `precommit` | format + lint + type-check |
| `db:generate` | New Drizzle migration from schema |
| `db:migrate` | Apply pending migrations |
| `db:push` | Push schema without migration files |
| `db:ensure-baseline` | Stamp baseline on existing DBs |
| `db:repair-watchlist` | Fix legacy watchlist status values |
| `db:studio` | Drizzle Studio |
| `ensure-player` | Build/copy Movi player vendor assets |

## 🤝🏿 Contributing

Contributions, feedback, and suggestions are always welcome here. Please, if you have any sort of inquiry, feel free to open an issue!

## 🙏🏿 Support the project

If you find the project useful, consider starring the repo! I appreciate all the support and feedback I've received from the community over the years developing this project.
-->

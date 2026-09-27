# Bunny CDN — nyumatflix.com HTML zone

Bunny already fronts `cdn.nyumatflix.com` (assets). Add a **second pull zone** for catalog HTML.

## Origin

- Origin URL: `https://nyumatflix.com` (leetbot nginx)
- Host header: `nyumatflix.com`

## Cache rules (Bunny dashboard)

1. **Cache GET** for:
   - `/`
   - `/movies`, `/movies/*`
   - `/tvshows`, `/tvshows/*`
   - `/trending`, `/anime`, `/anime/*`
   - `/collections`, `/person/*`

2. **Bypass cache** when request cookie contains:
   - `authjs.session-token`
   - `__Secure-authjs.session-token`
   - `next-auth.session-token`

3. **Never cache**:
   - `/api/*`
   - `/login`, `/watchlist`, `/settings`, `/history`

4. **Query strings**: cache ignore (or Vary only on `Rsc` if needed for RSC flights)

## Env on leetbot (`~/apps/nyumatflix/.env`)

Managed via repo `.env.prod` → `scripts/sync-prod-env.sh push`:

- `BUNNY_API_KEY` — account API key (purge)
- `BUNNY_PULL_ZONE_ID` — HTML pull zone id (`6140458`)
- `NEXT_PUBLIC_CDN_ORIGIN=https://cdn.nyumatflix.com`
- `NEXT_PUBLIC_IMAGE_PROXY_ENABLED=1`
- `BUNNY_STORAGE_*` — Frankfurt storage zone `dontlarp` (see `.env.example`)

Optional: `BUNNY_PURGE_PATHS=/,/movies,/tvshows,/trending,/anime`

## Storage zone (`dontlarp`)

Frankfurt (`de`). Use as pull-zone origin backing or imgproxy output persistence.

- HTTP: `https://storage.bunnycdn.com/dontlarp`
- S3: `https://de-s3.storage.bunnycdn.com` (bucket = zone name, access key id = zone name)

`scripts/deploy.sh` calls `scripts/bunny-purge-catalog.sh` after nginx reload (default `BUNNY_PURGE_MODE=full`).

Purge modes:
- `full` — purge entire HTML pull zone (recommended after deploy)
- `warm` — purge every path in `apps/web/data/hubs/warm-paths.json`
- `paths` — purge `BUNNY_PURGE_PATHS` hub roots only

## Verify

```bash
curl -sI https://nyumatflix.com/ | grep -iE 'cdn-cache|server|cache'
```

Logged-out requests should show Bunny cache HIT on repeat visits.

Yes — I know exactly what you mean. In [p-stream](https://github.com/xp-technologies-dev/p-stream) it’s the **auto source scraping / fallback** flow, not manual server picking.

## What you’re describing

When you hit play, instead of loading one embed and stopping, p-stream:

1. **Walks a ordered list of providers** (VidSrc, 2Embed, etc.)
2. **Shows a live “scraping” UI** — each source gets a status: waiting → pending → success / failure / not found
3. **Auto-advances** to the next source if the current one fails
4. **Plays the first one that works**, or shows an error if everything is exhausted

Visually it’s that centered vertical list of provider names with spinners/checkmarks/X marks, scrolling/highlighting the one currently being tried.

## How p-stream implements it

**Scraping overlay** — `ScrapingPart.tsx` renders the list via `ScrapeCard` / `ScrapeItem`, driven by `useScrape()`:

- `startScraping()` → tries all sources in order via `providers.runAll()`
- `resumeScraping(media, startFromSourceId)` → continues from the *next* source after a failure
- Events (`init`, `start`, `update`, `discoverEmbeds`) update each row’s status in real time

**Auto-retry on playback failure** — `PlaybackErrorPart.tsx`:

- When HLS/video dies fatally, it marks that source/embed as failed (`addFailedSource` / `addFailedEmbed`)
- If `enableAutoResumeOnPlaybackError` is on, it automatically calls `onResume(currentSourceId)` → triggers `resumeScraping` from the next provider
- There’s also a manual **“Find next source”** button in the source settings menu

**State machine** — player status goes roughly:

`SCRAPING` → (found stream) → `PLAYING`
or
`PLAYBACK_ERROR` → auto-resume → `SCRAPING` again from next source

Failed sources are tracked per movie/episode in `failedSourcesPerMedia` so it doesn’t retry dead ones.

## vs NyumatFlix today

Your app is closer to **manual server selection + iframe embeds**:

- `ServerSelector` lets the user pick VidSrc, 2Embed, etc.
- `server-store.ts` does parallel health checks and picks a fallback if the *selected* server is down
- But it does **not** have the p-stream-style sequential “trying X… trying Y…” scraping UI with auto-advance on playback failure

That’s the gap if you’re thinking about porting the pattern — p-stream resolves **direct stream URLs** via scrapers (`@p-stream/providers`), while NyumatFlix mostly **embeds third-party players in iframes**.

Is that the UI you had in mind, or were you thinking of something more specific (e.g. embed-within-source fallback, or the settings menu “find next source” button)?

Implemented the p-stream-style auto-scraping flow from `UI_GOAL.md` using the working vectors from `SCRAPING.md`, and verified it across multiple TMDB IDs.

## What was built

### Server-side scrapers (`lib/scrape/`)
| Provider | Method |
|---|---|
| **VidKing** | `api.wingsdatabase.com` seed + splitmix64 decrypt → `shadowlemon.site` HLS |
| **VidSrc** | `vsembed.ru` → `cloudorchestranova.com` → JWT from `generate.php` |
| **2Embed/XPass** | `api.2embed.cc` IMDB lookup → `play.xpass.top/e/movie/{imdb}` → `mvid/{hash}/playlist.json` |
| **VidSrc Mirror** | FlareSolverr → `api.vidsrc.wtf/source/movie/{id}` (last resort; currently returns stale URLs) |

### API
- `POST /api/scrape` — scrape a single provider, returns proxied `playUrl`
- `GET /api/scrape/play/[token]/[asset]` — HLS proxy with referer headers + playlist rewriting

### UI (p-stream pattern)
- **`useScrape`** — walks providers in order, tracks per-row status, auto-resumes on playback failure
- **`ScrapingOverlay`** — centered vertical provider list with spinners/checkmarks/X marks
- **`hero-background.tsx`** — on Play: scrape → HLS player; on fatal error: try next source; if all fail: iframe fallback

## Verification (3 TMDB IDs)

```
TMDB 550   (Fight Club)  → VidKing ✓  VidSrc ✓  2Embed ✓  Mirror ✗
TMDB 27205 (Inception)    → VidKing ✓  VidSrc ✓  2Embed ✓  Mirror ✗
TMDB 603   (The Matrix)   → VidKing ✓  VidSrc ✓  2Embed ✓  Mirror ✗
```

**9/12 provider attempts succeeded** — all 3 movies get direct HLS from at least 3 providers. VidSrc Mirror still returns the same expired CDN77 URL for every ID (known issue from `SCRAPING.md`).

Re-run verification anytime:

```bash
npx tsx scripts/verify-scrape-direct.mts
```

## How to try it in the app

1. Ensure FlareSolverr is running on `:8191` (only needed for VidSrc Mirror fallback)
2. Open any movie page and hit **Play**
3. You should see the scraping overlay try VidKing → VidSrc → 2Embed in order, then start HLS playback on the first success

If playback dies mid-stream, it automatically resumes from the next provider.

FlareSolverr is running locally and wired into the project for Railway.

## Local (running now)

Replaced the old standalone container with compose-managed FlareSolverr:

- **Container:** `nyumatflix-flaresolverr`
- **URL:** `http://localhost:8191/v1`
- **Health:** healthy (session create test passed)

Handy commands:

```bash
npm run flaresolverr:up      # start
npm run flaresolverr:down    # stop
npm run flaresolverr:logs    # tail logs
```

For local `next dev`, FlareSolverr alone is enough:

```bash
npm run flaresolverr:up
```

Full stack (app + FlareSolverr):

```bash
docker compose up --build
```

## What was added

| File | Purpose |
|---|---|
| `docker-compose.yml` | `flaresolverr` service + app wired via `FLARESOLVERR_URL=http://flaresolverr:8191/v1` |
| `flaresolverr/Dockerfile` | Thin wrapper around `flaresolverr/flaresolverr:latest` for Railway |
| `flaresolverr/railway.toml` | Railway config for the FlareSolverr service |
| `railway.toml` | Railway config for the main app |
| `.env.example` | `FLARESOLVERR_URL=http://localhost:8191/v1` |

Railway does **not** run `docker-compose.yml` directly — you need **two services** in the same project:

### Railway setup

1. **App service** (existing)
   - Root: `/`
   - Builds from root `Dockerfile`
   - Add variable:
     ```
     FLARESOLVERR_URL=http://flaresolverr.railway.internal:8191/v1
     ```
     (Use your actual FlareSolverr service name if it’s not `flaresolverr`.)

2. **FlareSolverr service** (new)
   - Create an **Empty Service** → set root directory to `flaresolverr/`
   - Builds from `flaresolverr/Dockerfile`
   - Set **internal port** to `8191` (no public port needed)
   - Private networking handles the rest

Both services must be in the **same Railway project/environment** so `*.railway.internal` resolves.

If you want, I can also add a Railway deploy note to `SCRAPING.md` or wire FlareSolverr into CI for scrape tests.
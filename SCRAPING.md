# Goal
Scrape underlying HLS stream URLs from all 9 providers in lib/stores/server-store.ts.

# Constraints & Preferences
- Extract actual .m3u8 / playlist.json / direct stream URLs, not embed pages.
- FlareSolverr running on localhost:8191 for Turnstile bypass.
- Do not stop until every provider yields playable streams.

# Provider Status Overview

## Working — Extractable HLS/Stream URLs

### VidKing
- **API:** `api.wingsdatabase.com/seed?mediaId={tmdbId}` (30s TTL)
  - `/cdn/sources-with-title` (HYDROGEN — verified 1080p/720p/480p)
  - `/downloader2/sources-with-title` (LITHIUM — verified 720p/480p/360p)
  - `/tejo/sources-with-title` (TITANIUM — 404)
  - `/neon2/sources-with-title` (OXYGEN — 500)
  - `/1movies/sources-with-title` (HELIUM — not tested)
- **Decrypt:** splitmix64 PRNG + XOR with `mvm1` magic bytes header
- **CDN:** `shadowlemon.site/r2/cdn2/{token}/{quality}/index.m3u8` (no auth on segments)
- **Script:** `/tmp/vidking_fixed.mjs`

### VidSrc / VidFast (same EDN infra)
- **Embed:** `vsembed.ru/embed/movie?tmdb={id}` → iframe →
- **EDN:** `cloudorchestranova.com/rcp/[b64]` → iframe → `/prorcp/[b64]`
- **URL construction:** SHA-256(`G25`|YYYYMMDDHH_bucketed) → custom-base32 → `https://[a].[b].{cfd|rest|cyou}/k[RND]/VvMrO`
- **Auth:** JWT from `comityofcognomen.site/generate.php` / `app2.putgate.com/generate.php` (per-IP `ip_cidr`, ~4h expiry). Replaces `__TOKEN__` in HLS master.
- **Segment obfuscation:** `.jpg/.html/.js/.css/.txt/.png/.webp` extensions
- **Note:** 11 VidFast domains (cinegram.\*, flixmomo.\*, boredflix.com, flixbaba.mov, 7xcinema.com, mapple.tv, 1shows.live, 1shows.ru, ythd.org/embed) are all alternate VidSrc front-ends. Same EDN infra.

### XPass / 2Embed
- **VID 1:** `cf-master.{token}.txt` on `sau.trovianaworks.online`
- **MEG 1:** `master.m3u8` on `ps1.1x2.space/enproxy/{encrypted_token}`
- **Pattern:** `play.xpass.top/mdata/{hash}/{quality}/playlist.json` (10+ fallback servers: FIL, WIS, LUL, SAF, BIG, MIX, MOL, TAP, VXR, VRK)
- **Format:** JW Player `playlist.json` → `.m3u8`
- **Subtitles:** `sub.1x2.space/api/movie/{tmdbId}`

### VidNest
- **Domain:** `vidnest.fun` (moved from `vidnest.net` — NXDOMAIN)
- **API:** `https://new.vidnest.fun/{server}/{type}/movie/{tmdbId}`
- **10 servers:** `lamda`, `prime`, `ophim`, `alfa` (HLS) | `beta`, `sigma`, `gama`, `catflix`, `hexa`, `delta` (MP4/DASH)
- **Decrypt:** Custom-base64 alphabet `RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=`
- **Response:** `{"streams":[{"url":"...","type":"hls|mp4","language":"..."}],"captions":[...],"downloads":[...]}`
- **Pipeline:** Backend → CF Worker → `megacloud.animanga.fun/proxy?url=&headers=` → client
- **Note:** HLS URLs are time-limited token-based (lamda redirects to CDN with expiry)

## Requires Browser Execution

| Provider | Problem |
|---|---|
| **vidsrc.wtf** | Source resolution entirely in obfuscated client-side JS (692KB+374KB chunks). Backend `multilang-api.*.tf` — exact TLD obfuscated. |
| **VidEasy** | React/Next.js app. Auth token algorithm reversed but all backend APIs return 404/401. Stream source resolved client-side only. |
| **streamingnow.mov** | 621KB encrypted payload cracks to ad-server config (not a stream URL). XOR key `xR9tB2pL6q7MwVe`. Second-layer ROT12 obfuscation + Cloudflare Turnstile required. |
| **SuperEmbed** | FlareSolverr returns page but Turnstile (`0x4AAAAAADJhYEMLT4WeJ0CT`) still present. No iframe embeds or stream URLs in response. |

## Dead
| Provider | Reason |
|---|---|
| **111Movies** | `111movies.com` and `111movies.net` both return HTTP 500 on every URL. |

# Detailed Provider Findings

## VidKing
- Seed API: `api.wingsdatabase.com/seed?mediaId={tmdbId}` returns `{seed, ttlMs: 30000}` — works with Origin+Referer headers.
- Data endpoints Cloudflare-protected, bypassed with cloudscraper Python library.
- Decryption: splitmix64 finalizer `ui(x) = XOR-shift + multiply by 2246822507/3266489909`, then stateful PRNG XOR. Magic bytes `mvm1` confirms success.
- 30+ subtitle tracks in multiple languages.
- `db.wingsdatabase.com/3/movie/{tmdbId}?language=en-US` returns movie metadata (alternative to TMDB API).

## VidSrc / Cloudnestra (EDN)
- Initial `/rcp/{hash}` page returns player UI with play button. On interaction, loads `/prorcp/{hash}` iframe (51KB player page).
- Player page embeds `master_urls` variable with HLS URLs.
- JWT tokens expire ~4h (iat→exp = 14400s), per-IP (`ip_cidr` claim).
- Verified: 3-quality HLS master (640×266, 1280×534, 1920×800).
- Comityofcognomen.site uses path-encoded tokens — base64 path contains auth info, verified by JWT query param.

## VidSrc Mirror (api.vidsrc.wtf) — API crackable via FlareSolverr
```
POST http://localhost:8191/v1
{"cmd":"request.get","url":"https://api.vidsrc.wtf/source/movie/550","maxTimeout":60000}
```
Returns: `{"stream":{"url":"https://hls-cdn77.others-cdn.com/.../hls.m3u8"}}`
- API also works for TV: `GET https://api.vidsrc.wtf/source/tv/{tmdbId}/{season}/{episode}`
- No embed page needed — direct JSON API behind Cloudflare.
- URLs are CDN77 signed with short expiry.
- Embed routes (`vidsrc.wtf/1/movie/550`) 301/404; the API is the real surface.

## XPass / 2Embed
- VID 1: `cf-master.{token}.txt` on `sau.trovianaworks.online`
- MEG 1: `master.m3u8` on `ps1.1x2.space/enproxy/{encrypted_token}`
- JW Player `playlist.json` structure: `{playlist: [{sources: [{file, type, label}]}]}`
- 10+ fallback servers all use `play.xpass.top/mdata/{hash}/{quality}/playlist.json`
- Subtitles via `sub.1x2.space/api/movie/{tmdbId}`

## VidNest
- Discovered domain `vidnest.fun` — full API documented at landing page.
- API patterns: `/movie/{tmdbId}`, `/tv/{id}/{season}/{episode}`, `/anime/{anilistId}/{ep}/{sub|dub}`
- 10 servers: `lamda`, `ophim`, `prime`, `beta`, `sigma`, `catflix`, `alfa`, `gama`, `hexa`, `delta`
- Backend partner domains: `goodstream.cc`, `flashstream.cc`, `flixcdn.cyou`, `fmoviesunblocked.net`, `megacloud.animanga.fun`, `upcloud.animanga.fun`
- Proxy layer: Cloudflare Workers (vidnest-1 through vidnest-4, vidness-1, vidnestt, vidnests22-e71) — all return 403
- Uses Next.js + Turbopack.
- Player uses VidStack CSS, detects source type: `mp4`/`.mp4`/`/mp4-proxy` → `video/mp4`, otherwise `application/x-mpegurl`.
- Subtitle support: VTT and SRT (detected via `format=srt` or `.srt`)
- Preloaded scripts: `disable-devtool`, `devtools-detector`, `/js/nocheats.js`, `/js/mercury.js`, `/js/fubuki.js`, `video.min.js`, `hls.js@latest`
- VidNest JS chunk also contains media progress tracking via `vidNestProgress` localStorage key.

### VidNest Decrypted Streams (verified)
| Server | Type | Stream URL Pattern |
|---|---|---|
| **lamda** | HLS (Hindi) | `laika422mon.com/stream2/.../index.m3u8` (302 → CDN) |
| **prime** | MP4 + HLS | `hlmv.tripplestream.online` + `goodstream.cc/streamsvr/...` |
| **ophim** | HLS (auto) | `suw.halcyoncreative.site/v4/.../cf-master.{ts}.txt` (Cloudflare) |
| **alfa** | HLS (direct) | `203.188.166.86/v4/.../master.m3u8` (403 without auth) |
| **catflix** | MP4/DASH | Partner CDN |
| **hexa** | MP4/DASH | Partner CDN |
| **gama** | MP4/DASH | Partner CDN |

## vidsrc.wtf
- `vidsrc.wtf` / `www.vidsrc.wtf` — Static HTML homepage with anti-bot scripts (`fubuki.js`, `mercury.js`, `nocheats.js`, `path.js`).
- `www.vidsrc.wtf/movie/550` — Next.js App Router (build ID: `xv8mDRN7IL1VGn2I8rGRP`), returns 404.
- `api.vidsrc.wtf/` (root) — Honeypot API, responds with random quote ("Prince Charles is an avid collecter of toilet seats.")
- `api.vidsrc.wtf/source` — Behind Cloudflare JS challenge.
- **JS chunks:**
  - `fd9d1056-87da80e0c187477b.js` (692KB) — 4952 strings, deobfuscation offset 472, custom base64 decode
  - `117-42a9a4333790c950.js` (374KB) — 3293 strings, deobfuscation offset 103
  - Key strings: `sourcesReq`, `fetchPrior`, `embed`, `source`, `stream`
- Build manifest only shows `/_app` and `/_error` (actively hiding real routes).
- URL patterns tested (all 404): `/movie/550`, `/embed/movie/550`, `/e/550`, `/stream/550`, `/emb/550`, `/embed/tv/1399/1/1`

## VidEasy
- **Two hosts:** `www.videasy.to` (Vite/React SPA) and `player.videasy.net` (Next.js Pages Router, build ID `2uPQ441y43v3LxpRvgNM4`).
- `player.videasy.net` redirects to `player.videasy.to` (DDOS-Guard protected).
- **API endpoints:**
  - `https://db.wingsdatabase.com/3` — TMDB proxy (open, no auth needed)
    - `GET /movie/{id}?append_to_response=credits,external_ids,videos,recommendations,translations,similar,images`
    - `GET /tv/{id}/season/{s}/episode/{e}?append_to_response=external_ids`
    - `GET /discover/{type}`
  - `https://users.videasy.to/api/source/{id}` — Stream source API (returns `401 Unauthorized 1` without auth)
- **Auth mechanism (reversed from Next.js chunk):**
  ```javascript
  const salt1 = "8c465aa8af6cbfd4c1f91bf0c8d678ba";
  const salt2 = "d486ae1ce6fdbe63b60bd1704541fcf0";
  const hash = hexString(XOR(charCodes(movieID + salt2), charCodes(salt1)));
  const authToken = new Hashids().encode(hash); // property name: "b35ebba4"
  ```
- Sent as header `b35ebba4: {token}` → still **401 Unauthorized 1**.
- Likely missing: DDOS-Guard session cookies, correct header name, or Referer + cookie combo from `www.videasy.to`.
- Player embed URLs: `player.videasy.net/movie/{tmdb_id}?color=...`, `/tv/{id}/{s}/{e}?color=...`, `/anime/{id}?color=...`

## 111Movies
- Both `111movies.com` and `111movies.net` return HTTP 500 on all URLs — site appears down.
- **Historical findings (when it was up):**
  - Build ID: `p-G9fLtoG8yrQpkxRCW5a`
  - Page chunk: `pages/movie/%5Bid%5D-facb5d943a382c38.js`
  - Chunk 279 (`279-6f969fd845dcadc2.js`, 275KB): Contains RC4 cipher + 3000+ string table
  - Decoder functions:
    - `ZsluRN()` — custom alphabet base64 (`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=`)
    - `RIuqKc(data, key)` — base64 decode → RC4 decrypt
  - SSR data string is chunked HTML with encrypted `_data` attribute
  - Data is domain-specific (`.com` vs `.net` give different encrypted strings for same movie)
  - RC4 key is embedded in bytecode arrays (`eC`, `ew`) — index-dependent, not brute-forceable
  - After decode, player fetches `/${e8.current}/${e.data}` (path prefix from decrypted JSON)
  - Uses `window.FastStreamClient` with `VideoSource` objects supporting `accelerated_dash`, `accelerated_hls`, `accelerated_mp4`
  - Anti-sandbox detection (PDF plugin check, frame sandbox attribute check)
  - Loads `unlockr.app` paywall widget (367KB)

## streamingnow.mov
- Encrypted 621KB player payload in `window['ZpQw9XkLmN8c3vR3']`
- **Structure:** 3376 chars custom-base64 (lowercase-first alphabet `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=`) + 617KB JS decoder with 5649-element string table
- **Shuffle rotation:** N=487 (found via exhaustive search of checksum target `0xc576d`)
- **Index offset:** All accesses subtract `0x12c` (300)
- **Decoder function:** `Usrlur()` — custom-base64 → URL percent-encode → `decodeURIComponent`
- **XOR key:** `xR9tB2pL6q7MwVe` (14 chars, from string table indices 0x15fd and 0x10f2)
- **Decryption pipeline:**
  ```
  atob(payload) → XOR each byte with key[i % 14] → String.fromCharCode() → JSON.parse()
  ```
- **Decrypted output:** Ad server configuration JSON (not a stream URL)
  ```json
  {
    "adserverDomain": "biljhcemsseiq.website",
    "selPath": "/d3.php",
    "adbVersion": "3-cdn-js",
    "decoyDomain": "pluxpdzouwubj.space",
    "cdnDomain": "wwpvpbktgoets.space",
    ...
  }
  ```
- Turnstile sitekey: `0x4AAAAAADJhYEMLT4WeJ0CT`
- **Next steps:** Solve Turnstile or deobfuscate the second-layer script (ROT12 + adjacent-character swapping)

## SuperEmbed (multiembed.mov)
- FlareSolverr container pulled (`flaresolverr/flaresolverr:latest` from docker.io, ghcr.io denied).
- FlareSolverr returns 662KB HTML but Turnstile (`challenges.cloudflare.com/turnstile/v0/api.js`) is still present.
- No iframe embeds or stream URLs in response.
- Options: FlareSolverr session mode with longer wait, or headed browser.

# Key Encryption / Auth Artifacts

| Provider | Key / Algorithm | Purpose |
|---|---|---|
| VidKing | Splitmix64 constant `0x9E3779B97F4A7C15n` | PRNG seed for decryption |
| VidKing | Magic bytes `mvm1` | Decryption success marker |
| VidNest | Base64 alphabet `RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=` | Custom base64 decode |
| VidEasy | Salt1=`8c465aa8af6cbfd4c1f91bf0c8d678ba`, Salt2=`d486ae1ce6fdbe63b60bd1704541fcf0` | Auth token generation |
| VidEasy | Hashids(salt="") | Token encoding |
| VidSrc EDN | Secret `G25` / `G26` / `G27` | SHA-256 CDN URL generation |
| VidSrc EDN | Custom base32 alphabet `BCEFGHIJKLMNOPQRTUVWXYZ123456789` | URL hash encoding |
| streamingnow | XOR key `xR9tB2pL6q7MwVe` | Payload decryption |
| streamingnow | Shuffle N=487, offset `0x12c` | String table rearrangement |
| streamingnow | Custom base64 alphabet `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=` | Custom base64 decode |
| 111Movies | `RIuqKc(data, key)` — RC4 | SSR data decryption |
| 111Movies | `ZsluRN()` custom base64 alphabet `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=` | Custom base64 decode |
| VidFast | VM bytecode in `D` array | URL construction (runtime-built) |
| VidFast | `st()` (base64+URLdecode) / `i8()` (base64+RC4) | String decoding |

# Serving CDN Clusters
- **shadowlemon.site** — shared between VidKing (all tiers) and VidSrc EDN
- **laika422mon.com** — VidNest lamda server CDN
- **halcyoncreative.site** — VidNest ophim server (Cloudflare)
- **203.188.166.86** — VidNest alfa direct IP
- **goodstream.cc / hlmv.tripplestream.online** — VidNest prime
- **sau.trovianaworks.online / ps1.1x2.space** — XPass/2Embed
- **biljhcemsseiq.website** — streamingnow.mov ad delivery backend
- **comityofcognomen.site / app2.putgate.com** — VidSrc EDN JWT generation
- **megacloud.animanga.fun** — VidNest proxy layer

# Key Decisions
- Use docker.io/flaresolverr (ghcr.io denied access).
- Use cloudscraper for VidKing API (Cloudflare bypass).
- All remaining hard providers (VidNest, VidFast, VidEasy, vidsrc.wtf) are Next.js client-rendered — need JS chunk analysis to find API URLs rather than SSR scraping.
- 111Movies uses custom in-page RC4 cipher — need to extract decoder from the page's own JS.
- VidNest servers likely correspond to partner streaming providers.
- VidFast bytecode VM in chunk 365 prevents static extraction — may need runtime JS execution.

# Progress

## Done
- VidKing fully cracked via api.wingsdatabase.com — seed endpoint + encrypted sources, decrypt algorithm (splitmix64 + XOR). HYDROGEN/LITHIUM verified 1080p/720p/480p HLS on shadowlemon.site.
- VidSrc (cloudorchestranova.com) fully cracked — JWT tokens from comityofcognomen.site / app2.putgate.com, 3-quality HLS master, segments obfuscated as .jpg/.html/.js/.css/.txt/.png/.webp.
- XPass (2Embed) confirmed working — JW Player playlist.json on sau.trovianaworks.online / ps1.1x2.space + 10+ fallback servers. Subtitles via sub.1x2.space/api/movie/{tmdbId}.
- VidNest → new.vidnest.fun API cracked. 10 servers documented. Custom-base64 decrypt alphabet reversed.
- VidEasy auth mechanism reversed: XOR(movieID + salt2, salt1) → hex → Hashids encode. Salts documented.
- streamingnow.mov 621KB payload decryption pipeline reversed. XOR key `xR9tB2pL6q7MwVe` found. Ad config JSON extracted.
- 111Movies RC4 cipher identified in chunk 279. Custom base64 + RC4 decrypt functions located.
- VidFast embed token extracted from RSC. 11 backend domains identified. VM obfuscation in 2.5MB chunk 365 characterized.
- vidsrc.wtf chunks downloaded (692KB + 374KB). Build ID mapped. API endpoint `api.vidsrc.wtf/source` discovered.
- FlareSolverr Docker container running at localhost:8191.
- Python venv at /tmp/scrape_env with cloudscraper + flaresolverr.

## In Progress
- VidNest: Need to update server-store.ts with new domain and integrate decrypt logic.
- VidEasy: Compute correct auth token and call users.videasy.to/api/source/{id} with full browser headers.
- VidFast: Construct API URLs using embed token + hardcoded backends (only cinegram.tv responded 200).
- 111Movies: Extract RC4 key from bytecode arrays (eC, ew) in chunk 279.
- streamingnow.mov: Deobfuscate second-layer ROT12 script or solve Turnstile.
- vidsrc.wtf: Search chunks for source resolution API patterns or use FlareSolverr on `api.vidsrc.wtf/source`.

## Blocked
- VidKing TITANIUM (/tejo/) returns 404. OXYGEN (/neon2/) returns 500. HELIUM (/1movies/) not tested.
- VidNest vidnest.net NXDOMAIN — moved to vidnest.fun.
- Cloudflare Turnstile on multiembed.mov — FlareSolverr container downloaded but Turnstile not being solved.
- VidSrc Mirror (vidsrc.wtf) JS chunks renamed — old chunks return 301.
- VidEasy source API requires DDOS-Guard session cookies + correct auth token.

# Critical Context
- VidKing seeds expire every 30s (ttlMs: 30000). Must re-fetch seed before each decryption.
- Cloudnestra JWT tokens expire ~4h, per-IP (`ip_cidr` claim). Token replaces `__TOKEN__` in HLS master.
- Shadowlemon.site (VidKing CDN) serves HLS segments directly with no auth on `/r2/cdn2/{token}/{quality}/index.m3u8`.
- XPass has 10+ fallback servers — all use `play.xpass.top/mdata/{hash}/{quality}/playlist.json`.
- VidNest HLS URLs are time-limited token-based (expire after redirect).
- VidEasy auth token (property `b35ebba4`) computed in Next.js player chunks, not landing page.
- streamingnow.mov 621KB encrypted payload uses custom base64 + XOR. XOR key is `xR9tB2pL6q7MwVe`.
- 111Movies RC4 key is array-index-dependent, stored in anti-tamper bytecode.
- VidFast bytecode VM in chunk 365 prevents static extraction of exact API URL.

# Next Steps
1. **Implement VidSrc Mirror scraper** — FlareSolverr → `api.vidsrc.wtf/source/{type}/{id}` → immediate m3u8 fetch.
2. **Update VidNest in server-store.ts** — integrate custom-base64 decrypt for the 10 API endpoints.
3. **VidFast / VidNest** — run Playwright once, capture first `.m3u8` or `/api/` XHR after play click.
4. **VidEasy** — FlareSolverr session on `www.videasy.to/movie/{id}` → copy cookies → retry `users.videasy.to/api/source/{id}` with full browser headers.
5. **streamingnow.mov** — solve Turnstile or run the second-layer deobfuscation (ROT12 + string swap).
6. **111Movies** — extract RC4 key from bytecode arrays, decrypt SSR `_data` to get API path.
7. **SuperEmbed** — try FlareSolverr v2 session mode or headed browser; Turnstile is the blocker.
8. **VidKing HELIUM** — try `/1movies/sources-with-title` with same seed+enc scheme.
9. Search vidsrc.wtf new chunks for `sourcesReq` and API endpoint patterns.

# Relevant Files
- `lib/stores/server-store.ts` — Source-of-truth for all 9 provider definitions and Zustand store.
- `/tmp/vidking_fixed.mjs` — Working Node.js decryption of VidKing HYDROGEN/LITHIUM sources.
- `/tmp/scrape_env` — Python venv with cloudscraper + flaresolverr.
- `/tmp/scrape_results.json` — Partial results from initial scraping.
- `/tmp/cloudnestra_iframe.html` — Cloudnestra player page (51KB) with `master_urls` variable.
- `/tmp/streamingnow_good.html` — 663KB page with 621KB encrypted player payload.
- `/tmp/sn_decoder.js` — 617KB JS decoder extracted from streamingnow payload.
- `/tmp/complete_decrypt.py` — Complete streamingnow.mov decryption script (XOR `xR9tB2pL6q7MwVe`).
- `/tmp/solve_streamingnow4.py` — Most complete streamingnow solver.
- `/tmp/111movies_279.js` — 275KB 111Movies player component with RC4 cipher + string table.
- `/tmp/111movies_FastStreamClient.mjs` — 28KB core streaming client library.
- `/tmp/111movies_VideoSource.mjs` — Video source handler.
- `/tmp/vidfast_365v2.js` — 2.5MB VidFast chunk with hls.js + custom VM obfuscation.
- `/tmp/vidfast_213v2.js` — 284KB chunk with Fluid Player logic.
- `/tmp/decode_strings.js` — VidFast string table decoder (`st()`/`i8()`).
- `/tmp/vidsrc_fd9d1056.js` — 692KB vidsrc.wtf chunk.
- `/tmp/vidsrc_117.js` — 374KB vidsrc.wtf chunk.
- `/tmp/vn_d40206678750dc11.js` — VidNest custom-base64 decrypt function.
- `/tmp/vidnest_chunk.js` — VidNest server config (10 servers, endpoint paths).
- `/tmp/check_all_vn.mjs` — VidNest multi-server custom-base64 decrypt script.
- `/tmp/vidnest_fun.html` — 43KB VidNest landing page with API docs.
- `/tmp/vidnest_movie.html` — 15KB VidNest movie player page.
- `/tmp/videasy_www.html` — 2.7KB VidEasy landing page (Vite SPA).
- `/tmp/videasy_player.html` — 17KB VidEasy player page (Next.js, build `2uPQ441y43v3LxpRvgNM4`).
- `/tmp/videasy_movie.js` — VidEasy Next.js page chunk with auth token computation.
- `/tmp/unlockr.js` — 367KB unlockr.app paywall widget (loaded by 111Movies).
- `/tmp/vidsrc_api1.html` — VidSrc Next.js RSC page.
- `/tmp/vidsrc_46.js` — vidsrc.wtf chunk with `multilang-api` URL prefix.
- `/tmp/vidsrc_layout.js` — vidsrc.wtf layout chunk with string obfuscation.


# Anime Scraper Viability Report

I probed every site you listed using the same bar as `SCRAPING.md`: **direct `.m3u8` / `playlist.json` / CDN manifest URLs**, not embed shells. Four subagents ran deep curls, API discovery, FlareSolverr checks, and Consumet/library cross-reference. I re-verified the top picks locally.

---

## Overall ranking (scrape viability)

| Rank | Site | Score | Tier | Live domain | Direct stream? |
|------|------|-------|------|-------------|----------------|
| 1 | **AnimeOnsen** | **9/10** | EXCELLENT | `animeonsen.xyz` | ✅ DASH `.mpd` via OAuth API |
| 1 | **KickAssAnime** | **9/10** | EXCELLENT | `kaa.lt` | ✅ `master.m3u8` via JSON API |
| 1 | **AniZone** | **9/10** | EXCELLENT | `anizone.to` | ✅ `master.m3u8` in SSR HTML |
| 4 | **AllManga** | **8/10** | EXCELLENT | `allmanga.to` | ✅ after AES decrypt of `tobeparsed` |
| 5 | **AnimeStream** | **7/10** | GOOD | `animestream.my.id` | ✅ via `/player` wrapper → m3u8 |
| 5 | **AnimeGG** | **7/10** | GOOD | `animegg.org` | ✅ direct MP4 on vidcache CDN |
| 7 | **AnimePahe** | **6/10** | GOOD | `animepahe.pw` | ⚠️ Kwik unpacker + FlareSolverr |
| 7 | **AnimeX** | **6/10** | GOOD (meta) / FAIR (streams) | `animex.one` | ❌ client-side via `pp.animex.one` |
| 7 | **Miruro** | **6/10** | FAIR | `miruro.tv` | ❌ CF + vault pipe obfuscation |
| 7 | **Re:ANIME** | **6/10** | FAIR | `reanime.to` | ❌ auth-gated API + flixcloud decrypt |
| 7 | **Anibd** | **6/10** | FAIR | `anibd.app` | ⚠️ `eng.animeapps.top` API, needs RE |
| 11 | **Luna** | **5/10** | FAIR | `luna-stream.me` | ❌ multi-provider aggregator |
| 11 | **AniNeko** | **5/10** | FAIR | `anineko.to` | ❌ obfuscated JS ajax |
| 13 | **Anikoto** | **4/10** | POOR | `anikototv.to` / `.cz` | ❌ MegaPlay/HiAnime embed chain |
| 14 | **Animeverse** | **3/10** | POOR | `.me` only | ❌ signed `tryembed.us.cc` iframe |
| 15 | **AnimeDunya** | **2/10** | DEAD | infra down | ❌ |
| 15 | **AniLight** | **1/10** | DEAD | `anilight.live` | ❌ discovery-only, no streams |
| 15 | **Aniwave / HiAnime** | **1/10** | DEAD | parking / shutdown | ❌ |
| 15 | **AnimeVerse (.to)** | **1/10** | DEAD | shutdown notice | ❌ |
| — | **AniDB** | **0/10** | N/A | metadata only | ❌ never streams |

---

## Tier 1 — implement first

### AnimeOnsen (9/10) — cleanest API
- **OAuth** at `auth.animeonsen.xyz` with public client credentials (verified working)
- **REST:** search → episodes → `uri.stream` → `cdn.animeonsen.xyz/.../manifest.mpd`
- **No CF, no browser, no embed**
- **Caveat:** DASH (`.mpd`), not HLS — player needs DASH support or transmux

### KickAssAnime (9/10) — best curl-only HLS
```
POST kaa.lt/api/fsearch → slug
GET  kaa.lt/api/show/{slug}/episodes → episode ID
GET  kaa.lt/api/show/{slug}/episode/{id} → cat-player URL
Parse props.manifest[1] → master.m3u8 on hls.krussdomi.com
```
- API has **no Cloudflare** — plain curl works (verified Naruto search)
- Same pattern as VidKing in your docs: API → parse → direct HLS
- Consumet's `@consumet/extensions` KickAssAnime provider works with `baseUrl: 'https://kaa.lt'`

### AniZone (9/10) — easiest HTML scrape
Verified live:
```
https://anizone.to/anime/uyyyn4kf/1
→ https://seiryuu.vid-cdn.xyz/.../master.m3u8
```
- **m3u8 in SSR HTML** — no auth, CDN works without Referer
- Laravel + Vidstack; search → opaque slug → episode page → regex extract
- Fits your existing scrape pipeline with minimal code

---

## Tier 2 — solid but more work

### AllManga (8/10)
- GraphQL at `api.allanime.day/api` — search/show queries work
- Episode streams in encrypted `tobeparsed` field (AES-256, key from reversed `"anbbpo"` — documented in ani-cli)
- After decrypt: filter `sourceUrls` for `m3u8`/`mp4`
- Best anime-native API after AnimeOnsen; decryption is the only blocker

### AnimeStream (7/10)
- **Live at `animestream.my.id`** (`.to` is dead/for-sale)
- Episode pages have base64 `data-url` server buttons
- Decode → `/player?url=...` → `master.m3u8` on tikungan CDN (verified One Piece ep 1)
- One hop, similar to XPass pattern in your docs

### AnimeGG (7/10)
- Embed page exposes `videoSources` with `/play/{id}/video.mp4`
- 302 → `vidcache.net` direct MP4 (not HLS)
- Viable if your player supports progressive MP4

### AnimePahe (6/10)
- Real site: `animepahe.pw` (`.com` redirects there)
- JSON API behind **Cloudflare Turnstile** — FlareSolverr required
- Streams via **kwik.cx** embeds — Consumet's Kwik unpacker is **broken** on current format
- Many phishing clones (`.ch`, `.ng`) — avoid
- Your VidNest `animepahe` proxy returned 502 during testing

---

## Tier 3 — alive but hard

| Site | Why it's hard |
|------|---------------|
| **AnimeX** | Public GraphQL for catalog (`graphql.animex.one/graphql`); streams via `pp.animex.one` scraper nodes client-side + Turnstile |
| **Miruro** | CF on everything; streams via `vault01/02.ultracloud.cc` pipe obfuscation; no SSR m3u8 |
| **Re:ANIME** | Public metadata API; stream endpoints return **401**; flixcloud.cc WASM decrypt needed |
| **Anibd** | `eng.animeapps.top` search API works; episode stream format (`api2.php?epid=`) needs JS RE |
| **Luna** | Next.js aggregator over megaplay/aniwaves/animepahe/anizone — scrape underlying providers instead |
| **AniNeko** | 277KB obfuscated `all.js`; no public API; CF |
| **Anikoto** | Embed aggregator (MegaPlay/HiAnime); ajax needs session/CSRF; domains rotating |

---

## Dead / skip

| Site | Status |
|------|--------|
| **AniLight** | Discovery/tracker only — watch routes 404, no streams |
| **Aniwave / HiAnime** | Shut down Mar 2026; `aniwave.to` is a for-sale parking page |
| **AnimeVerse (.to)** | Shutdown notice — migrating to "Shiro" |
| **AnimeDunya** | Origin 521; only a landing page survives |
| **AniDB** | Metadata DB only — useful for AniList/TMDB mapping, not playback |
| **Animeverse (.me)** | Different site — embed-only via signed `tryembed.us.cc` API |

---

## Architecture comparison (vs your existing providers)

```
AniZone / KAA:     curl → direct m3u8          (like VidKing)
AnimeOnsen:        OAuth API → manifest.mpd    (like VidKing but DASH)
AllManga:          GraphQL → AES decrypt → m3u8 (like VidKing decrypt)
AnimeStream:       HTML → /player → m3u8        (like XPass one-hop)
AnimePahe:         FlareSolverr → Kwik JS       (like streamingnow.mov)
Miruro / Re:ANIME: CF + client decrypt          (like VidEasy / vidsrc.wtf)
Luna / Anikoto:    embed aggregators            (like VidSrc embeds — avoid)
```

---

## Recommended integration order for NyumatFlix

1. **AniZone** — fastest win; regex m3u8 from episode HTML
2. **KickAssAnime** — port Consumet provider with `kaa.lt` baseUrl
3. **AnimeOnsen** — OAuth token cache + DASH player support
4. **AllManga** — port ani-cli `tobeparsed` decrypt
5. **AnimeStream** — base64 `data-url` → `/player` chain
6. **AnimePahe** — only after fixing Kwik unpacker or FlareSolverr session flow

**Skip entirely:** AniLight, Aniwave, AnimeVerse (.to), AnimeDunya, AniDB (for streams), Luna (scrape megaplay/animepahe directly instead).

---

## Luna's provider map (useful context)

Luna's JS bundles reference these as upstream sources — if you want what Luna uses without wrapping Luna:

| Luna codename | Underlying provider |
|---------------|---------------------|
| Zenith | megaplay |
| Nova | aniwaves (dead) |
| Orbit | animepahe |
| Lunar | anizone |
| — | animeheaven, anidb, allanime, anineko, animeverse |

So Luna is essentially a UI over the same sites above — **AniZone + AnimePahe + megaplay** are the real targets.

---

Want me to prototype scrapers for the top 3 (AniZone, KickAssAnime, AnimeOnsen) in `lib/scrape/providers/`?
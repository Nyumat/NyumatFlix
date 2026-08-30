#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const TMDB_ID = 900667;
const ANILIST_ID = 141902;
const QUERY = "One Piece Film Red";

const { scrapeFetch, scrapeFetchText } = await import(
  "../lib/scrape/fetch.ts"
);
const { scrapeVidKing } = await import("../lib/scrape/providers/vidking.ts");
const { scrapeVixsrc } = await import("../lib/scrape/providers/vixsrc.ts");
const { scrapeKyren } = await import("../lib/scrape/anime/providers/kyren.ts");
const { scrapeAllmanga } = await import(
  "../lib/scrape/anime/providers/allmanga.ts"
);
const { scrapeAnimepahe } = await import(
  "../lib/scrape/anime/providers/animepahe.ts"
);
const { resolveAnimeSearchQueries } = await import(
  "../lib/scrape/anime/anilist-meta.ts"
);

console.log("Proxy:", process.env.SCRAPE_PROXY_URL ?? "(none)");
console.log("VPN control:", process.env.SCRAPE_VPN_CONTROL_URL ?? "(none)");
console.log("Flaresolverr:", process.env.FLARESOLVERR_URL ?? "(none)\n");

// --- vidking ---
console.log("=== VIDKING ===");
const seedRes = await scrapeFetch(
  `https://api.wingsdatabase.com/seed?mediaId=${TMDB_ID}`,
  {
    headers: {
      Origin: "https://www.vidking.net",
      Referer: "https://www.vidking.net/",
    },
  },
);
console.log("seed status:", seedRes.status);
const seedJson = seedRes.ok ? await seedRes.json() : null;
console.log("seed:", seedJson);
if (seedJson?.seed) {
  for (const ep of [
    "neon2/sources-with-title",
    "cdn/sources-with-title",
    "downloader2/sources-with-title",
    "tejo/sources-with-title",
    "1movies/sources-with-title",
  ]) {
    const params = new URLSearchParams({
      tmdbId: String(TMDB_ID),
      mediaType: "movie",
      imdbId: "",
      enc: "2",
      seed: seedJson.seed,
    });
    try {
      const r = await scrapeFetch(
        `https://api.wingsdatabase.com/${ep}?${params}`,
        {
          headers: {
            Origin: "https://www.vidking.net",
            Referer: "https://www.vidking.net/",
          },
          timeoutMs: 12_000,
        },
      );
      const text = r.ok ? (await r.text()).slice(0, 120) : "";
      console.log(
        `  ${ep}: ${r.status} len=${text.length} preview=${text.slice(0, 60)}`,
      );
    } catch (error) {
      console.log(
        `  ${ep}: ERROR ${error instanceof Error ? error.message.slice(0, 80) : "failed"}`,
      );
    }
  }
}
const vk = await scrapeVidKing({ mediaType: "movie", tmdbId: TMDB_ID });
console.log("scrapeVidKing:", vk.ok ? "OK" : vk.error);

// --- vixsrc ---
console.log("\n=== VIXSRC ===");
const vxUrl = `https://vixsrc.to/api/movie/${TMDB_ID}`;
const vx = await scrapeFetchText(vxUrl, {
  Accept: "application/json",
  Referer: "https://vixsrc.to/",
  Origin: "https://vixsrc.to",
});
console.log("api status:", vx.status, "body:", vx.text.slice(0, 200));
const vxScrape = await scrapeVixsrc({ mediaType: "movie", tmdbId: TMDB_ID });
console.log("scrapeVixsrc:", vxScrape.ok ? "OK" : vxScrape.error);
// try fight club for comparison
const fc = await scrapeFetchText("https://vixsrc.to/api/movie/550", {
  Accept: "application/json",
  Referer: "https://vixsrc.to/",
  Origin: "https://vixsrc.to",
});
console.log("Fight Club api:", fc.status);

// --- kyren ---
console.log("\n=== KYREN ===");
const ky = await scrapeKyren({
  anilistId: ANILIST_ID,
  episodeNumber: 1,
  query: QUERY,
});
console.log("scrapeKyren:", ky.ok ? "OK" : ky.error);

// --- allmanga ---
console.log("\n=== ALLMANGA ===");
const am = await scrapeAllmanga({
  anilistId: ANILIST_ID,
  episodeNumber: 1,
  query: QUERY,
});
console.log("scrapeAllmanga:", am.ok ? "OK" : am.error);

const expected = await resolveAnimeSearchQueries({
  anilistId: ANILIST_ID,
  episodeNumber: 1,
  query: QUERY,
});
console.log("expected titles:", expected);

// --- animepahe ---
console.log("\n=== ANIMEPAHE ===");
for (const origin of ["https://animepahe.ch", "https://animepahe.ng"]) {
  for (const q of expected) {
    const search = await scrapeFetchText(
      `${origin}/api?m=search&q=${encodeURIComponent(q)}`,
      { Referer: `${origin}/` },
    );
    console.log(
      `${origin} search "${q}":`,
      search.status,
      search.text.slice(0, 400),
    );
  }
}
const ap = await scrapeAnimepahe({
  anilistId: ANILIST_ID,
  episodeNumber: 1,
  query: QUERY,
});
console.log("scrapeAnimepahe:", ap.ok ? "OK" : ap.error);

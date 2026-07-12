#!/usr/bin/env node
/**
 * Direct provider verification (no Next.js server required).
 * Usage: npx tsx scripts/verify-anime-scrape-direct.mts
 *
 * Loads .env then .env.local before importing scrapers (ESM import hoisting
 * would otherwise read TMDB_API_KEY / SCRAPE_PROXY_URL too early).
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { AnimeScrapeProviderId } from "../lib/scrape/anime/types.ts";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");

const CASES: Array<{
  label: string;
  providerId: AnimeScrapeProviderId;
  input: {
    anilistId: number;
    episodeNumber: number;
    query?: string;
  };
}> = [
  {
    label: "JustAnime / One Piece ep1",
    providerId: "justanime",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "AniKitty / One Piece ep1",
    providerId: "anikitty",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "AnimeParadise / One Piece ep1",
    providerId: "animeparadise",
    input: { anilistId: 21, episodeNumber: 1, query: "One Piece" },
  },
  {
    label: "Kyren / One Piece ep1",
    providerId: "kyren",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "AniKuro / One Piece ep1",
    providerId: "anikuro",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "AniZone / One Piece ep1",
    providerId: "anizone",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "KickAssAnime / One Piece ep1",
    providerId: "kickassanime",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "AnimeOnsen / Frieren ep1",
    providerId: "animeonsen",
    input: { anilistId: 101922, episodeNumber: 1 },
  },
  {
    label: "AllManga / One Piece ep1",
    providerId: "allmanga",
    input: { anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "AnimeStream / One Piece ep1",
    providerId: "animestream",
    input: { anilistId: 21, episodeNumber: 1, query: "One Piece" },
  },
  {
    label: "AnimeGG / Naruto ep1",
    providerId: "animegg",
    input: { anilistId: 20, episodeNumber: 1, query: "Naruto" },
  },
  {
    label: "AnimePahe / One Piece ep1168",
    providerId: "animepahe",
    input: { anilistId: 21, episodeNumber: 1168, query: "One Piece" },
  },
];

const main = async () => {
  console.log("Direct anime scrape verification");
  console.log(
    `SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}\n`,
  );

  let ok = 0;

  for (const testCase of CASES) {
    const started = Date.now();
    const result = await scrapeAnimeProvider(
      testCase.providerId,
      testCase.input,
    );
    const elapsed = Date.now() - started;

    if (result.ok) {
      ok += 1;
      const meta = [
        result.subtitles?.length ? `subs=${result.subtitles.length}` : "subs=0",
        result.qualities?.length
          ? `qualities=${result.qualities.length}`
          : "qualities=0",
        result.preferredAudioLang ? `audio=${result.preferredAudioLang}` : null,
        result.audioVersions?.length
          ? `versions=${result.audioVersions.length}`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(
        `✓ ${testCase.label} (${elapsed}ms) [${result.streamKind}] ${meta} ${result.streamUrl.slice(0, 90)}...`,
      );
    } else {
      console.log(`✗ ${testCase.label} (${elapsed}ms) -> ${result.error}`);
    }
  }

  console.log(`\nResults: ${ok}/${CASES.length}`);

  if (ok === 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

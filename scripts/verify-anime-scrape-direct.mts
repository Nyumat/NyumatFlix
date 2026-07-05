#!/usr/bin/env node
/**
 * Direct provider verification (no Next.js server required).
 * Usage: npx tsx scripts/verify-anime-scrape-direct.mts
 */

import { scrapeAnimeProvider } from "../lib/scrape/anime/index.ts";
import type { AnimeScrapeProviderId } from "../lib/scrape/anime/types.ts";

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
    label: "AnimePahe / Naruto ep1 (FlareSolverr)",
    providerId: "animepahe",
    input: { anilistId: 20, episodeNumber: 1, query: "Naruto" },
  },
];

const main = async () => {
  console.log("Direct anime scrape verification\n");

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
      console.log(
        `✓ ${testCase.label} (${elapsed}ms) [${result.streamKind}] ${result.streamUrl.slice(0, 90)}...`,
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

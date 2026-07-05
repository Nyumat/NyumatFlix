#!/usr/bin/env node

const BASE_URL = process.env.SCRAPE_TEST_BASE_URL ?? "http://localhost:3000";

const CASES = [
  {
    label: "One Piece ep1 / AniZone",
    body: { providerId: "anizone", anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "One Piece ep1 / KickAssAnime",
    body: { providerId: "kickassanime", anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "Frieren ep1 / AnimeOnsen",
    body: { providerId: "animeonsen", anilistId: 101922, episodeNumber: 1 },
  },
  {
    label: "One Piece ep1 / AllManga",
    body: { providerId: "allmanga", anilistId: 21, episodeNumber: 1 },
  },
  {
    label: "One Piece ep1 / AnimeStream",
    body: {
      providerId: "animestream",
      anilistId: 21,
      episodeNumber: 1,
      query: "One Piece",
    },
  },
  {
    label: "Naruto ep1 / AnimeGG",
    body: {
      providerId: "animegg",
      anilistId: 20,
      episodeNumber: 1,
      query: "Naruto",
    },
  },
  {
    label: "Naruto ep1 / AnimePahe (FlareSolverr)",
    body: {
      providerId: "animepahe",
      anilistId: 20,
      episodeNumber: 1,
      query: "Naruto",
    },
  },
];

const postAnimeScrape = async (body) => {
  const response = await fetch(`${BASE_URL}/api/scrape/anime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return response.json();
};

const main = async () => {
  console.log(`Anime scrape verification against ${BASE_URL}\n`);

  let successes = 0;

  for (const testCase of CASES) {
    const started = Date.now();
    try {
      const result = await postAnimeScrape(testCase.body);
      const elapsed = Date.now() - started;

      if (result.ok) {
        successes += 1;
        console.log(
          `✓ ${testCase.label} (${elapsed}ms) [${result.streamKind}] -> ${result.playUrl?.slice(0, 80)}...`,
        );
      } else {
        console.log(
          `✗ ${testCase.label} (${elapsed}ms) -> ${result.error ?? "unknown error"}`,
        );
      }
    } catch (error) {
      console.log(
        `✗ ${testCase.label} -> ${error instanceof Error ? error.message : "request failed"}`,
      );
    }
  }

  console.log(`\nResults: ${successes}/${CASES.length} providers succeeded`);

  if (successes === 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

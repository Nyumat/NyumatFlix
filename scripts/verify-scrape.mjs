#!/usr/bin/env node

const TMDB_IDS = [550, 27205, 603];
const BASE_URL = process.env.SCRAPE_TEST_BASE_URL ?? "http://localhost:3000";

const providers = ["vidking", "vidsrc", "2embed"];

const postScrape = async (providerId, tmdbId) => {
  const response = await fetch(`${BASE_URL}/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId,
      mediaType: "movie",
      tmdbId,
    }),
  });

  return response.json();
};

const main = async () => {
  console.log(`Scrape verification against ${BASE_URL}\n`);

  let successes = 0;
  let attempts = 0;

  for (const tmdbId of TMDB_IDS) {
    console.log(`TMDB ${tmdbId}`);
    for (const providerId of providers) {
      attempts += 1;
      const started = Date.now();
      try {
        const result = await postScrape(providerId, tmdbId);
        const elapsed = Date.now() - started;

        if (result.ok) {
          successes += 1;
          console.log(
            `  ✓ ${providerId} (${elapsed}ms) -> ${result.playUrl?.slice(0, 72)}...`,
          );
        } else {
          console.log(
            `  ✗ ${providerId} (${elapsed}ms) -> ${result.error ?? "unknown error"}`,
          );
        }
      } catch (error) {
        console.log(
          `  ✗ ${providerId} -> ${error instanceof Error ? error.message : "request failed"}`,
        );
      }
    }
    console.log("");
  }

  console.log(`Results: ${successes}/${attempts} provider attempts succeeded`);

  if (successes < TMDB_IDS.length) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

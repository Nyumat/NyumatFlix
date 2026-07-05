import { scrapeProvider } from "../lib/scrape/index.js";
import { SCRAPE_PROVIDER_ORDER } from "../lib/scrape/types.js";

const TMDB_IDS = [550, 27205, 603];

const main = async () => {
  console.log("Direct scraper verification\n");

  let successes = 0;
  let attempts = 0;

  for (const tmdbId of TMDB_IDS) {
    console.log(`TMDB ${tmdbId}`);

    for (const providerId of SCRAPE_PROVIDER_ORDER) {
      attempts += 1;
      const started = Date.now();

      try {
        const result = await scrapeProvider(providerId, {
          mediaType: "movie",
          tmdbId,
        });
        const elapsed = Date.now() - started;

        if (result.ok) {
          successes += 1;
          console.log(
            `  ✓ ${providerId} (${elapsed}ms)\n    ${result.streamUrl.slice(0, 96)}...`,
          );
        } else {
          console.log(`  ✗ ${providerId} (${elapsed}ms) -> ${result.error}`);
        }
      } catch (error) {
        console.log(
          `  ✗ ${providerId} -> ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }

    console.log("");
  }

  console.log(`Results: ${successes}/${attempts} provider attempts succeeded`);

  const movieSuccessCounts = new Map<number, number>();

  for (const tmdbId of TMDB_IDS) {
    let count = 0;
    for (const providerId of SCRAPE_PROVIDER_ORDER) {
      const result = await scrapeProvider(providerId, {
        mediaType: "movie",
        tmdbId,
      });
      if (result.ok) count += 1;
    }
    movieSuccessCounts.set(tmdbId, count);
    console.log(
      `TMDB ${tmdbId}: ${count}/${SCRAPE_PROVIDER_ORDER.length} providers`,
    );
  }

  const moviesWithWorkingSource = [...movieSuccessCounts.values()].filter(
    (count) => count > 0,
  ).length;

  if (moviesWithWorkingSource < TMDB_IDS.length) {
    process.exitCode = 1;
    console.error(
      `\nExpected at least one working provider per movie. Got ${moviesWithWorkingSource}/${TMDB_IDS.length}.`,
    );
  } else {
    console.log(
      `\nAll ${TMDB_IDS.length} TMDB IDs have at least one working provider.`,
    );
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

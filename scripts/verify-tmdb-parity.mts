#!/usr/bin/env node
/**
 * Probe TMDB scrape providers for Avengers + Stranger Things metadata.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeProvider } = await import("../lib/scrape/index.ts");
const { SCRAPE_PROVIDER_ORDER } = await import("../lib/scrape/types.ts");

const CASES = [
  {
    label: "Avengers",
    input: { mediaType: "movie" as const, tmdbId: 24428 },
  },
  {
    label: "Stranger Things S1E1",
    input: {
      mediaType: "tv" as const,
      tmdbId: 66732,
      seasonNumber: 1,
      episodeNumber: 1,
    },
  },
];

const main = async () => {
  for (const testCase of CASES) {
    console.log(`\n=== ${testCase.label} ===`);
    for (const providerId of SCRAPE_PROVIDER_ORDER) {
      const started = Date.now();
      const result = await scrapeProvider(providerId, testCase.input);
      const ms = Date.now() - started;
      if (!result.ok) {
        console.log(`✗ ${providerId} (${ms}ms) ${result.error}`);
        continue;
      }
      console.log(
        `✓ ${providerId} (${ms}ms)` +
          ` subs=${result.subtitles?.length ?? 0}` +
          ` qualities=${result.qualities?.length ?? 0}` +
          ` versions=${result.audioVersions?.length ?? 0}` +
          ` url=${result.streamUrl.slice(0, 80)}`,
      );
      if (result.qualities?.length) {
        const linked = result.qualities.filter(
          (q) => (q.subtitles?.length ?? 0) > 0,
        );
        console.log(
          `    qualities: ${result.qualities
            .map(
              (q) =>
                `${q.label}${q.subtitles?.length ? `(${q.subtitles.length}subs)` : ""}`,
            )
            .join(", ")}`,
        );
        if (result.subtitles?.length && linked.length === 0) {
          console.log(
            `    WARN: top-level has ${result.subtitles.length} subs but qualities lack nested sets`,
          );
        }
        const uniqueSubCounts = new Set(
          result.qualities.map((q) => q.subtitles?.length ?? 0),
        );
        if (uniqueSubCounts.size > 1) {
          console.log(
            `    linked-config: per-quality subtitle counts differ → ${[...uniqueSubCounts].join("/")}`,
          );
        }
      }
      if (result.subtitles?.length) {
        console.log(
          `    subs: ${result.subtitles
            .slice(0, 8)
            .map((s) => s.lang)
            .join(" | ")}`,
        );
      }
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

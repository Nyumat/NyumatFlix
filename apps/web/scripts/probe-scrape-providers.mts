/**
 * Live scrape upstream probe (no Next server).
 * Usage: cd apps/web && bun scripts/probe-scrape-providers.mts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeProvider } = await import("../lib/scrape/index.ts");
const { SCRAPE_PROVIDER_ORDER } = await import("../lib/scrape/types.ts");
const { scrapeAnimeProvider, ANIME_SCRAPE_PROVIDER_ORDER } = await import(
  "../lib/scrape/anime/index.ts"
);

type Row = { id: string; ok: boolean; ms: number; detail: string };

const runRow = async (
  id: string,
  fn: () => Promise<{ ok: boolean; error?: string; streamUrl?: string }>,
): Promise<Row> => {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    if (r.ok) {
      return {
        id,
        ok: true,
        ms,
        detail: (r as { streamUrl: string }).streamUrl.slice(0, 100),
      };
    }
    return { id, ok: false, ms, detail: r.error ?? "unknown error" };
  } catch (error) {
    return {
      id,
      ok: false,
      ms: Date.now() - t0,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};

const movieInput = { mediaType: "movie" as const, tmdbId: 550 };
const animeInput = {
  anilistId: 21,
  episodeNumber: 1,
  translationType: "sub" as const,
};

console.log("=== TMDB scrape providers (Fight Club / 550) ===\n");
const tmdbRows: Row[] = [];
for (const providerId of SCRAPE_PROVIDER_ORDER) {
  const row = await runRow(providerId, () =>
    scrapeProvider(providerId, movieInput),
  );
  tmdbRows.push(row);
  console.log(
    `${row.ok ? "OK" : "FAIL"} ${row.id.padEnd(10)} ${String(row.ms).padStart(6)}ms  ${row.detail}`,
  );
}

console.log("\n=== Anime scrape providers (One Piece ep1 / anilist 21) ===\n");
const animeRows: Row[] = [];
for (const providerId of ANIME_SCRAPE_PROVIDER_ORDER) {
  const row = await runRow(providerId, () =>
    scrapeAnimeProvider(providerId, animeInput),
  );
  animeRows.push(row);
  console.log(
    `${row.ok ? "OK" : "FAIL"} ${row.id.padEnd(14)} ${String(row.ms).padStart(6)}ms  ${row.detail}`,
  );
}

const tmdbOk = tmdbRows.filter((r) => r.ok).length;
const animeOk = animeRows.filter((r) => r.ok).length;
console.log(
  `\nSummary: TMDB ${tmdbOk}/${tmdbRows.length}, Anime ${animeOk}/${animeRows.length}`,
);

const failures = [...tmdbRows, ...animeRows].filter((r) => !r.ok);
if (failures.length > 0) {
  console.error("\nFailures:");
  for (const f of failures) {
    console.error(`  - ${f.id}: ${f.detail}`);
  }
  process.exitCode = 1;
}

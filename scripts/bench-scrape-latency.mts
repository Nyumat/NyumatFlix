#!/usr/bin/env node
/**
 * Multi-sample scrape latency bench → p50/p95 + success rate ranking.
 * Usage: npx tsx scripts/bench-scrape-latency.mts
 *
 * Env:
 *   BENCH_ROUNDS=3
 *   BENCH_SCOPE=tmdb|anime|all  (default: all)
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const ROUNDS = Math.max(1, Number(process.env.BENCH_ROUNDS ?? 3) || 3);
const SCOPE = (process.env.BENCH_SCOPE ?? "all").toLowerCase();

const percentile = (sorted: number[], p: number): number | null => {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? null;
};

type Sample = { ok: boolean; ms: number; error?: string };

type ProviderStats = {
  id: string;
  samples: Sample[];
};

const fmtMs = (n: number | null): string =>
  n === null ? "—" : `${Math.round(n)}ms`;

const summarize = (stats: ProviderStats[]) => {
  const rows = stats.map((s) => {
    const oks = s.samples
      .filter((x) => x.ok)
      .map((x) => x.ms)
      .sort((a, b) => a - b);
    const all = s.samples.map((x) => x.ms).sort((a, b) => a - b);
    const success = s.samples.filter((x) => x.ok).length;
    const n = s.samples.length;
    return {
      id: s.id,
      success,
      n,
      rate: n === 0 ? 0 : success / n,
      okP50: percentile(oks, 50),
      okP95: percentile(oks, 95),
      allP50: percentile(all, 50),
      allP95: percentile(all, 95),
    };
  });

  // Rank: success rate first, then success p50 (failures that hang go later via allP95 tiebreak)
  const ranked = [...rows].sort((a, b) => {
    if (b.rate !== a.rate) return b.rate - a.rate;
    const ap = a.okP50 ?? Number.POSITIVE_INFINITY;
    const bp = b.okP50 ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return (
      (a.allP95 ?? Number.POSITIVE_INFINITY) -
      (b.allP95 ?? Number.POSITIVE_INFINITY)
    );
  });

  console.log(
    "\nprovider          ok/n   rate   ok_p50  ok_p95  all_p50 all_p95",
  );
  console.log("-".repeat(72));
  for (const r of ranked) {
    console.log(
      `${r.id.padEnd(16)} ${String(r.success).padStart(2)}/${String(r.n).padEnd(2)}  ${(r.rate * 100).toFixed(0).padStart(3)}%   ${fmtMs(r.okP50).padStart(6)}  ${fmtMs(r.okP95).padStart(6)}  ${fmtMs(r.allP50).padStart(6)}  ${fmtMs(r.allP95).padStart(6)}`,
    );
  }

  console.log("\nRecommended order (success rate ↓, then ok p50 ↑):");
  console.log(ranked.map((r) => r.id).join(" → "));
  return ranked;
};

const benchTmdb = async () => {
  const { scrapeProvider } = await import("../lib/scrape/index.ts");
  const { TMDB_SCRAPE_PROVIDER_ORDER } = await import(
    "../lib/providers/registry.ts"
  );

  const titles = [
    { mediaType: "movie" as const, tmdbId: 550 }, // Fight Club
    { mediaType: "movie" as const, tmdbId: 27205 }, // Inception
    {
      mediaType: "tv" as const,
      tmdbId: 1396,
      seasonNumber: 1,
      episodeNumber: 1,
    }, // Breaking Bad
  ];

  const byProvider = new Map<string, ProviderStats>();
  for (const id of TMDB_SCRAPE_PROVIDER_ORDER) {
    byProvider.set(id, { id, samples: [] });
  }

  console.log(
    `\n=== TMDB scrape bench (${ROUNDS} rounds × ${titles.length} titles × ${TMDB_SCRAPE_PROVIDER_ORDER.length} providers) ===`,
  );
  console.log(`SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}`);

  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`\n-- round ${round}/${ROUNDS} --`);
    for (const title of titles) {
      const label =
        title.mediaType === "tv"
          ? `tv:${title.tmdbId} S${title.seasonNumber}E${title.episodeNumber}`
          : `movie:${title.tmdbId}`;

      for (const providerId of TMDB_SCRAPE_PROVIDER_ORDER) {
        const started = Date.now();
        let sample: Sample;
        try {
          const result = await scrapeProvider(providerId, title);
          const ms = Date.now() - started;
          sample = result.ok
            ? { ok: true, ms }
            : { ok: false, ms, error: result.error };
        } catch (error) {
          sample = {
            ok: false,
            ms: Date.now() - started,
            error: error instanceof Error ? error.message : "failed",
          };
        }
        byProvider.get(providerId)!.samples.push(sample);
        const mark = sample.ok ? "✓" : "✗";
        console.log(
          `  ${mark} ${providerId.padEnd(14)} ${label.padEnd(18)} ${sample.ms}ms${sample.error ? ` -> ${sample.error.slice(0, 80)}` : ""}`,
        );
      }
    }
  }

  return summarize([...byProvider.values()]);
};

const benchAnime = async () => {
  const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");
  const { ANIME_SCRAPE_PROVIDER_ORDER } = await import(
    "../lib/providers/registry.ts"
  );

  // Skip adult-only providers for general ranking
  const providers = ANIME_SCRAPE_PROVIDER_ORDER.filter(
    (id) => id !== "hentaigasm",
  );

  const cases: Array<{
    providerId: (typeof providers)[number];
    input: {
      anilistId: number;
      episodeNumber: number;
      query?: string;
    };
    label: string;
  }> = [
    {
      providerId: "anizone",
      input: { anilistId: 21, episodeNumber: 1 },
      label: "OP ep1",
    },
    {
      providerId: "kickassanime",
      input: { anilistId: 21, episodeNumber: 1 },
      label: "OP ep1",
    },
    {
      providerId: "animestream",
      input: { anilistId: 21, episodeNumber: 1, query: "One Piece" },
      label: "OP ep1",
    },
    {
      providerId: "animeonsen",
      input: { anilistId: 101922, episodeNumber: 1 },
      label: "Frieren ep1",
    },
    {
      providerId: "allmanga",
      input: { anilistId: 21, episodeNumber: 1 },
      label: "OP ep1",
    },
    {
      providerId: "anipm",
      input: { anilistId: 21, episodeNumber: 1, query: "One Piece" },
      label: "OP ep1",
    },
    {
      providerId: "animegg",
      input: { anilistId: 20, episodeNumber: 1, query: "Naruto" },
      label: "Naruto ep1",
    },
    {
      providerId: "animepahe",
      input: { anilistId: 21, episodeNumber: 1, query: "One Piece" },
      label: "OP ep1",
    },
  ].filter((c) => providers.includes(c.providerId));

  const byProvider = new Map<string, ProviderStats>();
  for (const id of providers) {
    byProvider.set(id, { id, samples: [] });
  }

  console.log(
    `\n=== Anime scrape bench (${ROUNDS} rounds × ${cases.length} provider cases) ===`,
  );
  console.log(`SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}`);

  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`\n-- round ${round}/${ROUNDS} --`);
    for (const testCase of cases) {
      const started = Date.now();
      let sample: Sample;
      try {
        const result = await scrapeAnimeProvider(
          testCase.providerId,
          testCase.input,
        );
        const ms = Date.now() - started;
        sample = result.ok
          ? { ok: true, ms }
          : { ok: false, ms, error: result.error };
      } catch (error) {
        sample = {
          ok: false,
          ms: Date.now() - started,
          error: error instanceof Error ? error.message : "failed",
        };
      }
      byProvider.get(testCase.providerId)!.samples.push(sample);
      const mark = sample.ok ? "✓" : "✗";
      console.log(
        `  ${mark} ${testCase.providerId.padEnd(14)} ${testCase.label.padEnd(14)} ${sample.ms}ms${sample.error ? ` -> ${sample.error.slice(0, 80)}` : ""}`,
      );
    }
  }

  return summarize([...byProvider.values()]);
};

const main = async () => {
  console.log("Scrape latency bench");
  console.log(`rounds=${ROUNDS} scope=${SCOPE}`);

  if (SCOPE === "tmdb" || SCOPE === "all") {
    await benchTmdb();
  }
  if (SCOPE === "anime" || SCOPE === "all") {
    await benchAnime();
  }

  console.log(
    "\nNote: sample size is small — treat as directional for registry reorder, not production SLOs.",
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

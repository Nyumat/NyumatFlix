#!/usr/bin/env node
/**
 * Proxy-medium matrix: TMDB + anime scrape providers on one movie, TV ep, anime ep.
 * Usage: npx tsx scripts/verify-proxy-medium-matrix.mts
 */

import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnimeScrapeProviderId } from "../lib/scrape/anime/types.ts";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const MOVIE = { mediaType: "movie" as const, tmdbId: 550, label: "Fight Club" };
const TV = {
  mediaType: "tv" as const,
  tmdbId: 1396,
  seasonNumber: 1,
  episodeNumber: 1,
  label: "Breaking Bad S1E1",
};
type AnimeMatrixCase = {
  anilistId: number;
  episodeNumber: number;
  label: string;
  query?: string;
  note?: string;
};

const GENERAL_ANIME: AnimeMatrixCase = {
  anilistId: 21,
  episodeNumber: 1,
  label: "One Piece ep1",
  query: "One Piece",
};

const ANIME_PROVIDER_CASES: Partial<
  Record<AnimeScrapeProviderId, AnimeMatrixCase>
> = {
  animeonsen: {
    anilistId: 154587,
    episodeNumber: 1,
    label: "Frieren ep1",
    query: "Frieren",
    note: "One Piece is not in AnimeOnsen catalog",
  },
  animepahe: {
    anilistId: 21519,
    episodeNumber: 1,
    label: "Jujutsu Kaisen ep1",
    query: "Jujutsu Kaisen",
    note: "AnimePahe recent-window catalog is flaky for long-running One Piece",
  },
  allmanga: {
    anilistId: 21,
    episodeNumber: 1,
    label: "One Piece ep1",
    query: "One Piece",
  },
  animegg: {
    anilistId: 21519,
    episodeNumber: 1,
    label: "Jujutsu Kaisen ep1",
    query: "Jujutsu Kaisen",
    note: "AnimeGG origin intermittently CF-504s on long-running One Piece pages",
  },
};

const ADULT_ANIME_PROVIDER_CASES: Partial<
  Record<AnimeScrapeProviderId, AnimeMatrixCase>
> = {
  hentaigasm: {
    anilistId: 170913,
    episodeNumber: 1,
    label: "Modaete yo, Adam-kun ep1",
    note: "Adult title required for hentaigasm eligibility",
  },
};

const EXCLUDED_FROM_GENERAL_ANIME_MATRIX = new Set<string>(["hentaigasm"]);

type StrategyName = "proxy-medium" | "product-full" | "remediation";
type Outcome = "success" | "failure";

type Attempt = {
  strategy: StrategyName;
  outcome: Outcome;
  ms: number;
  error?: string;
  streamPreview?: string;
};

type ProviderResult = {
  providerId: string;
  mediaKey: string;
  attempts: Attempt[];
  finalOutcome: Outcome;
  winningStrategy?: StrategyName;
};

type MatrixReport = {
  generatedAt: string;
  proxyUrl: string | null;
  movie: typeof MOVIE;
  tv: typeof TV;
  anime: AnimeMatrixCase;
  animeProviderCases: typeof ANIME_PROVIDER_CASES;
  adultAnimeProviderCases: typeof ADULT_ANIME_PROVIDER_CASES;
  results: ProviderResult[];
  summary: {
    total: number;
    successes: number;
    failures: number;
    byMedia: Record<string, { ok: number; total: number }>;
  };
};

const { scrapeProvider } = await import("../lib/scrape/index.ts");
const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");
const { SCRAPE_PROVIDER_ORDER } = await import("../lib/scrape/types.ts");
const { ANIME_SCRAPE_PROVIDER_ORDER } = await import(
  "../lib/providers/registry.ts"
);
const { validateStreamUrlWithReferers } = await import(
  "../lib/scrape/validate-stream.ts"
);
const { scrapeVidKing } = await import("../lib/scrape/providers/vidking.ts");
const { scrapeVidNest } = await import("../lib/scrape/providers/vidnest.ts");
const { scrapeVidSrc } = await import("../lib/scrape/providers/vidsrc.ts");
const { scrapeXPass } = await import("../lib/scrape/providers/xpass.ts");
const { scrapeVixsrc } = await import("../lib/scrape/providers/vixsrc.ts");
const { scrapeVidrock } = await import("../lib/scrape/providers/vidrock.ts");
const { scrapeBingr } = await import("../lib/scrape/providers/bingr.ts");
const { scrapeAnimestream } = await import(
  "../lib/scrape/anime/providers/animestream.ts"
);
const { scrapeAnimegg } = await import(
  "../lib/scrape/anime/providers/animegg.ts"
);
const { scrapeAnimeonsen } = await import(
  "../lib/scrape/anime/providers/animeonsen.ts"
);
const { scrapeAnimepahe } = await import(
  "../lib/scrape/anime/providers/animepahe.ts"
);
const { scrapeAllmanga } = await import(
  "../lib/scrape/anime/providers/allmanga.ts"
);
const { scrapeAnizone } = await import(
  "../lib/scrape/anime/providers/anizone.ts"
);
const { scrapeAnipm } = await import("../lib/scrape/anime/providers/anipm.ts");
const { scrapeHentaigasm } = await import(
  "../lib/scrape/anime/providers/hentaigasm.ts"
);
const { scrapeKickassanime } = await import(
  "../lib/scrape/anime/providers/kickassanime.ts"
);
const { scrapeJustanime } = await import(
  "../lib/scrape/anime/providers/justanime.ts"
);
const { scrapeAnikuro } = await import(
  "../lib/scrape/anime/providers/anikuro.ts"
);
const { scrapeKyren } = await import("../lib/scrape/anime/providers/kyren.ts");

const { scrapeVideasy } = await import("../lib/scrape/providers/videasy.ts");
const { scrapeDirect } = await import("../lib/scrape/providers/direct.ts");

const TMDB_SCRAPERS = {
  direct: scrapeDirect,
  bingr: scrapeBingr,
  videasy: scrapeVideasy,
  vidking: scrapeVidKing,
  vidsrc: scrapeVidSrc,
  "2embed": scrapeXPass,
  vidrock: scrapeVidrock,
  vidnest: scrapeVidNest,
  vixsrc: scrapeVixsrc,
} as const;

const ANIME_SCRAPERS = {
  justanime: scrapeJustanime,
  kyren: scrapeKyren,
  anikuro: scrapeAnikuro,
  animeonsen: scrapeAnimeonsen,
  allmanga: scrapeAllmanga,
  animegg: scrapeAnimegg,
  kickassanime: scrapeKickassanime,
  anizone: scrapeAnizone,
  animestream: scrapeAnimestream,
  animepahe: scrapeAnimepahe,
  anipm: scrapeAnipm,
  hentaigasm: scrapeHentaigasm,
} as const;

const inferKind = (url: string): "hls" | "dash" | "mp4" =>
  url.includes(".mpd") ? "dash" : url.includes(".mp4") ? "mp4" : "hls";

const attemptProxyMediumTmdb = async (
  providerId: keyof typeof TMDB_SCRAPERS,
  input:
    | { mediaType: "movie"; tmdbId: number }
    | {
        mediaType: "tv";
        tmdbId: number;
        seasonNumber: number;
        episodeNumber: number;
      },
): Promise<{ ok: boolean; error?: string; streamPreview?: string }> => {
  const scraper = TMDB_SCRAPERS[providerId];
  const result = await scraper(input);
  if (!result.ok || !result.streamUrl) {
    return { ok: false, error: result.error ?? "discover failed" };
  }
  if (result.validated) {
    return { ok: true, streamPreview: result.streamUrl.slice(0, 120) };
  }
  const validation = await validateStreamUrlWithReferers(
    result.streamUrl,
    result.referer ?? "",
    inferKind(result.streamUrl),
    { depth: "master" },
  );
  if (!validation.ok) {
    return { ok: false, error: "master validation failed" };
  }
  return { ok: true, streamPreview: result.streamUrl.slice(0, 120) };
};

const attemptProxyMediumAnime = async (
  providerId: keyof typeof ANIME_SCRAPERS,
  input: { anilistId: number; episodeNumber: number; query?: string },
): Promise<{ ok: boolean; error?: string; streamPreview?: string }> => {
  const scraper = ANIME_SCRAPERS[providerId];
  const result = await scraper(input);
  if (!result.ok || !result.streamUrl) {
    return { ok: false, error: result.error ?? "discover failed" };
  }
  const validation = await validateStreamUrlWithReferers(
    result.streamUrl,
    result.referer ?? "",
    result.streamKind,
    { depth: "master" },
  );
  if (!validation.ok) {
    return { ok: false, error: "master validation failed" };
  }
  return { ok: true, streamPreview: result.streamUrl.slice(0, 120) };
};

const runTimed = async (
  fn: () => Promise<{ ok: boolean; error?: string; streamPreview?: string }>,
): Promise<Attempt> => {
  const started = Date.now();
  try {
    const result = await fn();
    return {
      strategy: "proxy-medium",
      outcome: result.ok ? "success" : "failure",
      ms: Date.now() - started,
      error: result.error,
      streamPreview: result.streamPreview,
    };
  } catch (error) {
    return {
      strategy: "proxy-medium",
      outcome: "failure",
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : "threw",
    };
  }
};

const testTmdbProvider = async (
  providerId: (typeof SCRAPE_PROVIDER_ORDER)[number],
  mediaKey: string,
  input:
    | { mediaType: "movie"; tmdbId: number }
    | {
        mediaType: "tv";
        tmdbId: number;
        seasonNumber: number;
        episodeNumber: number;
      },
): Promise<ProviderResult> => {
  const attempts: Attempt[] = [];

  const s1 = await runTimed(() =>
    attemptProxyMediumTmdb(providerId as keyof typeof TMDB_SCRAPERS, input),
  );
  s1.strategy = "proxy-medium";
  attempts.push(s1);
  if (s1.outcome === "success") {
    return {
      providerId,
      mediaKey,
      attempts,
      finalOutcome: "success",
      winningStrategy: "proxy-medium",
    };
  }

  const started2 = Date.now();
  try {
    const product = await scrapeProvider(providerId, input);
    const s2: Attempt = {
      strategy: "product-full",
      outcome: product.ok ? "success" : "failure",
      ms: Date.now() - started2,
      error: product.ok ? undefined : product.error,
      streamPreview: product.ok ? product.streamUrl.slice(0, 120) : undefined,
    };
    attempts.push(s2);
    if (s2.outcome === "success") {
      return {
        providerId,
        mediaKey,
        attempts,
        finalOutcome: "success",
        winningStrategy: "product-full",
      };
    }
  } catch (error) {
    attempts.push({
      strategy: "product-full",
      outcome: "failure",
      ms: Date.now() - started2,
      error: error instanceof Error ? error.message : "threw",
    });
  }

  const started3 = Date.now();
  try {
    const scraper = TMDB_SCRAPERS[providerId as keyof typeof TMDB_SCRAPERS];
    const discovered = await scraper(input);
    if (!discovered.ok || !discovered.streamUrl) {
      attempts.push({
        strategy: "remediation",
        outcome: "failure",
        ms: Date.now() - started3,
        error: discovered.error ?? "discover failed on remediation",
      });
    } else {
      const validation = await validateStreamUrlWithReferers(
        discovered.streamUrl,
        discovered.referer ?? "",
        inferKind(discovered.streamUrl),
        { depth: "full" },
      );
      attempts.push({
        strategy: "remediation",
        outcome: validation.ok ? "success" : "failure",
        ms: Date.now() - started3,
        error: validation.ok ? undefined : "full validation (no probe) failed",
        streamPreview: validation.ok
          ? discovered.streamUrl.slice(0, 120)
          : undefined,
      });
      if (validation.ok) {
        return {
          providerId,
          mediaKey,
          attempts,
          finalOutcome: "success",
          winningStrategy: "remediation",
        };
      }
    }
  } catch (error) {
    attempts.push({
      strategy: "remediation",
      outcome: "failure",
      ms: Date.now() - started3,
      error: error instanceof Error ? error.message : "threw",
    });
  }

  return { providerId, mediaKey, attempts, finalOutcome: "failure" };
};

const testAnimeProvider = async (
  providerId: (typeof ANIME_SCRAPE_PROVIDER_ORDER)[number],
  animeCase: AnimeMatrixCase,
  mediaKey = "anime",
): Promise<ProviderResult> => {
  const attempts: Attempt[] = [];

  const s1 = await runTimed(() =>
    attemptProxyMediumAnime(providerId as keyof typeof ANIME_SCRAPERS, {
      anilistId: animeCase.anilistId,
      episodeNumber: animeCase.episodeNumber,
      query: animeCase.query,
    }),
  );
  s1.strategy = "proxy-medium";
  attempts.push(s1);
  if (s1.outcome === "success") {
    return {
      providerId,
      mediaKey,
      attempts,
      finalOutcome: "success",
      winningStrategy: "proxy-medium",
    };
  }

  const started2 = Date.now();
  try {
    const product = await scrapeAnimeProvider(providerId, {
      anilistId: animeCase.anilistId,
      episodeNumber: animeCase.episodeNumber,
      query: animeCase.query,
    });
    const s2: Attempt = {
      strategy: "product-full",
      outcome: product.ok ? "success" : "failure",
      ms: Date.now() - started2,
      error: product.ok ? undefined : product.error,
      streamPreview: product.ok ? product.streamUrl.slice(0, 120) : undefined,
    };
    attempts.push(s2);
    if (s2.outcome === "success") {
      return {
        providerId,
        mediaKey,
        attempts,
        finalOutcome: "success",
        winningStrategy: "product-full",
      };
    }
  } catch (error) {
    attempts.push({
      strategy: "product-full",
      outcome: "failure",
      ms: Date.now() - started2,
      error: error instanceof Error ? error.message : "threw",
    });
  }

  const started3 = Date.now();
  try {
    const remediated = await attemptProxyMediumAnime(
      providerId as keyof typeof ANIME_SCRAPERS,
      {
        anilistId: animeCase.anilistId,
        episodeNumber: animeCase.episodeNumber,
        query: animeCase.query ?? GENERAL_ANIME.query,
      },
    );
    attempts.push({
      strategy: "remediation",
      outcome: remediated.ok ? "success" : "failure",
      ms: Date.now() - started3,
      error: remediated.error,
      streamPreview: remediated.streamPreview,
    });
    if (remediated.ok) {
      return {
        providerId,
        mediaKey,
        attempts,
        finalOutcome: "success",
        winningStrategy: "remediation",
      };
    }
  } catch (error) {
    attempts.push({
      strategy: "remediation",
      outcome: "failure",
      ms: Date.now() - started3,
      error: error instanceof Error ? error.message : "threw",
    });
  }

  return { providerId, mediaKey, attempts, finalOutcome: "failure" };
};

const main = async () => {
  console.log("Proxy-medium provider matrix");
  console.log(
    `SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}\n`,
  );

  const results: ProviderResult[] = [];

  console.log(`=== Movie: ${MOVIE.label} (${MOVIE.tmdbId}) ===`);
  for (const providerId of SCRAPE_PROVIDER_ORDER) {
    process.stdout.write(`  ${providerId}... `);
    const result = await testTmdbProvider(providerId, "movie", {
      mediaType: "movie",
      tmdbId: MOVIE.tmdbId,
    });
    results.push(result);
    console.log(
      result.finalOutcome === "success"
        ? `✓ ${result.winningStrategy} (${result.attempts.at(-1)?.ms ?? 0}ms)`
        : `✗ ${result.attempts.map((a) => a.error ?? a.strategy).join(" | ")}`,
    );
  }

  console.log(`\n=== TV: ${TV.label} (${TV.tmdbId}) ===`);
  for (const providerId of SCRAPE_PROVIDER_ORDER) {
    process.stdout.write(`  ${providerId}... `);
    const result = await testTmdbProvider(providerId, "tv", {
      mediaType: "tv",
      tmdbId: TV.tmdbId,
      seasonNumber: TV.seasonNumber,
      episodeNumber: TV.episodeNumber,
    });
    results.push(result);
    console.log(
      result.finalOutcome === "success"
        ? `✓ ${result.winningStrategy} (${result.attempts.at(-1)?.ms ?? 0}ms)`
        : `✗ ${result.attempts.map((a) => a.error ?? a.strategy).join(" | ")}`,
    );
  }

  console.log(
    `\n=== Anime: ${GENERAL_ANIME.label} (anilist ${GENERAL_ANIME.anilistId}) ===`,
  );
  for (const providerId of ANIME_SCRAPE_PROVIDER_ORDER) {
    if (EXCLUDED_FROM_GENERAL_ANIME_MATRIX.has(providerId)) {
      continue;
    }

    const animeCase = ANIME_PROVIDER_CASES[providerId] ?? GENERAL_ANIME;
    const labelSuffix =
      animeCase.label === GENERAL_ANIME.label
        ? ""
        : ` [${animeCase.label}${animeCase.note ? ` — ${animeCase.note}` : ""}]`;

    process.stdout.write(`  ${providerId}${labelSuffix}... `);
    const result = await testAnimeProvider(providerId, animeCase);
    results.push(result);
    console.log(
      result.finalOutcome === "success"
        ? `✓ ${result.winningStrategy} (${result.attempts.at(-1)?.ms ?? 0}ms)`
        : `✗ ${result.attempts.map((a) => a.error ?? a.strategy).join(" | ")}`,
    );
  }

  console.log("\n=== Adult anime providers (separate canaries) ===");
  for (const [providerId, animeCase] of Object.entries(
    ADULT_ANIME_PROVIDER_CASES,
  ) as Array<[AnimeScrapeProviderId, AnimeMatrixCase]>) {
    process.stdout.write(
      `  ${providerId} [${animeCase.label}${animeCase.note ? ` — ${animeCase.note}` : ""}]... `,
    );
    const result = await testAnimeProvider(
      providerId,
      animeCase,
      "anime-adult",
    );
    results.push(result);
    console.log(
      result.finalOutcome === "success"
        ? `✓ ${result.winningStrategy} (${result.attempts.at(-1)?.ms ?? 0}ms)`
        : `✗ ${result.attempts.map((a) => a.error ?? a.strategy).join(" | ")}`,
    );
  }

  const byMedia: MatrixReport["summary"]["byMedia"] = {};
  for (const result of results) {
    const bucket = byMedia[result.mediaKey] ?? { ok: 0, total: 0 };
    bucket.total += 1;
    if (result.finalOutcome === "success") bucket.ok += 1;
    byMedia[result.mediaKey] = bucket;
  }

  const report: MatrixReport = {
    generatedAt: new Date().toISOString(),
    proxyUrl: process.env.SCRAPE_PROXY_URL ?? null,
    movie: MOVIE,
    tv: TV,
    anime: GENERAL_ANIME,
    animeProviderCases: ANIME_PROVIDER_CASES,
    adultAnimeProviderCases: ADULT_ANIME_PROVIDER_CASES,
    results,
    summary: {
      total: results.length,
      successes: results.filter((r) => r.finalOutcome === "success").length,
      failures: results.filter((r) => r.finalOutcome === "failure").length,
      byMedia,
    },
  };

  const outDir = resolve(process.cwd(), "scripts/.cache");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "proxy-medium-matrix.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== Summary ===");
  console.log(
    `${report.summary.successes}/${report.summary.total} providers succeeded`,
  );
  for (const [key, stats] of Object.entries(byMedia)) {
    console.log(`  ${key}: ${stats.ok}/${stats.total}`);
  }
  console.log(`\nWrote ${outPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

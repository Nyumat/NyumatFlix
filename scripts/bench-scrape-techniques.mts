#!/usr/bin/env node
/**
 * Technique comparison: what actually moves scrape latency.
 *
 * Usage:
 *   npx tsx scripts/bench-scrape-techniques.mts
 *   BENCH_ROUNDS=2 BENCH_PROXY=on|off|both npx tsx scripts/bench-scrape-techniques.mts
 *
 * Modes (post-discover):
 *   discover  — raw provider only (no outer validate / no Sub1x2)
 *   master    — discover + master-depth validate
 *   full      — discover + full validate (no Sub1x2)
 *   product   — discover + full validate + Sub1x2 fallback (TMDB path today)
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const ROUNDS = Math.max(1, Number(process.env.BENCH_ROUNDS ?? 2) || 2);
const PROXY_MODE = (process.env.BENCH_PROXY ?? "both").toLowerCase();

type Mode = "discover" | "master" | "full" | "product";
const MODES: Mode[] = ["discover", "master", "full", "product"];

const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? null;
};

const fmt = (n: number | null): string =>
  n === null ? "—" : `${Math.round(n)}ms`;

type Sample = { ok: boolean; ms: number; mode: Mode; label: string };

const summarize = (title: string, samples: Sample[]) => {
  console.log(`\n=== ${title} ===`);
  console.log("mode       ok/n   p50     p95     mean");
  console.log("-".repeat(48));

  for (const mode of MODES) {
    const modeSamples = samples.filter((s) => s.mode === mode);
    const oks = modeSamples.filter((s) => s.ok).map((s) => s.ms);
    const all = modeSamples.map((s) => s.ms);
    const mean =
      all.length === 0 ? null : all.reduce((a, b) => a + b, 0) / all.length;
    console.log(
      `${mode.padEnd(10)} ${String(oks.length).padStart(2)}/${String(modeSamples.length).padEnd(2)}  ${fmt(percentile(oks, 50)).padStart(6)}  ${fmt(percentile(oks, 95)).padStart(6)}  ${fmt(mean).padStart(6)}`,
    );
  }

  const discoverP50 = percentile(
    samples.filter((s) => s.mode === "discover" && s.ok).map((s) => s.ms),
    50,
  );
  const productP50 = percentile(
    samples.filter((s) => s.mode === "product" && s.ok).map((s) => s.ms),
    50,
  );
  if (discoverP50 !== null && productP50 !== null) {
    const overhead = productP50 - discoverP50;
    console.log(
      `\nproduct vs discover p50 overhead: +${Math.round(overhead)}ms (${Math.round((overhead / productP50) * 100)}% of product)`,
    );
  }
};

const runWithProxySetting = async (useProxy: boolean) => {
  if (!useProxy) {
    delete process.env.SCRAPE_PROXY_URL;
  }

  // Fresh imports so modules see current env; proxy agent may still cache if
  // we already imported with proxy — run proxy-off in a separate process when both.
  const { scrapeVidSrc } = await import("../lib/scrape/providers/vidsrc.ts");
  const { scrapeVidsrcMirror } = await import(
    "../lib/scrape/providers/vidsrc-mirror.ts"
  );
  const { scrapeXPass } = await import("../lib/scrape/providers/xpass.ts");
  const { scrapeAnimeonsen } = await import(
    "../lib/scrape/anime/providers/animeonsen.ts"
  );
  const { scrapeAllmanga } = await import(
    "../lib/scrape/anime/providers/allmanga.ts"
  );
  const { validateStreamUrlWithReferers, validateStreamUrl } = await import(
    "../lib/scrape/validate-stream.ts"
  );
  const { fetchSub1x2Subtitles } = await import("../lib/scrape/subtitles.ts");
  const { fetchAnilistMediaMeta } = await import(
    "../lib/scrape/anime/anilist-meta.ts"
  );

  const proxyLabel = useProxy
    ? `proxy=${process.env.SCRAPE_PROXY_URL ?? "(missing)"}`
    : "proxy=off";

  console.log(`\n########## ${proxyLabel} ##########`);

  type TmdbCase = {
    label: string;
    providerId: string;
    scrape: () => Promise<{
      ok: boolean;
      streamUrl?: string;
      referer?: string;
      validated?: boolean;
      subtitles?: unknown[];
      error?: string;
    }>;
    media: {
      mediaType: "movie" | "tv";
      tmdbId: number;
      seasonNumber?: number;
      episodeNumber?: number;
    };
  };

  const tmdbCases: TmdbCase[] = [
    {
      label: "vidsrc/FightClub",
      providerId: "vidsrc",
      media: { mediaType: "movie", tmdbId: 550 },
      scrape: () => scrapeVidSrc({ mediaType: "movie", tmdbId: 550 }),
    },
    {
      label: "vidsrc-mirror/Inception",
      providerId: "vidsrc-mirror",
      media: { mediaType: "movie", tmdbId: 27205 },
      scrape: () => scrapeVidsrcMirror({ mediaType: "movie", tmdbId: 27205 }),
    },
    {
      label: "2embed/FightClub",
      providerId: "2embed",
      media: { mediaType: "movie", tmdbId: 550 },
      scrape: () => scrapeXPass({ mediaType: "movie", tmdbId: 550 }),
    },
  ];

  const tmdbSamples: Sample[] = [];

  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`\n-- TMDB round ${round}/${ROUNDS} --`);
    for (const testCase of tmdbCases) {
      for (const mode of MODES) {
        const started = Date.now();
        let ok = false;
        let err = "";
        try {
          const result = await testCase.scrape();
          if (!result.ok || !result.streamUrl) {
            err = result.error ?? "discover failed";
          } else if (mode === "discover") {
            ok = true;
          } else if (
            result.validated &&
            (mode === "master" || mode === "full")
          ) {
            // Provider already validated internally (2embed/vidnest pattern)
            ok = true;
          } else {
            const depth = mode === "master" ? "master" : "full";
            const validation = await validateStreamUrlWithReferers(
              result.streamUrl,
              result.referer ?? "",
              "hls",
              { depth },
            );
            if (!validation.ok) {
              err = "validate failed";
            } else if (mode === "product") {
              if (!result.subtitles?.length) {
                await fetchSub1x2Subtitles(testCase.media);
              }
              ok = true;
            } else {
              ok = true;
            }
          }
        } catch (error) {
          err = error instanceof Error ? error.message : "failed";
        }
        const ms = Date.now() - started;
        tmdbSamples.push({
          ok,
          ms,
          mode,
          label: testCase.label,
        });
        console.log(
          `  ${ok ? "✓" : "✗"} ${mode.padEnd(8)} ${testCase.label.padEnd(28)} ${ms}ms${err ? ` -> ${err.slice(0, 60)}` : ""}`,
        );
      }
    }
  }

  summarize(`TMDB techniques (${proxyLabel})`, tmdbSamples);

  // Race: first success among top-3 under discover vs product
  console.log(`\n-- TMDB race-of-3 (time to first ok) --`);
  const raceModes: Mode[] = ["discover", "product"];
  const raceSamples: Sample[] = [];

  for (let round = 1; round <= ROUNDS; round += 1) {
    for (const mode of raceModes) {
      const started = Date.now();
      const runners = tmdbCases.map(async (testCase) => {
        const result = await testCase.scrape();
        if (!result.ok || !result.streamUrl) {
          throw new Error(result.error ?? "fail");
        }
        if (mode === "discover") return true;
        if (result.validated) return true;
        const validation = await validateStreamUrlWithReferers(
          result.streamUrl,
          result.referer ?? "",
          "hls",
          { depth: "full" },
        );
        if (!validation.ok) throw new Error("validate failed");
        if (mode === "product" && !result.subtitles?.length) {
          await fetchSub1x2Subtitles(testCase.media);
        }
        return true;
      });

      const winner = await Promise.any(runners).then(
        () => true,
        () => false,
      );
      const ms = Date.now() - started;
      raceSamples.push({ ok: winner, ms, mode, label: "race3" });
      console.log(`  ${winner ? "✓" : "✗"} race/${mode.padEnd(8)} ${ms}ms`);
    }
  }

  summarize(`TMDB race-of-3 (${proxyLabel})`, raceSamples);

  // Anime: discover / master / full (+ anilist duration like product)
  const animeSamples: Sample[] = [];
  const animeCases = [
    {
      label: "animeonsen/Frieren",
      scrape: () => scrapeAnimeonsen({ anilistId: 101922, episodeNumber: 1 }),
      anilistId: 101922,
    },
    {
      label: "allmanga/OnePiece",
      scrape: () => scrapeAllmanga({ anilistId: 21, episodeNumber: 1 }),
      anilistId: 21,
    },
  ];

  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`\n-- Anime round ${round}/${ROUNDS} --`);
    for (const testCase of animeCases) {
      for (const mode of MODES.filter((m) => m !== "product")) {
        // product for anime ≈ full + anilist duration (already in full path below)
        const started = Date.now();
        let ok = false;
        let err = "";
        try {
          const result = await testCase.scrape();
          if (!result.ok) {
            err = result.error;
          } else if (mode === "discover") {
            ok = true;
          } else {
            const mediaMeta =
              mode === "full"
                ? await fetchAnilistMediaMeta(testCase.anilistId)
                : null;
            const depth = mode === "master" ? "master" : "full";
            const isValid = await validateStreamUrl(
              result.streamUrl,
              result.referer,
              result.streamKind,
              mode === "full" ? mediaMeta?.durationMinutes : null,
              depth,
            );
            if (!isValid) {
              err = "validate failed";
            } else {
              ok = true;
            }
          }
        } catch (error) {
          err = error instanceof Error ? error.message : "failed";
        }
        const ms = Date.now() - started;
        animeSamples.push({ ok, ms, mode, label: testCase.label });
        console.log(
          `  ${ok ? "✓" : "✗"} ${mode.padEnd(8)} ${testCase.label.padEnd(28)} ${ms}ms${err ? ` -> ${err.slice(0, 60)}` : ""}`,
        );
      }
    }
  }

  // Map anime "full" as product equivalent for summarize
  for (const s of [...animeSamples]) {
    if (s.mode === "full") {
      animeSamples.push({ ...s, mode: "product" });
    }
  }

  summarize(`Anime techniques (${proxyLabel})`, animeSamples);

  return { tmdbSamples, raceSamples, animeSamples };
};

const main = async () => {
  console.log("Scrape technique comparison");
  console.log(`rounds=${ROUNDS} proxyMode=${PROXY_MODE}`);

  const savedProxy = process.env.SCRAPE_PROXY_URL;

  if (PROXY_MODE === "on" || PROXY_MODE === "both") {
    if (savedProxy) process.env.SCRAPE_PROXY_URL = savedProxy;
    await runWithProxySetting(Boolean(savedProxy));
  }

  if (PROXY_MODE === "off" || PROXY_MODE === "both") {
    // Separate process so ProxyAgent isn't stuck from prior import
    if (PROXY_MODE === "both") {
      const { spawn } = await import("node:child_process");
      await new Promise<void>((resolvePromise, reject) => {
        const child = spawn(
          "npx",
          ["tsx", "scripts/bench-scrape-techniques.mts"],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              SCRAPE_PROXY_URL: "",
              BENCH_PROXY: "off",
              BENCH_ROUNDS: String(ROUNDS),
            },
            stdio: "inherit",
          },
        );
        child.on("exit", (code) =>
          code === 0
            ? resolvePromise()
            : reject(new Error(`proxy-off exit ${code}`)),
        );
      });
      return;
    }
    await runWithProxySetting(false);
  }

  console.log(
    "\nInterpretation guide:\n" +
      "  discover ≪ master/full  → validation is the tax\n" +
      "  master ≈ full           → deep segment probes aren't buying much time cost (or aren't running)\n" +
      "  product ≫ full          → Sub1x2 subtitle fallback is expensive\n" +
      "  race/discover << race/product → same, on time-to-first-play\n" +
      "  proxy on ≫ proxy off    → proxy RTT dominates\n",
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

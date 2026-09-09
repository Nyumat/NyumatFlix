import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fetch as nodeFetch } from "undici";
import {
  fetchAnimeHubTrendingRaw,
  fetchAnimeHubPopularRaw,
  fetchAnimeHubSeasonPopularRaw,
  fetchAnimeHubAiringRaw,
  fetchAnimeHubTopRatedRaw,
  fetchAnimeHubMoviesRaw,
} from "@/lib/server/anime-hub-data";
import {
  buildResolvedAniListTvShowFromFribb,
  buildResolvedAniListTvShowFromTmdb,
} from "@/lib/anilist-tv-fallback";
import { getCachedAnilistTvAboveFoldDetail } from "@/lib/anilist-tv-detail";
import { resolveAniListFranchise } from "@/lib/anilist-franchise";
import { getFribbMapping } from "@/lib/fribb-mapping";

const compareSample = Number.parseInt(
  process.env.BENCH_COMPARE_SAMPLE ?? "8",
  10,
);

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
};

const summarize = (label: string, values: number[]) => {
  if (!values.length) {
    return `${label}: (no samples)`;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    `${label}: n=${values.length} p50=${percentile(values, 50)}ms ` +
    `p95=${percentile(values, 95)}ms max=${Math.max(...values)}ms ` +
    `avg=${Math.round(total / values.length)}ms`
  );
};

const timeMs = async (fn: () => Promise<unknown>) => {
  const start = performance.now();
  try {
    const result = await fn();
    return { ms: Math.round(performance.now() - start), ok: result != null };
  } catch {
    return { ms: Math.round(performance.now() - start), ok: false };
  }
};

const collectHubAnilistIds = async () => {
  const hubRows = await Promise.all([
    fetchAnimeHubTrendingRaw(),
    fetchAnimeHubPopularRaw(),
    fetchAnimeHubSeasonPopularRaw(),
    fetchAnimeHubAiringRaw(),
    fetchAnimeHubTopRatedRaw(),
    fetchAnimeHubMoviesRaw(),
  ]);

  return [
    ...new Set(
      hubRows
        .flat()
        .map((item) => item.id)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
};

const collectBenchAnilistIds = async () => {
  const fromHub = await collectHubAnilistIds();
  if (fromHub.length > 0) {
    return { ids: fromHub, source: "hub" as const };
  }

  const mapping = await getFribbMapping();
  const fromFribb = Object.entries(mapping)
    .filter(([, entry]) => entry.tv)
    .map(([id]) => Number.parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 144);

  return { ids: fromFribb, source: "fribb-fallback" as const };
};

describe.skipIf(!process.env.BENCH_ANILIST_FRIBB)(
  "anilist fribb detail bench",
  () => {
    beforeAll(() => {
      vi.stubGlobal("fetch", nodeFetch);
    });

    afterAll(() => {
      vi.unstubAllGlobals();
    });

    it(
      "benchmarks anime hub titles fribb-first vs live anilist sample",
      async () => {
        const { ids: anilistIds, source } = await collectBenchAnilistIds();

        const fribbResolvedMs: number[] = [];
        const fribbAboveFoldMs: number[] = [];
        const fribbMisses: number[] = [];
        const beforeMs: number[] = [];

        for (const anilistId of anilistIds) {
          const routeId = `anilist-${anilistId}`;

          const resolvedTiming = await timeMs(() =>
            buildResolvedAniListTvShowFromFribb(anilistId),
          );
          if (resolvedTiming.ok) {
            fribbResolvedMs.push(resolvedTiming.ms);
          } else {
            fribbMisses.push(anilistId);
          }

          const aboveFoldTiming = await timeMs(async () => {
            try {
              return await getCachedAnilistTvAboveFoldDetail(routeId);
            } catch {
              return null;
            }
          });
          if (aboveFoldTiming.ok) {
            fribbAboveFoldMs.push(aboveFoldTiming.ms);
          }
        }

        const compareIds = anilistIds
          .filter((id) => !fribbMisses.includes(id))
          .slice(0, Math.max(0, compareSample));

        for (const anilistId of compareIds) {
          const beforeTiming = await timeMs(async () => {
            const franchise = await resolveAniListFranchise(anilistId);
            return buildResolvedAniListTvShowFromTmdb(anilistId, franchise);
          });
          if (beforeTiming.ok) {
            beforeMs.push(beforeTiming.ms);
          }
        }

        const fribbP50 = percentile(fribbResolvedMs, 50);
        const beforeP50 = percentile(beforeMs, 50);
        const speedup =
          beforeP50 > 0 ? (beforeP50 / Math.max(fribbP50, 1)).toFixed(1) : "n/a";

        const report = [
          `id source: ${source}`,
          `titles: ${anilistIds.length}`,
          summarize("fribb resolved", fribbResolvedMs),
          summarize("fribb above-fold", fribbAboveFoldMs),
          `fribb misses: ${fribbMisses.length}`,
          summarize("live anilist sample", beforeMs),
          `median speedup: ~${speedup}x`,
        ].join("\n");

        // eslint-disable-next-line no-console
        console.log(report);

        expect(anilistIds.length).toBeGreaterThan(20);
        expect(fribbResolvedMs.length).toBeGreaterThan(anilistIds.length * 0.55);
        if (beforeMs.length > 0) {
          expect(fribbP50).toBeLessThan(beforeP50);
        }
      },
      600_000,
    );
  },
);

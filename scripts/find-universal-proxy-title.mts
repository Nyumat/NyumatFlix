#!/usr/bin/env node
/**
 * Find titles that work across all proxy scrape providers (TMDB + anime).
 * Movies only — no TV/anime episode 1 canaries.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeProvider } = await import("../lib/scrape/index.ts");
const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");
const { SCRAPE_PROVIDER_ORDER } = await import("../lib/scrape/types.ts");
const { ANIME_SCRAPE_PROVIDER_ORDER } = await import(
  "../lib/providers/registry.ts"
);

type Candidate = {
  label: string;
  tmdb: { mediaType: "movie"; tmdbId: number };
  anime: { anilistId: number; episodeNumber: number; query: string };
};

/** Anime films with TMDB + AniList ids — episode 1 is the single movie part. */
const CANDIDATES: Candidate[] = [
  {
    label: "Spirited Away",
    tmdb: { mediaType: "movie", tmdbId: 129 },
    anime: { anilistId: 199, episodeNumber: 1, query: "Spirited Away" },
  },
  {
    label: "Your Name",
    tmdb: { mediaType: "movie", tmdbId: 372058 },
    anime: { anilistId: 21519, episodeNumber: 1, query: "Your Name" },
  },
  {
    label: "Demon Slayer: Mugen Train",
    tmdb: { mediaType: "movie", tmdbId: 635302 },
    anime: {
      anilistId: 112151,
      episodeNumber: 1,
      query: "Demon Slayer Mugen Train",
    },
  },
  {
    label: "Jujutsu Kaisen 0",
    tmdb: { mediaType: "movie", tmdbId: 810413 },
    anime: { anilistId: 131573, episodeNumber: 1, query: "Jujutsu Kaisen 0" },
  },
  {
    label: "Suzume",
    tmdb: { mediaType: "movie", tmdbId: 916224 },
    anime: { anilistId: 142770, episodeNumber: 1, query: "Suzume" },
  },
  {
    label: "Howl's Moving Castle",
    tmdb: { mediaType: "movie", tmdbId: 4935 },
    anime: { anilistId: 431, episodeNumber: 1, query: "Howl's Moving Castle" },
  },
  {
    label: "Princess Mononoke",
    tmdb: { mediaType: "movie", tmdbId: 128 },
    anime: { anilistId: 164, episodeNumber: 1, query: "Princess Mononoke" },
  },
  {
    label: "One Piece Film: Red",
    tmdb: { mediaType: "movie", tmdbId: 900667 },
    anime: { anilistId: 141902, episodeNumber: 1, query: "One Piece Film Red" },
  },
  {
    label: "A Silent Voice",
    tmdb: { mediaType: "movie", tmdbId: 378064 },
    anime: { anilistId: 20954, episodeNumber: 1, query: "A Silent Voice" },
  },
];

const EXCLUDED_ANIME = new Set(["hentaigasm", "anipm"]);

const probeTmdb = async (
  providerId: (typeof SCRAPE_PROVIDER_ORDER)[number],
  candidate: Candidate,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const result = await scrapeProvider(providerId, candidate.tmdb);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "threw",
    };
  }
};

const probeAnime = async (
  providerId: (typeof ANIME_SCRAPE_PROVIDER_ORDER)[number],
  candidate: Candidate,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const result = await scrapeAnimeProvider(providerId, candidate.anime);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "threw",
    };
  }
};

const main = async () => {
  const tmdbProviders = [...SCRAPE_PROVIDER_ORDER];
  const animeProviders = ANIME_SCRAPE_PROVIDER_ORDER.filter(
    (id) => !EXCLUDED_ANIME.has(id),
  );
  const allProviders = [
    ...tmdbProviders.map((id) => ({ kind: "tmdb" as const, id })),
    ...animeProviders.map((id) => ({ kind: "anime" as const, id })),
  ];

  console.log(
    `Proxy scrape universal title search (${allProviders.length} providers)`,
  );
  console.log(
    `SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}\n`,
  );

  const results: Record<
    string,
    { ok: string[]; fail: Array<{ provider: string; error: string }> }
  > = {};

  for (const candidate of CANDIDATES) {
    results[candidate.label] = { ok: [], fail: [] };

    const probes = await Promise.all(
      allProviders.map(async (provider) => {
        const key = `${provider.kind}:${provider.id}`;
        const probe =
          provider.kind === "tmdb"
            ? await probeTmdb(provider.id, candidate)
            : await probeAnime(provider.id, candidate);
        return { key, probe };
      }),
    );

    for (const { key, probe } of probes) {
      if (probe.ok) {
        results[candidate.label].ok.push(key);
      } else {
        results[candidate.label].fail.push({
          provider: key,
          error: probe.error ?? "failed",
        });
      }
    }
    const okCount = results[candidate.label].ok.length;
    console.log(
      `${candidate.label}: ${okCount}/${allProviders.length} (${probes.map((p) => (p.probe.ok ? "." : "x")).join("")})`,
    );
  }

  console.log("\n=== Rankings (most providers first) ===");
  const ranked = Object.entries(results)
    .map(([label, r]) => ({
      label,
      ok: r.ok.length,
      total: allProviders.length,
      fail: r.fail,
    }))
    .sort((a, b) => b.ok - a.ok);

  for (const row of ranked) {
    const pct = ((row.ok / row.total) * 100).toFixed(0);
    console.log(`${row.label.padEnd(28)} ${row.ok}/${row.total} (${pct}%)`);
    if (row.ok === row.total) {
      console.log("  *** UNIVERSAL ***");
    } else if (row.fail.length <= 8) {
      for (const f of row.fail) {
        console.log(`    ✗ ${f.provider}: ${f.error.slice(0, 100)}`);
      }
    } else {
      console.log(`    ✗ ${row.fail.length} failures (first 5):`);
      for (const f of row.fail.slice(0, 5)) {
        console.log(`      ${f.provider}: ${f.error.slice(0, 80)}`);
      }
    }
  }

  const universal = ranked.filter((r) => r.ok === r.total);
  if (universal.length > 0) {
    console.log("\n=== Universal titles ===");
    for (const u of universal) {
      console.log(`- ${u.label}`);
    }
  } else {
    console.log("\nNo title hit 100%. Best:");
    const best = ranked[0];
    if (best) {
      console.log(`${best.label} at ${best.ok}/${best.total}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

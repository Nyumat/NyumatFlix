#!/usr/bin/env node
/**
 * Flake vs real: probe problem providers across titles (2 rounds each).
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeProvider } = await import("../lib/scrape/index.ts");
const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");
const { TMDB_SCRAPE_PROVIDER_ORDER } = await import(
  "../lib/providers/registry.ts"
);

type TmdbCase = {
  label: string;
  tmdbId: number;
  kind: "hollywood" | "anime-film";
};

type AnimeCase = {
  label: string;
  anilistId: number;
  episodeNumber: number;
  query: string;
  kind: "film" | "series";
};

const TMDB_CASES: TmdbCase[] = [
  { label: "Fight Club", tmdbId: 550, kind: "hollywood" },
  { label: "Avengers", tmdbId: 24428, kind: "hollywood" },
  { label: "Matrix", tmdbId: 603, kind: "hollywood" },
  { label: "OP Film Red", tmdbId: 900667, kind: "anime-film" },
  { label: "Spirited Away", tmdbId: 129, kind: "anime-film" },
  { label: "Your Name", tmdbId: 372058, kind: "anime-film" },
  { label: "JJK 0", tmdbId: 810413, kind: "anime-film" },
  { label: "DS Mugen Train", tmdbId: 635302, kind: "anime-film" },
];

const ANIME_CASES: AnimeCase[] = [
  {
    label: "OP Film Red",
    anilistId: 141902,
    episodeNumber: 1,
    query: "One Piece Film Red",
    kind: "film",
  },
  {
    label: "Spirited Away",
    anilistId: 199,
    episodeNumber: 1,
    query: "Spirited Away",
    kind: "film",
  },
  {
    label: "Your Name",
    anilistId: 21519,
    episodeNumber: 1,
    query: "Your Name",
    kind: "film",
  },
  {
    label: "JJK 0",
    anilistId: 131573,
    episodeNumber: 1,
    query: "Jujutsu Kaisen 0",
    kind: "film",
  },
  {
    label: "Frieren",
    anilistId: 154587,
    episodeNumber: 1,
    query: "Frieren",
    kind: "series",
  },
  {
    label: "JJK S1",
    anilistId: 113415,
    episodeNumber: 1,
    query: "Jujutsu Kaisen",
    kind: "series",
  },
  {
    label: "AOT S1",
    anilistId: 16498,
    episodeNumber: 1,
    query: "Attack on Titan",
    kind: "series",
  },
];

const TMDB_PROVIDERS = TMDB_SCRAPE_PROVIDER_ORDER;
const ANIME_PROVIDERS = [
  "kyren",
  "allmanga",
  "animepahe",
  "justanime",
] as const;

const ROUNDS = 2;

type Cell = { ok: number; fail: number; errors: string[] };

const cell = (): Cell => ({ ok: 0, fail: 0, errors: [] });

const record = (c: Cell, ok: boolean, error?: string) => {
  if (ok) c.ok += 1;
  else {
    c.fail += 1;
    if (error && !c.errors.includes(error)) c.errors.push(error);
  }
};

const classify = (
  c: Cell,
): "stable-ok" | "stable-fail" | "flake" | "untested" => {
  const n = c.ok + c.fail;
  if (n === 0) return "untested";
  if (c.ok === n) return "stable-ok";
  if (c.fail === n) return "stable-fail";
  return "flake";
};

const tmdbGrid = new Map<string, Cell>();
const animeGrid = new Map<string, Cell>();

const tmdbKey = (title: string, provider: string) => `${title}|${provider}`;
const animeKey = (title: string, provider: string) => `${title}|${provider}`;

for (const t of TMDB_CASES) {
  for (const p of TMDB_PROVIDERS) {
    tmdbGrid.set(tmdbKey(t.label, p), cell());
  }
}
for (const a of ANIME_CASES) {
  for (const p of ANIME_PROVIDERS) {
    animeGrid.set(animeKey(a.label, p), cell());
  }
}

console.log(
  `Flake probe: ${TMDB_CASES.length} TMDB × ${TMDB_PROVIDERS.length} + ${ANIME_CASES.length} anime × ${ANIME_PROVIDERS.length}, ${ROUNDS} rounds`,
);
console.log(`Proxy: ${process.env.SCRAPE_PROXY_URL ?? "(none)"}\n`);

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`--- Round ${round}/${ROUNDS} ---`);

  for (const t of TMDB_CASES) {
    const results = await Promise.all(
      TMDB_PROVIDERS.map(async (providerId) => {
        try {
          const r = await scrapeProvider(providerId, {
            mediaType: "movie",
            tmdbId: t.tmdbId,
          });
          return { providerId, ok: r.ok, error: r.ok ? "" : r.error };
        } catch (error) {
          return {
            providerId,
            ok: false,
            error: error instanceof Error ? error.message : "threw",
          };
        }
      }),
    );
    const marks = results
      .map((r) => `${r.providerId}:${r.ok ? "✓" : "✗"}`)
      .join(" ");
    console.log(`TMDB ${t.label}: ${marks}`);
    for (const r of results) {
      record(tmdbGrid.get(tmdbKey(t.label, r.providerId))!, r.ok, r.error);
    }
  }

  for (const a of ANIME_CASES) {
    const results = await Promise.all(
      ANIME_PROVIDERS.map(async (providerId) => {
        try {
          const r = await scrapeAnimeProvider(providerId, {
            anilistId: a.anilistId,
            episodeNumber: a.episodeNumber,
            query: a.query,
          });
          return { providerId, ok: r.ok, error: r.ok ? "" : r.error };
        } catch (error) {
          return {
            providerId,
            ok: false,
            error: error instanceof Error ? error.message : "threw",
          };
        }
      }),
    );
    const marks = results
      .map((r) => `${r.providerId}:${r.ok ? "✓" : "✗"}`)
      .join(" ");
    console.log(`Anime ${a.label}: ${marks}`);
    for (const r of results) {
      record(animeGrid.get(animeKey(a.label, r.providerId))!, r.ok, r.error);
    }
  }
  console.log("");
}

const printSection = (
  title: string,
  cases: Array<{ label: string; kind: string }>,
  providers: readonly string[],
  grid: Map<string, Cell>,
  keyFn: (t: string, p: string) => string,
) => {
  console.log(`\n=== ${title} ===`);
  console.log(
    "title".padEnd(16) + providers.map((p) => p.padEnd(14)).join("") + "notes",
  );
  console.log("-".repeat(16 + providers.length * 14 + 20));

  for (const c of cases) {
    const cells = providers.map((p) => {
      const cellData = grid.get(keyFn(c.label, p))!;
      const tag = classify(cellData);
      if (tag === "stable-ok") return "OK".padEnd(14);
      if (tag === "stable-fail") return "FAIL".padEnd(14);
      if (tag === "flake") return "FLAKE".padEnd(14);
      return "—".padEnd(14);
    });
    console.log(c.label.padEnd(16) + cells.join(""));
  }

  console.log(`\n${title} failure patterns:`);
  for (const p of providers) {
    const fails = cases
      .map((c) => ({
        label: c.label,
        cell: grid.get(keyFn(c.label, p))!,
      }))
      .filter(({ cell: cd }) => cd.fail > 0);

    if (fails.length === 0) {
      console.log(`  ${p}: all pass`);
      continue;
    }

    const stable = fails.filter(
      ({ cell: cd }) => classify(cd) === "stable-fail",
    );
    const flaky = fails.filter(({ cell: cd }) => classify(cd) === "flake");
    console.log(
      `  ${p}: ${stable.length} stable-fail, ${flaky.length} flake, ${fails.length - stable.length - flaky.length} mixed`,
    );
    for (const { label, cell: cd } of stable.slice(0, 6)) {
      console.log(`    ✗ ${label}: ${cd.errors[0]?.slice(0, 90) ?? "fail"}`);
    }
  }
};

printSection("TMDB providers", TMDB_CASES, TMDB_PROVIDERS, tmdbGrid, tmdbKey);
printSection(
  "Anime providers",
  ANIME_CASES,
  ANIME_PROVIDERS,
  animeGrid,
  animeKey,
);

console.log("\n=== Verdict ===");
const verdicts: string[] = [];

const vkFails = TMDB_CASES.filter((t) => {
  const c = tmdbGrid.get(tmdbKey(t.label, "vidking"))!;
  return classify(c) === "stable-fail";
}).map((t) => t.label);
const vkFlake = TMDB_CASES.filter((t) => {
  const c = tmdbGrid.get(tmdbKey(t.label, "vidking"))!;
  return classify(c) === "flake";
}).map((t) => t.label);
if (vkFails.length)
  verdicts.push(`vidking stable-fail on: ${vkFails.join(", ")}`);
if (vkFlake.length) verdicts.push(`vidking flaky on: ${vkFlake.join(", ")}`);

const vxFails = TMDB_CASES.filter((t) => {
  const c = tmdbGrid.get(tmdbKey(t.label, "vixsrc"))!;
  return classify(c) === "stable-fail";
}).map((t) => t.label);
if (vxFails.length)
  verdicts.push(`vixsrc stable-fail on: ${vxFails.join(", ")}`);

for (const p of ANIME_PROVIDERS) {
  const stable = ANIME_CASES.filter((a) => {
    const c = animeGrid.get(animeKey(a.label, p))!;
    return classify(c) === "stable-fail";
  }).map((a) => a.label);
  const flaky = ANIME_CASES.filter((a) => {
    const c = animeGrid.get(animeKey(a.label, p))!;
    return classify(c) === "flake";
  }).map((a) => a.label);
  if (stable.length) verdicts.push(`${p} stable-fail: ${stable.join(", ")}`);
  if (flaky.length) verdicts.push(`${p} flaky: ${flaky.join(", ")}`);
}

for (const v of verdicts) console.log(`• ${v}`);

#!/usr/bin/env node
/**
 * Verifies AniList → TMDB mapping coverage for /anime hub + results flows.
 * Run: node scripts/verify-anime-mappings.mjs
 */

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const FRIBB_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json";

const HUB_QUERY = `
  query AnimeHubSample($perPage: Int!) {
    trending: Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
        id
        title { romaji english }
        format
      }
    }
    popular: Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english }
        format
      }
    }
  }
`;

const RESULTS_QUERY = `
  query AnimeResultsSample($perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english }
        format
      }
    }
  }
`;

const isDetailHref = (href) => /^\/(?:movies|tvshows)\/\d+/.test(href ?? "");

const isBrowseFallback = (href) => href === "/tvshows";

const withAnimePageHref = (item) => {
  if (item.tmdbFallback) {
    const { id, type } = item.tmdbFallback;
    return type === "movie" ? `/movies/${id}` : `/tvshows/${id}`;
  }
  if (item.isAniListFallback) return "/tvshows";
  if (
    item.href &&
    !/^https?:\/\//i.test(item.href) &&
    !item.href.includes("anilist.co")
  ) {
    return item.href;
  }
  const id = Math.abs(item.id);
  return item.media_type === "movie" ? `/movies/${id}` : `/tvshows/${id}`;
};

const toHubItem = (anilistItem) => ({
  id: anilistItem.id,
  media_type: anilistItem.format === "MOVIE" ? "movie" : "tv",
  href: `https://anilist.co/anime/${anilistItem.id}`,
  isAniListFallback: true,
  sourceAnilistId: anilistItem.id,
  title: anilistItem.title?.english || anilistItem.title?.romaji,
});

const toEnrichedItem = (anilistItem, fribbMap) => {
  const fallback = toHubItem(anilistItem);
  const mapping = fribbMap.get(anilistItem.id);
  if (!mapping) return fallback;
  return {
    ...fallback,
    id: mapping.id,
    media_type: mapping.type,
    isAniListFallback: false,
  };
};

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function loadFribbMap() {
  const data = await fetchJson(FRIBB_URL);
  const map = new Map();
  for (const item of data) {
    if (!item.anilist_id || !item.themoviedb_id) continue;
    if (item.themoviedb_id.tv) {
      map.set(item.anilist_id, { id: item.themoviedb_id.tv, type: "tv" });
    } else if (item.themoviedb_id.movie) {
      map.set(item.anilist_id, { id: item.themoviedb_id.movie, type: "movie" });
    }
  }
  return map;
}

async function fetchAniListSample(query, perPage = 24) {
  const payload = await fetchJson(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables: { perPage } }),
  });
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
  return payload.data;
}

function analyzeItems(label, items, mode) {
  const rows = items.map((item) => {
    const href = withAnimePageHref(item);
    return {
      anilistId: item.sourceAnilistId ?? item.id,
      title: item.title,
      href,
      detail: isDetailHref(href),
      browseFallback: isBrowseFallback(href),
      mode,
    };
  });

  const detail = rows.filter((r) => r.detail).length;
  const browse = rows.filter((r) => r.browseFallback).length;
  const other = rows.length - detail - browse;

  console.log(`\n=== ${label} (${mode}) ===`);
  console.log(`  total: ${rows.length}`);
  console.log(`  internal detail (/movies|/tvshows/id): ${detail}`);
  console.log(`  browse fallback (/tvshows): ${browse}`);
  console.log(`  other: ${other}`);

  const unmapped = rows.filter((r) => r.browseFallback);
  if (unmapped.length > 0) {
    console.log(`  unmapped sample (first 8):`);
    for (const r of unmapped.slice(0, 8)) {
      console.log(`    - [${r.anilistId}] ${r.title}`);
    }
  }

  return { rows, detail, browse, other };
}

async function curlAnimePage(baseUrl) {
  const urls = [`${baseUrl}/anime`, `${baseUrl}/anime?mode=results`];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();
      const detailLinks = [
        ...html.matchAll(/href="(\/(?:movies|tvshows)\/\d+[^"]*)"/g),
      ].map((m) => m[1]);
      const browseLinks = [...html.matchAll(/href="\/tvshows"/g)].length;
      const anilistLinks = [...html.matchAll(/anilist\.co/g)].length;
      console.log(`\n=== curl ${url} ===`);
      console.log(`  status: ${res.status}`);
      console.log(`  detail links in HTML: ${detailLinks.length}`);
      console.log(`  /tvshows browse links: ${browseLinks}`);
      console.log(`  anilist.co references: ${anilistLinks}`);
      if (detailLinks.length > 0) {
        console.log(
          `  sample detail hrefs: ${[...new Set(detailLinks)].slice(0, 5).join(", ")}`,
        );
      }
    } catch (err) {
      console.log(`\n=== curl ${url} ===`);
      console.log(`  failed: ${err.message}`);
    }
  }
}

async function main() {
  console.log("Loading Fribb mapping...");
  const fribbMap = await loadFribbMap();
  console.log(`Fribb entries with TMDB id: ${fribbMap.size}`);

  console.log("\nFetching AniList hub sample...");
  const hubData = await fetchAniListSample(HUB_QUERY, 24);
  const hubRaw = [
    ...(hubData.trending?.media ?? []),
    ...(hubData.popular?.media ?? []),
  ];

  const uniqueHub = new Map();
  for (const item of hubRaw) uniqueHub.set(item.id, item);
  const hubAnilist = [...uniqueHub.values()];

  const hubItems = hubAnilist.map(toHubItem);
  const hubAnalysis = analyzeItems(
    "Anime hub (current code path)",
    hubItems,
    "hub-no-enrich",
  );

  const hubIfEnriched = hubAnilist.map((item) =>
    toEnrichedItem(item, fribbMap),
  );
  const enrichedAnalysis = analyzeItems(
    "Anime hub (if lightweight enrich ran)",
    hubIfEnriched,
    "hub-with-fribb-only",
  );

  console.log("\nFetching AniList results sample...");
  const resultsData = await fetchAniListSample(RESULTS_QUERY, 30);
  const resultsRaw = resultsData.Page?.media ?? [];
  const resultsEnriched = resultsRaw.map((item) =>
    toEnrichedItem(item, fribbMap),
  );
  const resultsAnalysis = analyzeItems(
    "Anime results (lightweight enrich, Fribb only)",
    resultsEnriched,
    "results-fribb-only",
  );

  const hubMapped = hubAnilist.filter((i) => fribbMap.has(i.id)).length;
  const resultsMapped = resultsRaw.filter((i) => fribbMap.has(i.id)).length;

  console.log("\n=== Fribb coverage on live AniList samples ===");
  console.log(
    `  hub unique items: ${hubAnilist.length}, in Fribb: ${hubMapped} (${pct(hubMapped, hubAnilist.length)})`,
  );
  console.log(
    `  results page: ${resultsRaw.length}, in Fribb: ${resultsMapped} (${pct(resultsMapped, resultsRaw.length)})`,
  );

  const hasIdMoe = Boolean(process.env.ID_MOE_API_KEY?.trim());
  console.log(
    `\n  ID_MOE_API_KEY configured: ${hasIdMoe ? "yes" : "no (ids.moe skipped)"}`,
  );

  console.log("\n=== Summary ===");
  console.log(
    `  Current /anime hub: ${hubAnalysis.detail}/${hubAnalysis.rows.length} items route to TMDB detail pages`,
  );
  console.log(
    `  With Fribb enrich:   ${enrichedAnalysis.detail}/${enrichedAnalysis.rows.length} hub items would route correctly`,
  );
  console.log(
    `  Results w/ Fribb:   ${resultsAnalysis.detail}/${resultsAnalysis.rows.length} would route correctly`,
  );

  const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
  console.log(`\nTrying live page curl against ${baseUrl}...`);
  await curlAnimePage(baseUrl);
}

function pct(n, total) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

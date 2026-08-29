#!/usr/bin/env node
/**
 * Deep-dive probes for broken anime providers.
 * Usage: npx tsx scripts/diagnose-broken-anime.mts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });
loadEnv({
  path: resolve(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});

const { scrapeFetch, scrapeFetchText } = await import("../lib/scrape/fetch.ts");
const { normalizeAllanimeApiResponse } = await import(
  "../lib/scrape/anime/allanime-crypto.ts"
);

const PROXY = process.env.SCRAPE_PROXY_URL ?? "(unset)";
console.log(`SCRAPE_PROXY_URL=${PROXY}\n`);

const dump = async (label: string, fn: () => Promise<unknown>) => {
  process.stdout.write(`=== ${label} ===\n`);
  try {
    const result = await fn();
    const text =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);
    console.log(text.slice(0, 3500));
  } catch (error) {
    console.log("ERROR:", error instanceof Error ? error.message : error);
  }
  console.log("");
};

await dump("JustAnime anineko hd2", async () => {
  const r = await scrapeFetch(
    "https://core.justanime.to/api/watch/21/episode/1/anineko/sub/hd2",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://justanime.to",
        Referer: "https://justanime.to/",
      },
    },
  );
  return { status: r.status, body: await r.text() };
});

await dump("JustAnime anineko hd1", async () => {
  const r = await scrapeFetch(
    "https://core.justanime.to/api/watch/21/episode/1/anineko/sub/hd1",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://justanime.to",
        Referer: "https://justanime.to/",
      },
    },
  );
  return { status: r.status, body: await r.text() };
});

await dump("JustAnime megaplay", async () => {
  const r = await scrapeFetch(
    "https://core.justanime.to/api/watch/21/episode/1/megaplay",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://justanime.to",
        Referer: "https://justanime.to/",
      },
    },
  );
  return { status: r.status, body: await r.text() };
});

await dump("JustAnime watch page HTML hints", async () => {
  const r = await scrapeFetchText("https://justanime.to/watch/21?ep=1", {
    Referer: "https://justanime.to/",
  });
  const text = r.text;
  const apiHits = [
    ...text.matchAll(/core\.justanime\.to\/api\/[^"'\\\s]+/g),
  ].map((m) => m[0]);
  const scriptSrcs = [...text.matchAll(/src=["']([^"']+\.js[^"']*)["']/g)]
    .map((m) => m[1])
    .slice(0, 20);
  return {
    status: r.status,
    apiHits: [...new Set(apiHits)].slice(0, 30),
    scriptSrcs,
  };
});

await dump("AniKitty stream", async () => {
  const r = await scrapeFetch(
    "https://anikitty.moe/api/kitty/stream?anilistId=21&episode=1&audio=sub",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://anikitty.moe",
        Referer: "https://anikitty.moe/",
      },
    },
  );
  const body = await r.text();
  let parsed: unknown = body;
  try {
    parsed = JSON.parse(body);
  } catch {
    void 0;
  }
  return { status: r.status, body: parsed };
});

await dump("AnimeParadise search", async () => {
  const r = await scrapeFetch(
    "https://api.animeparadise.moe/search?q=One%20Piece",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://www.animeparadise.moe",
        Referer: "https://www.animeparadise.moe/",
      },
    },
  );
  return { status: r.status, body: (await r.text()).slice(0, 2000) };
});

await dump("AllManga search shows", async () => {
  const query = `query($search: SearchInput, $limit: Int) {
    shows(search: $search, limit: $limit) {
      edges { _id name englishName aniListId availableEpisodesDetail }
    }
  }`;
  const r = await scrapeFetch("https://api.allanime.day/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://allmanga.to",
      Referer: "https://allmanga.to/",
    },
    body: JSON.stringify({
      query,
      variables: {
        search: {
          query: "One Piece",
          allowAdult: false,
          allowUnknown: false,
        },
        limit: 5,
      },
    }),
  });
  const raw = await r.json();
  const normalized = normalizeAllanimeApiResponse(raw);
  return { status: r.status, rawKeys: Object.keys(raw as object), normalized };
});

await dump("AllManga episode persisted", async () => {
  // First get show id from search
  const searchQuery = `query($search: SearchInput, $limit: Int) {
    shows(search: $search, limit: $limit) {
      edges { _id name englishName aniListId }
    }
  }`;
  const searchRes = await scrapeFetch("https://api.allanime.day/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://allmanga.to",
      Referer: "https://allmanga.to/",
    },
    body: JSON.stringify({
      query: searchQuery,
      variables: {
        search: { query: "1P", allowAdult: false, allowUnknown: false },
        limit: 8,
      },
    }),
  });
  const searchNorm = normalizeAllanimeApiResponse<{
    data?: {
      shows?: {
        edges?: Array<{ _id?: string; aniListId?: string; name?: string }>;
      };
    };
  }>(await searchRes.json());
  const edges = searchNorm.data?.shows?.edges ?? [];
  const show =
    edges.find((e) => e.aniListId === "21") ??
    edges.find((e) => e.name === "1P") ??
    edges[0];
  if (!show?._id) {
    return { error: "no show", edges };
  }

  const hash =
    "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";
  const variables = {
    showId: show._id,
    translationType: "sub",
    episodeString: "1",
  };
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: hash },
    }),
  });
  const epRes = await scrapeFetch(
    `https://api.allanime.day/api?${params.toString()}`,
    {
      headers: {
        Origin: "https://allmanga.to",
        Referer: "https://allmanga.to/",
      },
    },
  );
  const epRaw = await epRes.json();
  const epNorm = normalizeAllanimeApiResponse(epRaw);
  return {
    show,
    status: epRes.status,
    rawKeys: Object.keys(epRaw as object),
    episode: epNorm,
  };
});

await dump("AniKuro sources anikoto", async () => {
  const r = await scrapeFetch(
    "https://anikuro.ru/api/v1/sources/anikoto/21:1",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://anikuro.ru",
        Referer: "https://anikuro.ru/",
      },
    },
  );
  return { status: r.status, body: (await r.text()).slice(0, 2500) };
});

console.log("done");

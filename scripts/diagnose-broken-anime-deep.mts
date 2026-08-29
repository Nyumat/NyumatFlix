#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });
loadEnv({
  path: resolve(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});

const { scrapeFetch, scrapeFetchText } = await import("../lib/scrape/fetch.ts");
const { isPlayableHlsStream, isBaitHlsPlaylist } = await import(
  "../lib/scrape/anime/hls-sanity.ts"
);
const { normalizeAllanimeApiResponse } = await import(
  "../lib/scrape/anime/allanime-crypto.ts"
);
const { validateStreamUrlWithReferers } = await import(
  "../lib/scrape/validate-stream.ts"
);
const { probeScrapePlaybackPath } = await import(
  "../lib/scrape/playback-probe.ts"
);
const { scrapeJustanime } = await import(
  "../lib/scrape/anime/providers/justanime.ts"
);
const { scrapeAnikuro } = await import(
  "../lib/scrape/anime/providers/anikuro.ts"
);
const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");
const { scrapeAllmanga } = await import(
  "../lib/scrape/anime/providers/allmanga.ts"
);

const vivibebe =
  "https://vivibebe.site/public/stream/e6693c8de8202fbe/11080.m3u8";
const mega =
  "https://9hjkrt.nekostream.site/f899139df5e1059396431415e770c6dd/61b87186ab260d05003427e16ccf5657/master.m3u8";
const anikuroProxy =
  "https://proxy.anikuro.ru/aHR0cHM6Ly85aGprcnQubmVrb3N0cmVhbS5zaXRlLzRmMTZjODE4ODc1ZDlmY2I2ODY3YzdiZGM4OWJlN2ViLzQ2YWNiNDQ4MjIzYzYwYzE2MmVmYTMxYWRkZjU5YjQyL21hc3Rlci5tM3U4fGh0dHBzOi8vbWVnYXBsYXkuYnV6ei8=.m3u8?proxy=0";
const anikuroOriginal =
  "https://9hjkrt.nekostream.site/4f16c818875d9fcb6867c7bdc89be7eb/46acb448223c60c162efa31addf59b42/master.m3u8";

console.log("--- JustAnime HLS ---");
for (const [label, url, referer] of [
  ["vivibebe", vivibebe, "https://vivibebe.site/"] as const,
  ["megaplay", mega, "https://megaplay.buzz/"] as const,
]) {
  const body = await scrapeFetchText(url, { Referer: referer });
  console.log(
    label,
    "status",
    body.status,
    "bait",
    body.text ? isBaitHlsPlaylist(body.text) : "n/a",
    "hasEXTM3U",
    body.text?.includes("#EXTM3U"),
    "head",
    body.text?.slice(0, 180).replace(/\n/g, " | "),
  );
  console.log(
    label,
    "isPlayable",
    await isPlayableHlsStream(url, referer),
    "validate",
    (
      await validateStreamUrlWithReferers(url, referer, "hls", {
        depth: "full",
      })
    ).ok,
  );
}

console.log("\n--- scrapeJustanime raw ---");
console.log(await scrapeJustanime({ anilistId: 21, episodeNumber: 1 }));

console.log("\n--- AllManga episode sources ---");
const showId = "ReooPAxPMsHM4KPMY";
const hash = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";
for (const ep of ["1", "1168", "1169"]) {
  const variables = {
    showId,
    translationType: "sub",
    episodeString: ep,
  };
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: hash },
    }),
  });
  const r = await scrapeFetch(`https://api.allanime.day/api?${params}`, {
    headers: {
      Origin: "https://allmanga.to",
      Referer: "https://allmanga.to/",
    },
  });
  const raw = await r.json();
  const norm = normalizeAllanimeApiResponse(raw) as {
    data?: {
      episode?: {
        sourceUrls?: Array<{ sourceName?: string; sourceUrl?: string }>;
      };
    };
  };
  const sources = norm?.data?.episode?.sourceUrls ?? [];
  console.log(
    `ep ${ep}: status=${r.status} sources=${sources.length}`,
    sources
      .slice(0, 6)
      .map((s) => `${s.sourceName}:${(s.sourceUrl ?? "").slice(0, 40)}`)
      .join(" | "),
  );
}

console.log("\n--- scrapeAllmanga ---");
console.log(await scrapeAllmanga({ anilistId: 21, episodeNumber: 1 }));
console.log(
  "allmanga recent",
  await scrapeAllmanga({ anilistId: 21, episodeNumber: 1168 }),
);

console.log("\n--- AnimeParadise chain ---");
const animeRes = await scrapeFetch(
  "https://api.animeparadise.moe/anime/one-piece",
  {
    headers: {
      Origin: "https://www.animeparadise.moe",
      Referer: "https://www.animeparadise.moe/",
    },
  },
);
const animeJson = (await animeRes.json()) as {
  data?: { _id?: string; mappings?: { anilist?: number } };
  _id?: string;
  mappings?: { anilist?: number };
};
const data = animeJson.data ?? animeJson;
console.log("anime", data._id, "anilist", data.mappings?.anilist);
const animeId = data._id ?? "ASa7g4dGZREXdtzA";
const epsRes = await scrapeFetch(
  `https://api.animeparadise.moe/anime/${animeId}/episode`,
  {
    headers: {
      Origin: "https://www.animeparadise.moe",
      Referer: "https://www.animeparadise.moe/",
    },
  },
);
const epsJson = (await epsRes.json()) as { data?: unknown };
const eps = epsJson.data ?? epsJson;
const list = Array.isArray(eps) ? eps : [];
console.log(
  "episodes",
  list.length,
  "first3",
  JSON.stringify(list.slice(0, 3)),
);
const ep1 = list.find(
  (e: { number?: string | number }) => Number(e.number) === 1,
) as { uid?: string; number?: string | number } | undefined;
if (ep1?.uid) {
  const epRes = await scrapeFetch(
    `https://api.animeparadise.moe/ep/${ep1.uid}?origin=${animeId}`,
    {
      headers: {
        Origin: "https://www.animeparadise.moe",
        Referer: "https://www.animeparadise.moe/",
      },
    },
  );
  const epText = await epRes.text();
  console.log("ep detail", epRes.status, epText.slice(0, 900));
  try {
    const epPayload = JSON.parse(epText) as {
      data?: { episode?: { streamLink?: string } };
      episode?: { streamLink?: string };
    };
    const streamLink =
      epPayload.data?.episode?.streamLink ?? epPayload.episode?.streamLink;
    if (streamLink) {
      const streamUrl = `https://stream.animeparadise.moe/m3u8?url=${encodeURIComponent(streamLink)}`;
      const body = await scrapeFetchText(streamUrl, {
        Referer: "https://www.animeparadise.moe/",
      });
      console.log(
        "stream relay",
        body.status,
        "bait",
        body.text ? isBaitHlsPlaylist(body.text) : "n/a",
        body.text?.slice(0, 200).replace(/\n/g, " | "),
      );
      console.log(
        "stream playable",
        await isPlayableHlsStream(streamUrl, "https://www.animeparadise.moe/"),
      );
      console.log(
        "direct streamLink playable",
        await isPlayableHlsStream(streamLink, "https://www.animeparadise.moe/"),
      );
      const direct = await scrapeFetchText(streamLink, {
        Referer: "https://www.animeparadise.moe/",
      });
      console.log(
        "direct streamLink",
        direct.status,
        direct.text.slice(0, 200).replace(/\n/g, " | "),
      );
    }
  } catch (error) {
    console.log("parse ep failed", error);
  }
}

console.log("\n--- AniKuro HLS ---");
for (const [label, url, referer] of [
  ["proxy", anikuroProxy, "https://megaplay.buzz/"] as const,
  ["proxy-anikuro-ref", anikuroProxy, "https://anikuro.ru/"] as const,
  ["original", anikuroOriginal, "https://megaplay.buzz/"] as const,
]) {
  const body = await scrapeFetchText(url, { Referer: referer });
  console.log(
    label,
    "status",
    body.status,
    "hasEXTM3U",
    body.text?.includes("#EXTM3U"),
    "head",
    body.text?.slice(0, 120).replace(/\n/g, " | "),
  );
  const v = await validateStreamUrlWithReferers(url, referer, "hls", {
    depth: "full",
  });
  const p = await probeScrapePlaybackPath({ url, referer }, "hls");
  console.log(label, "validate", v.ok, "probe", p);
}

console.log("\n--- scrapeAnikuro vs scrapeAnimeProvider ---");
console.log("raw", await scrapeAnikuro({ anilistId: 21, episodeNumber: 1 }));
console.log(
  "wrapped",
  await scrapeAnimeProvider("anikuro", { anilistId: 21, episodeNumber: 1 }),
);

console.log("\n--- AniKitty ---");
try {
  const r = await scrapeFetch(
    "https://anikitty.moe/api/kitty/stream?anilistId=21&episode=1&audio=sub",
    {
      headers: {
        Accept: "application/json",
        Origin: "https://anikitty.moe",
        Referer: "https://anikitty.moe/",
      },
      retryAttempts: 1,
    },
  );
  console.log("status", r.status, (await r.text()).slice(0, 600));
} catch (error) {
  console.log("error", error instanceof Error ? error.message : error);
}

// Try anikitty homepage / alternate hosts
for (const host of ["anikitty.moe", "www.anikitty.moe"]) {
  try {
    const r = await scrapeFetchText(`https://${host}/`, {
      Referer: `https://${host}/`,
    });
    console.log(
      host,
      "home",
      r.status,
      r.text.slice(0, 120).replace(/\n/g, " "),
    );
  } catch (error) {
    console.log(
      host,
      "home error",
      error instanceof Error ? error.message : error,
    );
  }
}

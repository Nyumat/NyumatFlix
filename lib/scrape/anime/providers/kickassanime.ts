import { preferredAudioLangForTranslation } from "../audio-preference";
import { extractM3u8Urls, parseCatPlayerProps } from "../html-utils";
import { resolveAnimeSearchContext } from "../anilist-meta";
import { isExactAnimeTitleMatch } from "../title-match";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../../fetch";
import type { ScrapeSubtitle } from "../../types";

const KAA_ORIGIN = "https://kaa.lt";
/** Segment CDN requires the cat-player site referer — kaa.lt gets Cloudflare 403. */
const KAA_STREAM_REFERER = "https://krussdomi.com/";

type KaaSearchResult = {
  result?: Array<{ slug?: string; title?: string; title_en?: string }>;
};

export const selectKaaSearchResult = (
  results: KaaSearchResult["result"],
  expectedTitles: readonly string[] | string,
) => {
  const titles =
    typeof expectedTitles === "string" ? [expectedTitles] : expectedTitles;
  return results?.find(
    (entry) =>
      Boolean(entry.slug && (entry.title || entry.title_en)) &&
      (isExactAnimeTitleMatch(entry.title ?? "", titles) ||
        isExactAnimeTitleMatch(entry.title_en ?? "", titles)),
  );
};

type KaaEpisodeList = {
  result?: Array<{
    slug?: string;
    episode_number?: number;
  }>;
};

type KaaEpisodeDetail = {
  result?: {
    servers?: Array<{ name?: string; src?: string }>;
  };
  servers?: Array<{ name?: string; src?: string }>;
};

const findEpisodeSlug = (
  episodes: KaaEpisodeList["result"],
  episodeNumber: number,
): string | null => {
  const match = episodes?.find(
    (entry) => entry.episode_number === episodeNumber,
  );
  return match?.slug ? `ep-${episodeNumber}-${match.slug}` : null;
};

const normalizeCatPlayerUrl = (src: string): string => {
  const url = new URL(src);
  if (url.searchParams.get("source") === "vidst") {
    url.searchParams.set("source", "vidstream");
  }
  if (
    url.searchParams.get("type") === "dash" ||
    !url.searchParams.has("type")
  ) {
    url.searchParams.set("type", "hls");
  }
  return url.toString();
};

type KaaServer = { name?: string; src?: string };

const scoreKaaServer = (src: string): number => {
  try {
    const url = new URL(src);
    if (
      url.searchParams.get("source") === "vidstream" ||
      url.searchParams.get("source") === "vidst"
    ) {
      return 100;
    }
    if (
      /(^|\.)cat-player\./i.test(url.hostname) ||
      /\/cat-player(?:\/|$)/i.test(url.pathname)
    ) {
      return 80;
    }
    if (/(^|\.)krussdomi\.com$/i.test(url.hostname)) {
      return 70;
    }
    return 10;
  } catch {
    return 0;
  }
};

export const rankKaaServers = (
  servers: readonly KaaServer[],
): Array<KaaServer & { src: string }> =>
  servers
    .filter((server): server is KaaServer & { src: string } =>
      Boolean(server.src),
    )
    .sort(
      (left, right) => scoreKaaServer(right.src) - scoreKaaServer(left.src),
    );

export const pickCatPlayerServer = (
  servers: Array<{ name?: string; src?: string }>,
) => rankKaaServers(servers)[0];

const mapCatPlayerSubtitles = (
  subtitles: Array<{ lang: string; name?: string; src: string }> | undefined,
): ScrapeSubtitle[] | undefined => {
  if (!subtitles?.length) {
    return undefined;
  }

  return subtitles.map((subtitle) => ({
    lang: subtitle.name ?? subtitle.lang,
    url: subtitle.src,
    format: "vtt" as const,
  }));
};

type KaaLangStream = {
  url: string;
  subtitles?: ScrapeSubtitle[];
};

type KaaLangStreamResult =
  | { ok: true; value: KaaLangStream }
  | { ok: false; error: string };

const resolveKaaLangStream = async (
  slug: string,
  lang: "ja-JP" | "en-US",
  episodeNumber: number,
): Promise<KaaLangStreamResult> => {
  const episodesResponse = await scrapeFetch(
    `${KAA_ORIGIN}/api/show/${slug}/episodes?page=1&lang=${lang}`,
    { headers: { Referer: `${KAA_ORIGIN}/` } },
  );

  if (!episodesResponse.ok) {
    await cancelResponseBody(episodesResponse);
    return {
      ok: false,
      error: `KAA episodes failed (${episodesResponse.status})`,
    };
  }

  const episodesPayload = (await episodesResponse.json()) as KaaEpisodeList;
  const episodeSlug = findEpisodeSlug(episodesPayload.result, episodeNumber);

  if (!episodeSlug) {
    return { ok: false, error: `KAA episode ${episodeNumber} not listed` };
  }

  const detailResponse = await scrapeFetch(
    `${KAA_ORIGIN}/api/show/${slug}/episode/${episodeSlug}`,
    { headers: { Referer: `${KAA_ORIGIN}/` } },
  );

  if (!detailResponse.ok) {
    await cancelResponseBody(detailResponse);
    return {
      ok: false,
      error: `KAA episode detail failed (${detailResponse.status})`,
    };
  }

  const detailPayload = (await detailResponse.json()) as KaaEpisodeDetail;
  const servers = detailPayload.result?.servers ?? detailPayload.servers ?? [];

  for (const server of rankKaaServers(servers)) {
    const playerUrl = normalizeCatPlayerUrl(server.src);
    const playerPage = await scrapeFetchText(playerUrl, {
      Referer: `${KAA_ORIGIN}/`,
    });

    const props = parseCatPlayerProps(playerPage.text);
    let manifest = typeof props?.manifest === "string" ? props.manifest : null;

    if (!manifest) {
      const fallbackUrls = extractM3u8Urls(playerPage.text);
      manifest =
        fallbackUrls.find((url) => /\/master\.m3u8(?:[?#]|$)/i.test(url)) ??
        fallbackUrls[0] ??
        null;
    }

    if (!manifest) {
      continue;
    }

    const streamUrl = manifest.startsWith("//")
      ? `https:${manifest}`
      : manifest;

    return {
      ok: true,
      value: {
        url: streamUrl,
        subtitles: mapCatPlayerSubtitles(props?.subtitles),
      },
    };
  }

  return { ok: false, error: "KAA cat-player URL missing" };
};

export async function scrapeKickassanime(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "kickassanime" as const;

  try {
    const { searchQueries, matchTitles } =
      await resolveAnimeSearchContext(input);
    let slug: string | null = null;

    for (const query of searchQueries) {
      const searchResponse = await scrapeFetch(`${KAA_ORIGIN}/api/fsearch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: KAA_ORIGIN,
          Referer: `${KAA_ORIGIN}/`,
        },
        body: JSON.stringify({ page: 1, query }),
      });

      if (!searchResponse.ok) {
        await cancelResponseBody(searchResponse);
        continue;
      }

      const searchPayload = (await searchResponse.json()) as KaaSearchResult;
      slug =
        selectKaaSearchResult(searchPayload.result, matchTitles)?.slug ?? null;
      if (slug) {
        break;
      }
    }

    if (!slug) {
      return { ok: false, providerId, error: "KAA show slug not found" };
    }

    // Sub and dub land on the same multi-audio master manifest (verified on
    // AOT, Naruto, Frieren) — the player's native audio-track menu plus
    // preferredAudioLang handles switching, so no per-language re-fetch.
    const primaryLang = input.translationType === "dub" ? "en-US" : "ja-JP";
    const primary = await resolveKaaLangStream(
      slug,
      primaryLang,
      input.episodeNumber,
    );

    if (!primary.ok) {
      return { ok: false, providerId, error: primary.error };
    }

    // Keep the master so HLS audio groups / ABR stay in the player UI.
    return {
      ok: true,
      providerId,
      streamUrl: primary.value.url,
      streamKind: "hls",
      referer: KAA_STREAM_REFERER,
      subtitles: primary.value.subtitles,
      preferredAudioLang: preferredAudioLangForTranslation(
        input.translationType,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "KickAssAnime scrape failed",
    };
  }
}

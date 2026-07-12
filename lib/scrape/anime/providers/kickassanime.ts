import { preferredAudioLangForTranslation } from "../audio-preference";
import { extractM3u8Urls, parseCatPlayerProps } from "../html-utils";
import {
  fetchAnilistTitleCandidates,
  resolveAnimeSearchQuery,
} from "../anilist-meta";
import { isExactAnimeTitleMatch } from "../title-match";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../../fetch";
import type { ScrapeSubtitle } from "../../types";

const KAA_ORIGIN = "https://kaa.lt";
/** Segment CDN requires the cat-player site referer — kaa.lt gets Cloudflare 403. */
const KAA_STREAM_REFERER = "https://krussdomi.com/";

type KaaSearchResult = {
  result?: Array<{ slug?: string; title?: string }>;
};

export const selectKaaSearchResult = (
  results: KaaSearchResult["result"],
  expectedTitles: readonly string[] | string,
) =>
  results?.find(
    (entry) =>
      Boolean(entry.slug && entry.title) &&
      isExactAnimeTitleMatch(
        entry.title ?? "",
        typeof expectedTitles === "string" ? [expectedTitles] : expectedTitles,
      ),
  );

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
  return url.toString();
};

const pickCatPlayerServer = (
  servers: Array<{ name?: string; src?: string }>,
) => {
  const withSrc = servers.filter((server) => Boolean(server.src));
  return (
    withSrc.find((server) => {
      try {
        const url = new URL(server.src!);
        return (
          url.searchParams.get("source") === "vidstream" ||
          url.searchParams.get("source") === "vidst"
        );
      } catch {
        return false;
      }
    }) ??
    withSrc.find((server) => {
      if (!server.src) return false;
      try {
        const url = new URL(server.src);
        return (
          /(^|\.)cat-player\./i.test(url.hostname) ||
          /\/cat-player(?:\/|$)/i.test(url.pathname) ||
          /(^|\.)krussdomi\.com$/i.test(url.hostname)
        );
      } catch {
        return false;
      }
    })
  );
};

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

export async function scrapeKickassanime(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "kickassanime" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
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
      return {
        ok: false,
        providerId,
        error: `KAA search failed (${searchResponse.status})`,
      };
    }

    const searchPayload = (await searchResponse.json()) as KaaSearchResult;
    const expectedTitles = [
      query,
      ...(await fetchAnilistTitleCandidates(input.anilistId)),
    ];
    const slug = selectKaaSearchResult(
      searchPayload.result,
      expectedTitles,
    )?.slug;
    if (!slug) {
      return { ok: false, providerId, error: "KAA show slug not found" };
    }

    const episodesResponse = await scrapeFetch(
      `${KAA_ORIGIN}/api/show/${slug}/episodes?page=1&lang=${input.translationType === "dub" ? "en-US" : "ja-JP"}`,
      { headers: { Referer: `${KAA_ORIGIN}/` } },
    );

    if (!episodesResponse.ok) {
      await cancelResponseBody(episodesResponse);
      return {
        ok: false,
        providerId,
        error: `KAA episodes failed (${episodesResponse.status})`,
      };
    }

    const episodesPayload = (await episodesResponse.json()) as KaaEpisodeList;
    const episodeSlug = findEpisodeSlug(
      episodesPayload.result,
      input.episodeNumber,
    );

    if (!episodeSlug) {
      return {
        ok: false,
        providerId,
        error: `KAA episode ${input.episodeNumber} not listed`,
      };
    }

    const detailResponse = await scrapeFetch(
      `${KAA_ORIGIN}/api/show/${slug}/episode/${episodeSlug}`,
      { headers: { Referer: `${KAA_ORIGIN}/` } },
    );

    if (!detailResponse.ok) {
      await cancelResponseBody(detailResponse);
      return {
        ok: false,
        providerId,
        error: `KAA episode detail failed (${detailResponse.status})`,
      };
    }

    const detailPayload = (await detailResponse.json()) as KaaEpisodeDetail;
    const servers =
      detailPayload.result?.servers ?? detailPayload.servers ?? [];
    const catPlayer = pickCatPlayerServer(servers);

    if (!catPlayer?.src) {
      return { ok: false, providerId, error: "KAA cat-player URL missing" };
    }

    const playerUrl = normalizeCatPlayerUrl(catPlayer.src);
    const playerPage = await scrapeFetchText(playerUrl, {
      Referer: `${KAA_ORIGIN}/`,
    });

    const props = parseCatPlayerProps(playerPage.text);
    let manifest = typeof props?.manifest === "string" ? props.manifest : null;

    if (!manifest) {
      const fallbackUrls = extractM3u8Urls(playerPage.text);
      manifest =
        fallbackUrls.find((url) => /\/master\.m3u8(?:[?#]|$)/i.test(url)) ??
        null;
    }

    if (!manifest) {
      return {
        ok: false,
        providerId,
        error: "KAA master.m3u8 not found in cat-player props",
      };
    }

    const streamUrl = manifest.startsWith("//")
      ? `https:${manifest}`
      : manifest;

    // Keep the master so HLS audio groups / ABR stay in the player UI.
    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "hls",
      referer: KAA_STREAM_REFERER,
      subtitles: mapCatPlayerSubtitles(props?.subtitles),
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

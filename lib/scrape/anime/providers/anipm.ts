import { fetchAnilistMediaMeta, type AnilistMediaMeta } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";

const ANIPM_ORIGIN = "https://ani.pm";
const ANIPM_API = `${ANIPM_ORIGIN}/api`;

type AnipmCatalogMatchResponse = {
  match?: {
    slug?: string;
  } | null;
};

type AnipmCatalogSource = {
  provider?: string;
  tok?: string;
  quality?: string;
};

type AnipmCatalogTitleResponse = {
  slug?: string;
  sources?: AnipmCatalogSource[];
};

type AnipmSrcServer = {
  kind?: string;
  url?: string;
  provider?: string;
  name?: string;
};

type AnipmSrcServersResponse = {
  sub?: AnipmSrcServer[];
  dub?: AnipmSrcServer[];
};

export const toAnipmEpisodeSlug = (
  matchedSlug: string,
  episodeNumber: number,
): string => {
  const withEpisode = matchedSlug.match(/^(.*)-(\d+)$/);
  if (withEpisode) {
    return `${withEpisode[1]}-${episodeNumber}`;
  }

  return episodeNumber === 1 ? matchedSlug : `${matchedSlug}-${episodeNumber}`;
};

const pickHentaiStream = (
  sources: AnipmCatalogSource[],
): { streamUrl: string; streamKind: "mp4" | "dash" } | null => {
  const mp4 = sources.find((source) => source.provider === "hentaiocean");
  if (mp4?.tok) {
    return {
      streamUrl: `${ANIPM_API}/hen/o8/mp4?slug=${encodeURIComponent(mp4.tok)}`,
      streamKind: "mp4",
    };
  }

  const dash = sources.find((source) => source.provider === "hstream");
  if (dash?.tok) {
    return {
      streamUrl: `${ANIPM_API}/hen/p3/mpd/${encodeURIComponent(dash.tok)}`,
      streamKind: "dash",
    };
  }

  return null;
};

const scrapeAnipmHentai = async (
  input: AnimeScrapeInput,
  meta: AnilistMediaMeta,
): Promise<AnimeScrapeResult> => {
  const providerId = "anipm" as const;
  const params = new URLSearchParams({
    anilistId: String(input.anilistId),
    title: meta.english ?? meta.titles[0] ?? "",
    romaji: meta.romaji ?? "",
    native: meta.native ?? "",
  });

  const matchResponse = await scrapeFetch(
    `${ANIPM_API}/hen/catalog/match?${params.toString()}`,
    { headers: { Referer: `${ANIPM_ORIGIN}/` } },
  );

  if (!matchResponse.ok) {
    await cancelResponseBody(matchResponse);
    return {
      ok: false,
      providerId,
      error: `ani.pm catalog match failed (${matchResponse.status})`,
    };
  }

  const matchPayload =
    (await matchResponse.json()) as AnipmCatalogMatchResponse;
  const matchedSlug = matchPayload.match?.slug;
  if (!matchedSlug) {
    return { ok: false, providerId, error: "ani.pm hentai catalog miss" };
  }

  const episodeSlug = toAnipmEpisodeSlug(matchedSlug, input.episodeNumber);
  const titleResponse = await scrapeFetch(
    `${ANIPM_API}/hen/catalog/title?slug=${encodeURIComponent(episodeSlug)}`,
    { headers: { Referer: `${ANIPM_ORIGIN}/hentai/${episodeSlug}` } },
  );

  if (!titleResponse.ok) {
    await cancelResponseBody(titleResponse);
    return {
      ok: false,
      providerId,
      error: `ani.pm episode not found (${episodeSlug})`,
    };
  }

  const titlePayload =
    (await titleResponse.json()) as AnipmCatalogTitleResponse;
  const stream = pickHentaiStream(titlePayload.sources ?? []);
  if (!stream) {
    return { ok: false, providerId, error: "ani.pm hentai stream missing" };
  }

  return {
    ok: true,
    providerId,
    streamUrl: stream.streamUrl,
    streamKind: stream.streamKind,
    referer: `${ANIPM_ORIGIN}/hentai/${episodeSlug}`,
  };
};

const scrapeAnipmAnime = async (
  input: AnimeScrapeInput,
  meta: AnilistMediaMeta,
): Promise<AnimeScrapeResult> => {
  const providerId = "anipm" as const;
  const params = new URLSearchParams({
    title: meta.english ?? meta.romaji ?? meta.titles[0] ?? "",
    ep: String(input.episodeNumber),
    anilistId: String(input.anilistId),
  });

  const serversResponse = await scrapeFetch(
    `${ANIPM_API}/anime/src/servers?${params.toString()}`,
    { headers: { Referer: `${ANIPM_ORIGIN}/` } },
  );

  if (!serversResponse.ok) {
    await cancelResponseBody(serversResponse);
    return {
      ok: false,
      providerId,
      error: `ani.pm servers failed (${serversResponse.status})`,
    };
  }

  const serversPayload =
    (await serversResponse.json()) as AnipmSrcServersResponse;
  const lane =
    input.translationType === "dub"
      ? (serversPayload.dub ?? [])
      : (serversPayload.sub ?? []);
  const direct = lane.find((server) => server.kind === "file" && server.url);

  if (!direct?.url) {
    return { ok: false, providerId, error: "ani.pm direct file missing" };
  }

  const streamUrl = direct.url.startsWith("http")
    ? direct.url
    : `${ANIPM_ORIGIN}${direct.url}`;

  return {
    ok: true,
    providerId,
    streamUrl,
    streamKind: "mp4",
    referer: `${ANIPM_ORIGIN}/`,
  };
};

export async function scrapeAnipm(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anipm" as const;

  try {
    const meta = await fetchAnilistMediaMeta(input.anilistId);
    if (!meta || meta.titles.length === 0) {
      return {
        ok: false,
        providerId,
        error: "ani.pm title metadata missing",
      };
    }

    if (meta.isAdult) {
      return scrapeAnipmHentai(input, meta);
    }

    const animeResult = await scrapeAnipmAnime(input, meta);
    if (animeResult.ok) {
      return animeResult;
    }

    return animeResult;
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "ani.pm scrape failed",
    };
  }
}

import { fetchAnilistMediaMeta, type AnilistMediaMeta } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";
import type { StreamKind } from "../../stream-url-patterns";

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

type ResolvedAnipmStream = {
  streamUrl: string;
  streamKind: StreamKind;
  label: string;
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

const mapHentaiStreams = (
  sources: AnipmCatalogSource[],
): ResolvedAnipmStream[] => {
  const streams: ResolvedAnipmStream[] = [];

  for (const source of sources) {
    if (source.provider === "hentaiocean" && source.tok) {
      streams.push({
        streamUrl: `${ANIPM_API}/hen/o8/mp4?slug=${encodeURIComponent(source.tok)}`,
        streamKind: "mp4",
        label: source.quality?.trim() || "MP4",
      });
      continue;
    }

    if (source.provider === "hstream" && source.tok) {
      streams.push({
        streamUrl: `${ANIPM_API}/hen/p3/mpd/${encodeURIComponent(source.tok)}`,
        streamKind: "dash",
        label: source.quality?.trim() || "DASH",
      });
    }
  }

  return streams;
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
  const streams = mapHentaiStreams(titlePayload.sources ?? []);
  const primary = streams[0];
  if (!primary) {
    return { ok: false, providerId, error: "ani.pm hentai stream missing" };
  }

  const sameKind = streams.filter(
    (stream) => stream.streamKind === primary.streamKind,
  );
  const qualities: ScrapeQuality[] = sameKind.slice(1).map((stream) => ({
    label: stream.label,
    url: stream.streamUrl,
  }));

  return {
    ok: true,
    providerId,
    streamUrl: primary.streamUrl,
    streamKind: primary.streamKind,
    referer: `${ANIPM_ORIGIN}/hentai/${episodeSlug}`,
    qualities: qualities.length > 0 ? qualities : undefined,
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
  const files = lane.filter((server) => server.kind === "file" && server.url);

  if (files.length === 0) {
    return { ok: false, providerId, error: "ani.pm direct file missing" };
  }

  const toAbsolute = (url: string) =>
    url.startsWith("http") ? url : `${ANIPM_ORIGIN}${url}`;

  const primary = files[0]!;
  const streamUrl = toAbsolute(primary.url!);
  const qualities: ScrapeQuality[] = files.slice(1).map((server, index) => ({
    label:
      server.name?.trim() || server.provider?.trim() || `Source ${index + 2}`,
    url: toAbsolute(server.url!),
  }));

  return {
    ok: true,
    providerId,
    streamUrl,
    streamKind: "mp4",
    referer: `${ANIPM_ORIGIN}/`,
    qualities: qualities.length > 0 ? qualities : undefined,
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

    return scrapeAnipmAnime(input, meta);
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "ani.pm scrape failed",
    };
  }
}

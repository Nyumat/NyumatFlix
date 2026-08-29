import { fetchAnilistMediaMeta, type AnilistMediaMeta } from "../anilist-meta";
import { expandAdultAnimeSlugAliases } from "../adult-title-slug-aliases";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";
import {
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../../playback-probe";
import { firstOkInBatches } from "../../race-first";
import type { StreamKind } from "../../stream-url-patterns";

const ANIPM_ORIGIN = "https://ani.pm";
const ANIPM_API = `${ANIPM_ORIGIN}/api`;
export const ANIPM_SERVER_TIMEOUT_MS = SCRAPE_PLAY_PROBE_TIMEOUT_MS;
export const ANIPM_CANDIDATE_TIMEOUT_MS = SCRAPE_PLAY_PROBE_TIMEOUT_MS;
export const PLAYABLE_CANDIDATE_BATCH = 3;

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

type AnipmDirectKind = "file" | "hls" | "dash";

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

const isAnipmDirectKind = (
  value: string | undefined,
): value is AnipmDirectKind =>
  value === "file" || value === "hls" || value === "dash";

const anipmStreamKind = (kind: AnipmDirectKind): StreamKind => {
  switch (kind) {
    case "file":
      return "mp4";
    case "hls":
      return "hls";
    case "dash":
      return "dash";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

const rankAnipmKind = (kind: AnipmDirectKind): number => {
  switch (kind) {
    case "file":
      return 3;
    case "hls":
      return 2;
    case "dash":
      return 1;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
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

const buildAnipmHentaiEpisodeSlugCandidates = (
  matchedSlug: string,
  episodeNumber: number,
): string[] => {
  const seriesBase = matchedSlug.replace(/-\d+$/, "");
  const roots = uniqueNonEmpty([matchedSlug, seriesBase]);

  const candidates = roots.flatMap((root) =>
    expandAdultAnimeSlugAliases(toAnipmEpisodeSlug(root, episodeNumber)),
  );

  return uniqueNonEmpty(candidates);
};

const uniqueNonEmpty = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const probeAnipmStream = async (
  stream: ResolvedAnipmStream,
  referer: string,
): Promise<true | null> => {
  const ok = await probeScrapePlaybackPath(
    {
      url: stream.streamUrl,
      referer,
    },
    stream.streamKind,
    {
      timeoutMs: ANIPM_CANDIDATE_TIMEOUT_MS,
      retryAttempts: 1,
    },
  );
  return ok ? true : null;
};

const firstPlayableAnipmStream = async (
  streams: readonly ResolvedAnipmStream[],
  referer: string,
): Promise<ResolvedAnipmStream | null> => {
  const winner = await firstOkInBatches(
    streams,
    (stream) => probeAnipmStream(stream, referer),
    PLAYABLE_CANDIDATE_BATCH,
  );
  return winner?.item ?? null;
};

const mapHentaiStreams = (
  sources: AnipmCatalogSource[],
): ResolvedAnipmStream[] => {
  const streams: ResolvedAnipmStream[] = [];

  for (const source of sources) {
    if (
      (source.provider === "hentaiocean" || source.provider === "hanime") &&
      source.tok
    ) {
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
    {
      headers: { Referer: `${ANIPM_ORIGIN}/` },
      timeoutMs: ANIPM_SERVER_TIMEOUT_MS,
      retryAttempts: 1,
    },
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

  const episodeSlugCandidates = buildAnipmHentaiEpisodeSlugCandidates(
    matchedSlug,
    input.episodeNumber,
  );

  let titlePayload: AnipmCatalogTitleResponse | null = null;
  let episodeSlug: string | null = null;

  for (const candidate of episodeSlugCandidates) {
    const titleResponse = await scrapeFetch(
      `${ANIPM_API}/hen/catalog/title?slug=${encodeURIComponent(candidate)}`,
      {
        headers: { Referer: `${ANIPM_ORIGIN}/hentai/${candidate}` },
        timeoutMs: ANIPM_SERVER_TIMEOUT_MS,
        retryAttempts: 1,
      },
    );

    if (!titleResponse.ok) {
      await cancelResponseBody(titleResponse);
      continue;
    }

    titlePayload = (await titleResponse.json()) as AnipmCatalogTitleResponse;
    episodeSlug = candidate;
    break;
  }

  if (!titlePayload || !episodeSlug) {
    return {
      ok: false,
      providerId,
      error: `ani.pm episode not found (${episodeSlugCandidates.join(", ")})`,
    };
  }
  const streams = mapHentaiStreams(titlePayload.sources ?? []);
  const referer = `${ANIPM_ORIGIN}/hentai/${episodeSlug}`;
  const primary = await firstPlayableAnipmStream(streams, referer);
  if (!primary) {
    return { ok: false, providerId, error: "ani.pm hentai stream missing" };
  }

  const sameKind = streams.filter(
    (stream) =>
      stream.streamKind === primary.streamKind &&
      stream.streamUrl !== primary.streamUrl,
  );
  const qualities: ScrapeQuality[] = sameKind.map((stream) => ({
    label: stream.label,
    url: stream.streamUrl,
  }));

  return {
    ok: true,
    providerId,
    validated: true,
    streamUrl: primary.streamUrl,
    streamKind: primary.streamKind,
    referer,
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
    {
      headers: { Referer: `${ANIPM_ORIGIN}/` },
      timeoutMs: ANIPM_SERVER_TIMEOUT_MS,
      retryAttempts: 1,
    },
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

  const toAbsolute = (url: string) =>
    url.startsWith("http") ? url : `${ANIPM_ORIGIN}${url}`;

  const playable = lane
    .filter(
      (
        server,
      ): server is AnipmSrcServer & { kind: AnipmDirectKind; url: string } =>
        Boolean(server.url) && isAnipmDirectKind(server.kind),
    )
    .sort((left, right) => rankAnipmKind(right.kind) - rankAnipmKind(left.kind))
    .map((server) => ({
      streamUrl: toAbsolute(server.url),
      streamKind: anipmStreamKind(server.kind),
      label: server.name?.trim() || server.provider?.trim() || server.kind,
    }));

  if (playable.length === 0) {
    return { ok: false, providerId, error: "ani.pm direct file missing" };
  }

  const referer = `${ANIPM_ORIGIN}/`;
  const primary = await firstPlayableAnipmStream(playable, referer);
  if (!primary) {
    return { ok: false, providerId, error: "ani.pm direct file missing" };
  }

  const qualities: ScrapeQuality[] = playable
    .filter(
      (stream) =>
        stream.streamKind === primary.streamKind &&
        stream.streamUrl !== primary.streamUrl,
    )
    .map((stream, index) => ({
      label: stream.label || `Source ${index + 2}`,
      url: stream.streamUrl,
    }));

  return {
    ok: true,
    providerId,
    validated: true,
    streamUrl: primary.streamUrl,
    streamKind: primary.streamKind,
    referer,
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

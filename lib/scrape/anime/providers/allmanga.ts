import {
  decodeAllanimeProviderPath,
  normalizeAllanimeApiResponse,
  type AllanimeSourceUrl,
} from "../allanime-crypto";
import { extractM3u8Urls, isDirectMediaUrl } from "../html-utils";
import { resolveAnimeSearchQueries } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality } from "../../types";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../../fetch";
import { isExactAnimeTitleMatch } from "../title-match";

const ALLMANGA_ORIGIN = "https://allmanga.to";
const ALLANIME_API = "https://api.allanime.day/api";
const ALLANIME_HOST = "https://allanime.day";

/** Persisted episode query hash used by allmanga.to / ani-cli (POST episode GQL regresses). */
const ALLANIME_EPISODE_PERSISTED_HASH =
  "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

const SEARCH_GQL = `query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name englishName nativeName aniListId availableEpisodesDetail __typename } }}`;

export type AllanimeShowEdge = {
  _id?: string;
  name?: string;
  englishName?: string | null;
  nativeName?: string | null;
  aniListId?: string | null;
};

type AllanimeSearchResponse = {
  data?: {
    shows?: {
      edges?: AllanimeShowEdge[];
    };
  };
};

type AllanimeEpisodeResponse = {
  data?: {
    episode?: {
      sourceUrls?: AllanimeSourceUrl[];
    } | null;
  };
};

export const selectAllmangaShow = (
  shows: AllanimeShowEdge[],
  expectedTitles: readonly string[] | string,
  anilistId?: number,
) => {
  const titles =
    typeof expectedTitles === "string" ? [expectedTitles] : expectedTitles;

  // AllAnime renames popular shows (e.g. One Piece → "1P"); prefer stable AniList IDs.
  if (anilistId != null) {
    const anilistKey = String(anilistId);
    const byAniListId = shows.find(
      (show) => Boolean(show._id) && show.aniListId === anilistKey,
    );
    if (byAniListId) {
      return byAniListId;
    }
  }

  return shows.find((show) => {
    if (!show._id) {
      return false;
    }

    const candidates = [show.name, show.englishName, show.nativeName].filter(
      (value): value is string => Boolean(value),
    );
    return candidates.some((candidate) =>
      isExactAnimeTitleMatch(candidate, titles),
    );
  });
};

const allanimePost = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await scrapeFetch(ALLANIME_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `${ALLMANGA_ORIGIN}/`,
      Origin: ALLMANGA_ORIGIN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`AllManga API failed (${response.status})`);
  }

  return normalizeAllanimeApiResponse<T>(await response.json());
};

const allanimePersistedGet = async <T>(
  variables: Record<string, unknown>,
  sha256Hash: string,
): Promise<T> => {
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash },
    }),
  });

  const response = await scrapeFetch(`${ALLANIME_API}?${params.toString()}`, {
    method: "GET",
    headers: {
      Referer: `${ALLMANGA_ORIGIN}/`,
      Origin: ALLMANGA_ORIGIN,
    },
  });

  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`AllManga persisted query failed (${response.status})`);
  }

  return normalizeAllanimeApiResponse<T>(await response.json());
};

const extractSourceUrls = (
  payload: AllanimeEpisodeResponse,
): AllanimeSourceUrl[] => payload.data?.episode?.sourceUrls ?? [];

const fetchEpisodeSources = async (
  showId: string,
  episodeString: string,
  mode: "sub" | "dub",
): Promise<AllanimeSourceUrl[]> => {
  const variables = {
    showId,
    translationType: mode,
    episodeString,
  };

  // Prefer persisted GET — inline POST episode queries currently 500 with countryOfOrigin errors.
  const persisted = await allanimePersistedGet<AllanimeEpisodeResponse>(
    variables,
    ALLANIME_EPISODE_PERSISTED_HASH,
  );
  return extractSourceUrls(persisted);
};

type ResolvedAllanimeStream = {
  url: string;
  kind: "hls" | "mp4";
  qualities?: ScrapeQuality[];
};

const mediaKindFromUrl = (url: string): "hls" | "mp4" | null => {
  if (!isDirectMediaUrl(url)) {
    return null;
  }
  try {
    const { pathname } = new URL(url);
    if (/\.m3u8$/i.test(pathname)) {
      return "hls";
    }
    if (/\.mp4$/i.test(pathname)) {
      return "mp4";
    }
  } catch {
    return null;
  }
  return null;
};

const qualityLabelFromUrl = (url: string, index: number): string => {
  const height = url.match(/(\d{3,4})p/i)?.[1];
  if (height) {
    return `${height}p`;
  }
  return `Source ${index + 1}`;
};

const resolveFromClockLinks = (
  links: Array<{ link?: string; hls?: boolean }>,
): ResolvedAllanimeStream | null => {
  const playable = links
    .map((entry, index) => {
      const link = entry.link;
      if (!link || !isDirectMediaUrl(link)) {
        return null;
      }
      const kind =
        entry.hls || /\.m3u8$/i.test(new URL(link).pathname)
          ? ("hls" as const)
          : mediaKindFromUrl(link);
      if (!kind) {
        return null;
      }
      return { link, kind, index };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (playable.length === 0) {
    return null;
  }

  const primary =
    playable.find((entry) => entry.kind === "hls") ?? playable[0]!;
  const qualities = playable
    .filter((entry) => entry.link !== primary.link)
    .map((entry) => ({
      label: qualityLabelFromUrl(entry.link, entry.index),
      url: entry.link,
    }));

  return {
    url: primary.link,
    kind: primary.kind,
    qualities: qualities.length > 0 ? qualities : undefined,
  };
};

const resolveAllanimeProviderLink = async (
  providerPath: string,
): Promise<ResolvedAllanimeStream | null> => {
  const normalized = normalizeAllanimeProviderUrl(providerPath);

  const directKind = mediaKindFromUrl(normalized);
  if (directKind) {
    return { url: normalized, kind: directKind };
  }

  const page = await scrapeFetchText(normalized, {
    Referer: `${ALLMANGA_ORIGIN}/`,
  });

  if (page.status !== 200) {
    return null;
  }

  try {
    const clock = JSON.parse(page.text) as {
      links?: Array<{ link?: string; hls?: boolean }>;
    };
    const fromClock = resolveFromClockLinks(clock.links ?? []);
    if (fromClock) {
      return fromClock;
    }
  } catch {
    void 0;
  }

  const m3u8 =
    extractM3u8Urls(page.text).find((url) => isDirectMediaUrl(url)) ??
    page.text.match(/"link"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"/)?.[1] ??
    page.text.match(/"url"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"/)?.[1] ??
    page.text.match(/(https?:\/\/[^\s"'<>]+master\.m3u8)/)?.[1];

  if (m3u8 && isDirectMediaUrl(m3u8)) {
    return { url: m3u8, kind: "hls" };
  }

  // Prefer player src/file attributes over bare .mp4 hostname matches.
  const quotedUrls = [
    ...page.text.matchAll(
      /(?:src|file|source)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi,
    ),
  ]
    .map((match) => match[1])
    .filter((url): url is string => Boolean(url));

  const playerSrcBlock = page.text.match(
    /player\.src\s*\(\s*\{([\s\S]*?)\}\s*\)/i,
  )?.[1];
  if (playerSrcBlock) {
    const blockUrl = playerSrcBlock.match(
      /src:\s*["'](https?:\/\/[^"']+)["']/i,
    )?.[1];
    if (blockUrl) {
      quotedUrls.unshift(blockUrl);
    }
  }

  const playerMp4 = quotedUrls.find((url) => {
    try {
      return /\.mp4$/i.test(new URL(url).pathname);
    } catch {
      return false;
    }
  });

  if (playerMp4 && isDirectMediaUrl(playerMp4)) {
    return { url: playerMp4, kind: "mp4" };
  }

  const absoluteMedia = [
    ...(page.text.match(/https?:\/\/[^"'\\\s<>]+/gi) ?? []),
  ].find((url) => isDirectMediaUrl(url));
  if (absoluteMedia) {
    const kind = mediaKindFromUrl(absoluteMedia);
    if (kind) {
      return { url: absoluteMedia, kind };
    }
  }

  const hlsBlock = page.text.match(/"hls"\s*,\s*"url"\s*:\s*"([^"]+)"/);
  if (hlsBlock?.[1] && isDirectMediaUrl(hlsBlock[1])) {
    return { url: hlsBlock[1], kind: "hls" };
  }

  return null;
};

const preferredSourceRank = (source: AllanimeSourceUrl): number => {
  const name = source.sourceName ?? "";
  if (source.sourceName === "Default") {
    return 400;
  }
  if (source.sourceUrl?.startsWith("--")) {
    return 300;
  }
  if (source.type === "hls" || /hls/i.test(name)) {
    return 200;
  }
  if (source.type === "player" || /default/i.test(name)) {
    return 150;
  }
  return source.priority ?? 0;
};

const pickAllanimeSources = (
  sources: AllanimeSourceUrl[],
): AllanimeSourceUrl[] => {
  const ranked = [...sources].sort(
    (a, b) => preferredSourceRank(b) - preferredSourceRank(a),
  );

  const seen = new Set<string>();
  return ranked.filter((source) => {
    const key = source.sourceUrl ?? "";
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeAllanimeProviderUrl = (providerPath: string): string => {
  if (providerPath.startsWith("//")) {
    return `https:${providerPath}`;
  }
  if (providerPath.startsWith("http")) {
    return providerPath;
  }
  return `${ALLANIME_HOST}${providerPath.startsWith("/") ? providerPath : `/${providerPath}`}`;
};

const refererForResolvedStream = (streamUrl: string): string => {
  try {
    const host = new URL(streamUrl).hostname.toLowerCase();
    if (host.includes("mp4upload")) {
      return "https://www.mp4upload.com/";
    }
    if (host.includes("streamsb") || host.includes("watchsb")) {
      return "https://streamsb.net/";
    }
  } catch {
    void 0;
  }
  return ALLMANGA_ORIGIN;
};

const resolveAllanimeSource = async (
  source: AllanimeSourceUrl,
): Promise<ResolvedAllanimeStream | null> => {
  if (!source.sourceUrl) {
    return null;
  }

  if (source.sourceUrl.startsWith("--")) {
    const providerPath = decodeAllanimeProviderPath(source.sourceUrl);
    return resolveAllanimeProviderLink(providerPath);
  }

  if (source.sourceUrl.startsWith("http")) {
    return resolveAllanimeProviderLink(source.sourceUrl);
  }

  return null;
};

export async function scrapeAllmanga(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "allmanga" as const;

  try {
    const expectedTitles = await resolveAnimeSearchQueries(input);
    const mode = input.translationType === "dub" ? "dub" : "sub";

    let showId: string | undefined;
    for (const query of expectedTitles) {
      const searchPayload = await allanimePost<AllanimeSearchResponse>(
        SEARCH_GQL,
        {
          search: { allowAdult: false, allowUnknown: false, query },
          limit: 40,
          page: 1,
          translationType: mode,
          countryOrigin: "ALL",
        },
      );

      showId = selectAllmangaShow(
        searchPayload.data?.shows?.edges ?? [],
        expectedTitles,
        input.anilistId,
      )?._id;
      if (showId) {
        break;
      }
    }
    if (!showId) {
      return { ok: false, providerId, error: "AllManga show not found" };
    }

    const sources = await fetchEpisodeSources(
      showId,
      String(input.episodeNumber),
      mode,
    );

    const candidates = pickAllanimeSources(sources);
    if (candidates.length === 0) {
      return {
        ok: false,
        providerId,
        error: "AllManga returned no source URLs",
      };
    }

    let fallback: ResolvedAllanimeStream | null = null;
    for (const candidate of candidates) {
      const resolved = await resolveAllanimeSource(candidate);
      if (!resolved) {
        continue;
      }

      if (resolved.kind === "hls") {
        return {
          ok: true,
          providerId,
          streamUrl: resolved.url,
          streamKind: resolved.kind,
          referer: refererForResolvedStream(resolved.url),
          qualities: resolved.qualities,
        };
      }

      fallback ??= resolved;
    }

    if (fallback) {
      return {
        ok: true,
        providerId,
        streamUrl: fallback.url,
        streamKind: fallback.kind,
        referer: refererForResolvedStream(fallback.url),
        qualities: fallback.qualities,
      };
    }

    return {
      ok: false,
      providerId,
      error: "AllManga source could not be resolved to a stream",
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AllManga scrape failed",
    };
  }
}

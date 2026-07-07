import {
  decryptAllanimeTobeparsed,
  decodeAllanimeProviderPath,
  type AllanimeEpisodePayload,
  type AllanimeSourceUrl,
} from "../allanime-crypto";
import { extractM3u8Urls } from "../html-utils";
import { resolveAnimeSearchQuery } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetch, scrapeFetchText } from "../../fetch";

const ALLMANGA_ORIGIN = "https://allmanga.to";
const ALLANIME_API = "https://api.allanime.day/api";
const ALLANIME_HOST = "https://allanime.day";

const SEARCH_GQL = `query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name availableEpisodesDetail __typename } }}`;

const EPISODE_GQL = `query($showId: String! $translationType: VaildTranslationTypeEnumType! $episodeString: String!) { episode(showId: $showId translationType: $translationType episodeString: $episodeString) { episodeString sourceUrls } }`;

type AllanimeSearchResponse = {
  data?: {
    shows?: {
      edges?: Array<{ _id?: string; name?: string }>;
    };
  };
};

const titleTokens = (title: string): Set<string> =>
  new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 1 && token !== "no"),
  );

export const selectAllmangaShow = (
  shows: Array<{ _id?: string; name?: string }>,
  query: string,
) => {
  const queryTokens = titleTokens(query);

  return [...shows].sort((left, right) => {
    const score = (name?: string) => {
      if (!name) return -1;
      const candidateTokens = titleTokens(name);
      const overlap = [...queryTokens].filter((token) =>
        candidateTokens.has(token),
      ).length;
      const extras = [...candidateTokens].filter(
        (token) => !queryTokens.has(token),
      ).length;
      return overlap * 10 - extras;
    };

    return score(right.name) - score(left.name);
  })[0];
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
    throw new Error(`AllManga API failed (${response.status})`);
  }

  const json = (await response.json()) as unknown;
  if (json && typeof json === "object" && "data" in json) {
    const dataField = (json as { data?: { tobeparsed?: string } }).data;
    if (dataField?.tobeparsed) {
      return { data: decryptAllanimeTobeparsed(dataField.tobeparsed) } as T;
    }
  }

  return json as T;
};

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
  const response = await scrapeFetch(ALLANIME_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `${ALLMANGA_ORIGIN}/`,
      Origin: ALLMANGA_ORIGIN,
    },
    body: JSON.stringify({ query: EPISODE_GQL, variables }),
  });

  if (!response.ok) {
    throw new Error(`AllManga episode query failed (${response.status})`);
  }

  const json = (await response.json()) as unknown;
  const normalized =
    json && typeof json === "object" && "data" in json
      ? (json as {
          data?: {
            tobeparsed?: string;
            episode?: { sourceUrls?: AllanimeSourceUrl[] };
          };
        })
      : null;
  if (normalized?.data?.episode?.sourceUrls) {
    return normalized.data.episode.sourceUrls;
  }
  if (!normalized?.data?.tobeparsed) return [];

  const decrypted = decryptAllanimeTobeparsed(normalized.data.tobeparsed) as {
    episode?: { sourceUrls?: AllanimeSourceUrl[] };
  };

  return decrypted.episode?.sourceUrls ?? [];
};

const resolveAllanimeProviderLink = async (
  providerPath: string,
): Promise<{ url: string; kind: "hls" | "mp4" } | null> => {
  const normalized = providerPath.startsWith("http")
    ? providerPath
    : `${ALLANIME_HOST}${providerPath.startsWith("/") ? providerPath : `/${providerPath}`}`;

  const page = await scrapeFetchText(normalized, {
    Referer: `${ALLMANGA_ORIGIN}/`,
  });

  if (page.status !== 200) {
    return null;
  }

  const m3u8 =
    extractM3u8Urls(page.text).find((url) => url.includes(".m3u8")) ??
    page.text.match(/"url"\s*:\s*"(https?:[^"]+\.m3u8[^"]*)"/)?.[1] ??
    page.text.match(/(https?:\/\/[^\s"'<>]+master\.m3u8)/)?.[1];

  if (m3u8) {
    return { url: m3u8, kind: "hls" };
  }

  const mp4 = page.text.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/)?.[1];
  if (mp4) {
    return { url: mp4, kind: "mp4" };
  }

  const hlsBlock = page.text.match(/"hls"\s*,\s*"url"\s*:\s*"([^"]+)"/);
  if (hlsBlock?.[1]) {
    return { url: hlsBlock[1], kind: "hls" };
  }

  return null;
};

const pickAllanimeSource = (
  sources: AllanimeSourceUrl[],
): AllanimeSourceUrl | null => {
  const ranked = [...sources].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );

  return (
    ranked.find((source) => source.sourceName === "Default") ??
    ranked.find((source) => source.sourceUrl?.startsWith("--")) ??
    ranked.find((source) => source.type === "hls") ??
    ranked[0] ??
    null
  );
};

export async function scrapeAllmanga(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "allmanga" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
    const mode = input.translationType === "dub" ? "dub" : "sub";

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

    const showId = selectAllmangaShow(
      searchPayload.data?.shows?.edges ?? [],
      query,
    )?._id;
    if (!showId) {
      return { ok: false, providerId, error: "AllManga show not found" };
    }

    const sources = await fetchEpisodeSources(
      showId,
      String(input.episodeNumber),
      mode,
    );

    const selected = pickAllanimeSource(sources);
    if (!selected?.sourceUrl) {
      return {
        ok: false,
        providerId,
        error: "AllManga returned no source URLs",
      };
    }

    if (selected.sourceUrl.startsWith("http")) {
      const resolved = await resolveAllanimeProviderLink(selected.sourceUrl);
      if (resolved) {
        return {
          ok: true,
          providerId,
          streamUrl: resolved.url,
          streamKind: resolved.kind,
          referer: ALLMANGA_ORIGIN,
        };
      }
    }

    if (selected.sourceUrl.startsWith("--")) {
      const providerPath = decodeAllanimeProviderPath(selected.sourceUrl);
      const resolved = await resolveAllanimeProviderLink(providerPath);
      if (resolved) {
        return {
          ok: true,
          providerId,
          streamUrl: resolved.url,
          streamKind: resolved.kind,
          referer: ALLMANGA_ORIGIN,
        };
      }
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

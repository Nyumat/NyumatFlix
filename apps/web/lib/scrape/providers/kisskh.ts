import { cancelResponseBody, scrapeFetch } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import { resolveWingsTmdbLookup } from "../tmdb-lookup";
import { getKisskhKey } from "./kisskh-kkey";
import {
  KISSKH_DETAIL_LOOKUP_LIMIT,
  pickKisskhDrama,
  pickKisskhEpisode,
  pickKisskhSearchHits,
  type KisskhDramaCandidate,
  type KisskhEpisode,
  type KisskhSearchHit,
} from "./kisskh-match";

const KISSKH_ORIGIN = "https://kisskh.co";

const kisskhHeaders = {
  Accept: "application/json",
  Referer: `${KISSKH_ORIGIN}/`,
  Origin: KISSKH_ORIGIN,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readSearchHits = (value: unknown): KisskhSearchHit[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const hits: KisskhSearchHit[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    if (typeof entry.id !== "number" || typeof entry.title !== "string") {
      continue;
    }
    hits.push({ id: entry.id, title: entry.title });
  }
  return hits;
};

const readEpisodes = (value: unknown): KisskhEpisode[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const episodes: KisskhEpisode[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    if (typeof entry.id !== "number" || typeof entry.number !== "number") {
      continue;
    }
    episodes.push({ id: entry.id, number: entry.number });
  }
  return episodes;
};

const readDrama = (
  value: unknown,
  fallback: KisskhSearchHit,
): KisskhDramaCandidate | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "number" ? value.id : fallback.id;
  const title = typeof value.title === "string" ? value.title : fallback.title;
  const type = typeof value.type === "string" ? value.type : undefined;
  return {
    id,
    title,
    type,
    episodes: readEpisodes(value.episodes),
  };
};

const readStreamUrl = (value: unknown): string | null => {
  if (!isRecord(value) || typeof value.Video !== "string") {
    return null;
  }
  if (!value.Video.startsWith("http")) {
    return null;
  }
  return value.Video;
};

const fetchKisskhJson = async (
  url: string,
  signal?: AbortSignal,
): Promise<unknown | null> => {
  const response = await scrapeFetch(url, {
    headers: { ...kisskhHeaders },
    signal,
    timeoutMs: 12_000,
    retryAttempts: 1,
  });

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

export async function scrapeKisskh(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "kisskh" as const;

  try {
    const lookup = await resolveWingsTmdbLookup(input);
    if (!lookup) {
      return {
        ok: false,
        providerId,
        error: "KissKH needs a TMDB title",
      };
    }

    const searchUrl = `${KISSKH_ORIGIN}/api/DramaList/Search?q=${encodeURIComponent(lookup.title)}&type=0`;
    const hits = pickKisskhSearchHits(
      readSearchHits(await fetchKisskhJson(searchUrl, input.signal)),
      lookup.title,
    ).slice(0, KISSKH_DETAIL_LOOKUP_LIMIT);

    if (hits.length === 0) {
      return {
        ok: false,
        providerId,
        error: "KissKH has no matching title",
      };
    }

    const dramas = (
      await Promise.all(
        hits.map(async (hit) => {
          const payload = await fetchKisskhJson(
            `${KISSKH_ORIGIN}/api/DramaList/Drama/${hit.id}?isq=false`,
            input.signal,
          );
          return readDrama(payload, hit);
        }),
      )
    ).filter((drama): drama is KisskhDramaCandidate => drama !== null);

    const drama = pickKisskhDrama(dramas, input.mediaType);
    const episode = drama
      ? pickKisskhEpisode(drama.episodes, {
          mediaType: input.mediaType,
          episodeNumber: input.episodeNumber,
        })
      : null;

    if (!episode) {
      return {
        ok: false,
        providerId,
        error: "KissKH has no matching episode",
      };
    }

    const key = getKisskhKey({ id: episode.id, subOrVid: "vid" });
    const streamUrl = readStreamUrl(
      await fetchKisskhJson(
        `${KISSKH_ORIGIN}/api/DramaList/Episode/${episode.id}.png?err=false&kkey=${key}`,
        input.signal,
      ),
    );

    if (!streamUrl) {
      return {
        ok: false,
        providerId,
        error: "KissKH returned no stream",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl,
      referer: `${KISSKH_ORIGIN}/`,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "KissKH scrape failed",
    };
  }
}

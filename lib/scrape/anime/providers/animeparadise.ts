import { preferredAudioLangForTranslation } from "../audio-preference";
import { resolveAnimeSearchQuery } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";

const PARADISE_ORIGIN = "https://www.animeparadise.moe";
const PARADISE_API = "https://api.animeparadise.moe";
const PARADISE_STREAM = "https://stream.animeparadise.moe";

type ParadiseSearchHit = {
  _id?: string;
  title?: string;
  link?: string;
};

type ParadiseEpisode = {
  uid?: string;
  number?: string | number;
};

type ParadiseAnimeDetail = {
  _id?: string;
  mappings?: { anilist?: number | null };
};

type ParadiseEpisodePayload = {
  episode?: {
    streamLink?: string;
    subData?: Array<{ src?: string; lang?: string; label?: string }>;
  };
};

const paradiseHeaders = {
  Accept: "application/json",
  Origin: PARADISE_ORIGIN,
  Referer: `${PARADISE_ORIGIN}/`,
};

const unwrapData = <T>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as { data?: T };
  if ("data" in record) {
    return (record.data ?? null) as T | null;
  }
  return payload as T;
};

const fetchJson = async <T>(url: string): Promise<T | null> => {
  const response = await scrapeFetch(url, { headers: paradiseHeaders });
  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }
  return unwrapData<T>(await response.json());
};

const resolveAnimeId = async (
  anilistId: number,
  query: string,
): Promise<string | null> => {
  const hits =
    (await fetchJson<ParadiseSearchHit[]>(
      `${PARADISE_API}/search?q=${encodeURIComponent(query)}`,
    )) ?? [];

  for (const hit of hits.slice(0, 10)) {
    if (!hit._id && !hit.link) continue;
    const detail = await fetchJson<ParadiseAnimeDetail>(
      `${PARADISE_API}/anime/${hit.link ?? hit._id}`,
    );
    if (detail?.mappings?.anilist === anilistId) {
      return detail._id ?? hit._id ?? null;
    }
  }

  return null;
};

const mapSubtitles = (
  subData: NonNullable<ParadiseEpisodePayload["episode"]>["subData"],
): ScrapeSubtitle[] | undefined => {
  const mapped = (subData ?? [])
    .filter((track) => Boolean(track.src))
    .map((track) => ({
      lang: track.lang ?? track.label ?? "Unknown",
      url: track.src!,
      format: "vtt" as const,
    }));
  return mapped.length > 0 ? mapped : undefined;
};

export async function scrapeAnimeparadise(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animeparadise" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
    const animeId = await resolveAnimeId(input.anilistId, query);
    if (!animeId) {
      return {
        ok: false,
        providerId,
        error: "AnimeParadise anime id not found",
      };
    }

    const episodes =
      (await fetchJson<ParadiseEpisode[]>(
        `${PARADISE_API}/anime/${animeId}/episode`,
      )) ?? [];
    const match = episodes.find(
      (episode) => Number(episode.number) === input.episodeNumber,
    );
    if (!match?.uid) {
      return {
        ok: false,
        providerId,
        error: `AnimeParadise episode ${input.episodeNumber} not found`,
      };
    }

    const payload = await fetchJson<ParadiseEpisodePayload>(
      `${PARADISE_API}/ep/${match.uid}?origin=${encodeURIComponent(animeId)}`,
    );
    const streamLink = payload?.episode?.streamLink;
    if (!streamLink) {
      return {
        ok: false,
        providerId,
        error: "AnimeParadise returned no streamLink",
      };
    }

    const streamUrl = `${PARADISE_STREAM}/m3u8?url=${encodeURIComponent(streamLink)}`;

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "hls",
      referer: `${PARADISE_ORIGIN}/`,
      subtitles: mapSubtitles(payload?.episode?.subData),
      preferredAudioLang: preferredAudioLangForTranslation(
        input.translationType,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "AnimeParadise scrape failed",
    };
  }
}

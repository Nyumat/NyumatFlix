import { scrapeFetch } from "../fetch";

type AniListTitleResponse = {
  data?: {
    Media?: {
      title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      };
      duration?: number | null;
      episodes?: number | null;
      isAdult?: boolean | null;
      format?: string | null;
      genres?: string[] | null;
    };
  };
};

export type AnilistMediaMeta = {
  titles: string[];
  english: string | null;
  romaji: string | null;
  native: string | null;
  durationMinutes: number | null;
  episodes: number | null;
  isAdult: boolean;
  genres: string[];
};

const titleCache = new Map<number, string>();
const titleCandidatesCache = new Map<number, string[]>();
const mediaMetaCache = new Map<number, AnilistMediaMeta>();

export const fetchAnilistTitleCandidates = async (
  anilistId: number,
): Promise<string[]> => {
  const cached = titleCandidatesCache.get(anilistId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { title { romaji english native } duration episodes isAdult format genres } }`,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as AniListTitleResponse;
    const media = payload.data?.Media;
    const candidates = [
      media?.title?.english?.trim(),
      media?.title?.romaji?.trim(),
      media?.title?.native?.trim(),
    ].filter((title): title is string => Boolean(title));
    const unique = [...new Set(candidates)];

    if (unique.length > 0) {
      titleCandidatesCache.set(anilistId, unique);
      titleCache.set(anilistId, unique[0] ?? "");
    }

    return unique;
  } catch {
    return [];
  }
};

export const fetchAnilistSearchQuery = async (
  anilistId: number,
): Promise<string | null> => {
  const cached = titleCache.get(anilistId);
  if (cached) {
    return cached;
  }

  return (await fetchAnilistTitleCandidates(anilistId))[0] ?? null;
};

export const fetchAnilistMediaMeta = async (
  anilistId: number,
): Promise<AnilistMediaMeta | null> => {
  const cached = mediaMetaCache.get(anilistId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { title { romaji english native } duration episodes isAdult format genres } }`,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AniListTitleResponse;
    const media = payload.data?.Media;
    if (!media) {
      return null;
    }

    const titles = [
      media.title?.english?.trim(),
      media.title?.romaji?.trim(),
      media.title?.native?.trim(),
    ].filter((title): title is string => Boolean(title));
    const uniqueTitles = [...new Set(titles)];

    const meta: AnilistMediaMeta = {
      titles: uniqueTitles,
      english: media.title?.english?.trim() ?? null,
      romaji: media.title?.romaji?.trim() ?? null,
      native: media.title?.native?.trim() ?? null,
      durationMinutes:
        typeof media.duration === "number" && media.duration > 0
          ? media.duration
          : null,
      episodes:
        typeof media.episodes === "number" && media.episodes > 0
          ? media.episodes
          : null,
      isAdult: media.isAdult === true,
      genres: (media.genres ?? []).filter(
        (genre): genre is string =>
          typeof genre === "string" && genre.length > 0,
      ),
    };

    mediaMetaCache.set(anilistId, meta);
    if (uniqueTitles.length > 0) {
      titleCandidatesCache.set(anilistId, uniqueTitles);
      titleCache.set(anilistId, uniqueTitles[0] ?? "");
    }

    return meta;
  } catch {
    return null;
  }
};

export const resolveAnimeSearchQuery = async (input: {
  anilistId: number;
  query?: string;
}): Promise<string> => {
  if (input.query?.trim()) {
    return input.query.trim();
  }

  const fromAnilist = await fetchAnilistSearchQuery(input.anilistId);
  if (fromAnilist) {
    return fromAnilist;
  }

  throw new Error(
    `Unable to resolve search title for AniList ${input.anilistId}`,
  );
};

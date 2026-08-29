import { MediaItem } from "@/lib/domain/typings";
import { normalizeAnimeTitle } from "@/lib/scrape/anime/title-match";

export function getSearchTitle(media: MediaItem): string | null {
  if (!media) return null;

  if (media.media_type === "tv" || "name" in media) {
    return media.name || null;
  }

  return media.title || null;
}

const ANIME_GENRE_ID = 16;
const EAST_ASIAN_LANGUAGES = new Set(["ja", "zh", "ko"]);
const EAST_ASIAN_COUNTRIES = new Set(["JP", "CN", "KR", "HK", "TW"]);
const CJK_REGEX =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/;

export function isAnime(
  target:
    | Array<{ id: number; name?: string }>
    | number[]
    | MediaItem
    | Record<string, unknown>
    | null
    | undefined,
  options?: {
    originalLanguage?: string | null;
    countryCodes?: readonly string[] | null;
  },
): boolean {
  if (!target) return false;

  // MediaItem or media-like record
  if (!Array.isArray(target) && typeof target === "object") {
    const item = target as Record<string, unknown>;

    if (
      "sourceAnilistId" in item &&
      typeof item.sourceAnilistId === "number" &&
      Number.isInteger(item.sourceAnilistId) &&
      item.sourceAnilistId > 0
    ) {
      return true;
    }

    if ("href" in item && typeof item.href === "string") {
      if (/\/(?:tvshows\/anilist-\d+|anime\/\d+)/i.test(item.href)) {
        return true;
      }
    }

    const genreIds: number[] = [];
    if (Array.isArray(item.genre_ids)) {
      for (const g of item.genre_ids) {
        if (typeof g === "number") genreIds.push(g);
      }
    }
    if (Array.isArray(item.genres)) {
      for (const g of item.genres) {
        if (typeof g === "number") {
          genreIds.push(g);
        } else if (
          g &&
          typeof g === "object" &&
          typeof (g as { id?: number }).id === "number"
        ) {
          genreIds.push((g as { id: number }).id);
        }
      }
    }

    const hasAnimationGenre = genreIds.includes(ANIME_GENRE_ID);
    if (!hasAnimationGenre) {
      return false;
    }

    const lang =
      typeof item.original_language === "string"
        ? item.original_language.toLowerCase().trim()
        : typeof options?.originalLanguage === "string"
          ? options.originalLanguage.toLowerCase().trim()
          : undefined;

    const countries: string[] = [];
    if (Array.isArray(item.origin_country)) {
      countries.push(
        ...item.origin_country.filter(
          (c): c is string => typeof c === "string",
        ),
      );
    } else if (typeof item.origin_country === "string") {
      countries.push(item.origin_country);
    }
    if (Array.isArray(item.production_countries)) {
      for (const pc of item.production_countries) {
        if (
          pc &&
          typeof pc === "object" &&
          typeof (pc as { iso_3166_1?: string }).iso_3166_1 === "string"
        ) {
          countries.push((pc as { iso_3166_1: string }).iso_3166_1);
        }
      }
    }
    if (Array.isArray(item.country_codes)) {
      countries.push(
        ...item.country_codes.filter((c): c is string => typeof c === "string"),
      );
    }
    if (options?.countryCodes) {
      countries.push(
        ...options.countryCodes.filter(
          (c): c is string => typeof c === "string",
        ),
      );
    }

    const normalizedCountries = countries.map((c) => c.toUpperCase().trim());

    if (lang && EAST_ASIAN_LANGUAGES.has(lang)) {
      return true;
    }

    if (normalizedCountries.some((c) => EAST_ASIAN_COUNTRIES.has(c))) {
      return true;
    }

    const originalTitle =
      (typeof item.original_name === "string" ? item.original_name : "") ||
      (typeof item.original_title === "string" ? item.original_title : "");
    if (originalTitle && CJK_REGEX.test(originalTitle)) {
      return true;
    }

    // Explicit non-East-Asian origin specified (e.g. US / en)
    if (lang || normalizedCountries.length > 0) {
      return false;
    }

    return true;
  }

  // Genre array / IDs list
  const genres = target as Array<{ id: number; name?: string }> | number[];
  if (genres.length === 0) return false;

  const hasAnimation =
    typeof genres[0] === "number"
      ? (genres as number[]).includes(ANIME_GENRE_ID)
      : (genres as Array<{ id: number; name?: string }>).some(
          (g) => g.id === ANIME_GENRE_ID,
        );

  if (!hasAnimation) return false;

  const lang = options?.originalLanguage?.toLowerCase().trim();
  const countries = (options?.countryCodes ?? []).map((c) =>
    c.toUpperCase().trim(),
  );

  if (lang && EAST_ASIAN_LANGUAGES.has(lang)) return true;
  if (countries.some((c) => EAST_ASIAN_COUNTRIES.has(c))) return true;

  if (lang || countries.length > 0) {
    return false;
  }

  return true;
}

export async function fetchAnilistId(
  searchTitle: string,
): Promise<number | null> {
  if (!searchTitle) return null;

  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
        }
      }
    `;

    const variables = {
      search: searchTitle,
    };

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data?.data?.Media?.id) {
      return data.data.Media.id;
    }

    return null;
  } catch (error) {
    console.error("Error fetching Anilist ID:", error);
    return null;
  }
}

type AniListSearchMedia = {
  id?: number;
  title?: {
    english?: string | null;
    romaji?: string | null;
    native?: string | null;
  } | null;
  startDate?: { year?: number | null } | null;
};

const getMediaSearchTitles = (media: MediaItem): string[] => {
  const titles: unknown[] = [
    "original_name" in media ? media.original_name : null,
    "original_title" in media ? media.original_title : null,
    getSearchTitle(media),
  ];

  return [...new Set(titles)]
    .filter(
      (title): title is string =>
        typeof title === "string" && title.trim().length > 0,
    )
    .map((title) => title.trim());
};

const getMediaReleaseYear = (media: MediaItem): number | null => {
  const date = media.first_air_date || media.release_date;
  const year = date ? Number.parseInt(date.slice(0, 4), 10) : Number.NaN;
  return Number.isInteger(year) ? year : null;
};

const isExactAniListMediaMatch = (
  candidate: AniListSearchMedia,
  expectedTitles: readonly string[],
  expectedYear: number | null,
): candidate is AniListSearchMedia & { id: number } => {
  if (!Number.isInteger(candidate.id) || Number(candidate.id) <= 0) {
    return false;
  }

  const expected = new Set(expectedTitles.map(normalizeAnimeTitle));
  const candidateTitles = [
    candidate.title?.english,
    candidate.title?.romaji,
    candidate.title?.native,
  ]
    .filter((title): title is string => Boolean(title?.trim()))
    .map(normalizeAnimeTitle);

  if (!candidateTitles.some((title) => expected.has(title))) {
    return false;
  }

  const candidateYear = candidate.startDate?.year;
  return (
    expectedYear == null ||
    candidateYear == null ||
    candidateYear === expectedYear
  );
};

const fetchExactAnilistId = async (
  searchTitle: string,
  expectedTitles: readonly string[],
  expectedYear: number | null,
): Promise<number | null> => {
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              id
              title { english romaji native }
              startDate { year }
            }
          }
        `,
        variables: { search: searchTitle },
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: { Media?: AniListSearchMedia | null };
    };
    const candidate = payload.data?.Media;
    return candidate &&
      isExactAniListMediaMatch(candidate, expectedTitles, expectedYear)
      ? candidate.id
      : null;
  } catch {
    return null;
  }
};

export async function getAnilistIdForMedia(
  media: MediaItem,
): Promise<number | null | undefined> {
  const searchTitles = getMediaSearchTitles(media);

  if (searchTitles.length === 0 || !isAnime(media)) {
    return undefined;
  }

  const releaseYear = getMediaReleaseYear(media);
  for (const searchTitle of searchTitles) {
    const anilistId = await fetchExactAnilistId(
      searchTitle,
      searchTitles,
      releaseYear,
    );
    if (anilistId) return anilistId;
  }

  return null;
}

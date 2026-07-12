import { MediaItem } from "@/lib/domain/typings";
import { normalizeAnimeTitle } from "@/lib/scrape/anime/title-match";

export function getSearchTitle(media: MediaItem): string | null {
  if (!media) return null;

  if (media.media_type === "tv" || "name" in media) {
    return media.name || null;
  }

  return media.title || null;
}

export function isAnime(
  genres: Array<{ id: number; name?: string }> | number[],
): boolean {
  const animeGenreId = 16;

  if (!genres || genres.length === 0) {
    return false;
  }

  if (typeof genres[0] === "number") {
    return (genres as number[]).includes(animeGenreId);
  }

  return (genres as Array<{ id: number; name?: string }>).some(
    (genre) => genre.id === animeGenreId,
  );
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
  const genreIds = Array.isArray(media.genre_ids) ? media.genre_ids : [];
  const detailedGenres = Array.isArray(media.genres)
    ? media.genres.filter(
        (genre): genre is { id: number; name?: string } =>
          typeof genre === "object" &&
          genre !== null &&
          "id" in genre &&
          typeof genre.id === "number",
      )
    : [];
  const genres = genreIds.length > 0 ? genreIds : detailedGenres;

  if (searchTitles.length === 0 || !isAnime(genres)) {
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

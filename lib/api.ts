import type {
  CanonicalMediaCard,
  CanonicalPersonCard,
  Genre,
} from "@/utils/typings";

export type SearchPreviewResult = CanonicalMediaCard;

export interface SearchPreviewResponse {
  results: SearchPreviewResult[];
}

async function readJsonOrNull<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchSearchPreview(
  query: string,
  signal?: AbortSignal,
): Promise<SearchPreviewResult[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  const response = await fetch(
    `/api/search-preview?query=${encodeURIComponent(query)}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error("Search preview failed");
  }

  const data = await readJsonOrNull<SearchPreviewResponse>(response);
  return data?.results || [];
}

export interface SearchResult {
  media: CanonicalMediaCard[];
  people: CanonicalPersonCard[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export async function fetchSearchResults(
  query: string,
  page: number = 1,
): Promise<SearchResult> {
  if (!query.trim()) {
    return {
      media: [],
      people: [],
      page: 1,
      totalPages: 1,
      totalResults: 0,
    };
  }

  const url = new URL("/api/search", window.location.origin);
  url.searchParams.append("query", query.trim());
  url.searchParams.append("page", page.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorData = await readJsonOrNull<{ error?: string }>(response);
    throw new Error(
      errorData?.error ||
        `Failed to fetch search results: ${response.statusText}`,
    );
  }

  const data = await readJsonOrNull<SearchResult>(response);
  return (
    data ?? {
      media: [],
      people: [],
      page,
      totalPages: 1,
      totalResults: 0,
    }
  );
}

export async function fetchMovieGenres(): Promise<Genre[]> {
  const response = await fetch("/api/genres?type=movie");

  if (!response.ok) {
    throw new Error("Failed to fetch movie genres");
  }

  const data = await readJsonOrNull<{ genres?: Genre[] }>(response);
  return data?.genres || [];
}

export async function fetchTvGenres(): Promise<Genre[]> {
  const response = await fetch("/api/genres?type=tv");

  if (!response.ok) {
    throw new Error("Failed to fetch TV genres");
  }

  const data = await readJsonOrNull<{ genres?: Genre[] }>(response);
  return data?.genres || [];
}

export async function fetchCombinedGenres(): Promise<Record<number, string>> {
  const [movieGenres, tvGenres] = await Promise.all([
    fetchMovieGenres(),
    fetchTvGenres(),
  ]);

  const combined: Record<number, string> = {};

  [...movieGenres, ...tvGenres].forEach((genre) => {
    if (genre?.id && genre?.name) {
      combined[genre.id] = genre.name;
    }
  });

  return combined;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
  vote_average: number;
}

export interface SeasonData {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episodes: Episode[];
}

export async function fetchTvSeason(
  tvId: number,
  seasonNumber: number,
): Promise<SeasonData> {
  const response = await fetch(`/api/tv/${tvId}/season/${seasonNumber}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch season ${seasonNumber}`);
  }

  const data = await readJsonOrNull<SeasonData>(response);
  if (!data) {
    throw new Error(`Invalid season ${seasonNumber} response`);
  }

  return data;
}

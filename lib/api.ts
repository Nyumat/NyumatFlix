import type { Genre, MediaItem } from "@/utils/typings";

export interface ContentRowResponse {
  items: MediaItem[];
}

export async function fetchContentRow(
  rowId: string,
  count: number = 20,
  enrich: boolean = false,
): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    id: rowId,
    count: count.toString(),
    enrich: enrich.toString(),
  });

  const response = await fetch(`/api/content-rows?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch content row: ${response.status}`);
  }

  return response.json();
}

export interface SearchPreviewResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: string;
  release_date?: string;
  first_air_date?: string;
  genre_names?: string[];
}

export interface SearchPreviewResponse {
  results: SearchPreviewResult[];
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

  const data: SearchPreviewResponse = await response.json();
  return data.results || [];
}

export interface SearchResult {
  media: MediaItem[];
  people: Array<{
    id: number;
    name: string;
    profile_path?: string | null;
    popularity?: number;
  }>;
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
    const errorData = (await response.json()) as { error?: string };
    throw new Error(
      errorData.error ||
        `Failed to fetch search results: ${response.statusText}`,
    );
  }

  return response.json();
}

export async function fetchMovieGenres(): Promise<Genre[]> {
  const response = await fetch("/api/genres?type=movie");

  if (!response.ok) {
    throw new Error("Failed to fetch movie genres");
  }

  const data = (await response.json()) as { genres?: Genre[] };
  return data.genres || [];
}

export async function fetchTvGenres(): Promise<Genre[]> {
  const response = await fetch("/api/genres?type=tv");

  if (!response.ok) {
    throw new Error("Failed to fetch TV genres");
  }

  const data = (await response.json()) as { genres?: Genre[] };
  return data.genres || [];
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

  return response.json();
}

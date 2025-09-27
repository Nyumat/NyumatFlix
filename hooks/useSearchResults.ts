"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { Genre as GenreType, Movie, TvShow } from "@/utils/typings";

interface SearchResult {
  media: Array<Movie | TvShow>;
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

export interface UseSearchResultsState {
  items: Array<Movie | TvShow>;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  selectedGenreIds: string[];
  allGenres: { [key: number]: string };
  genresLoading: boolean;
  currentQuery: string;
}

export interface UseSearchResultsComputed {
  filteredItems: Array<Movie | TvShow>;
  genreOptions: Array<{ label: string; value: string }>;
}

export interface UseSearchResultsActions {
  setCurrentPage: (page: number) => void;
  setSelectedGenreIds: (ids: string[]) => void;
  refetch: () => void;
}

export interface UseSearchResultsReturn
  extends UseSearchResultsState,
    UseSearchResultsComputed,
    UseSearchResultsActions {}

type SearchAction =
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_SELECTED_GENRES"; ids: string[] }
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      items: Array<Movie | TvShow>;
      totalPages: number;
    }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "GENRES_FETCH_START" }
  | { type: "SET_GENRES"; map: { [key: number]: string } }
  | { type: "RESET_FOR_NEW_QUERY"; query: string };

const initialState: UseSearchResultsState = {
  items: [],
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  error: null,
  selectedGenreIds: [],
  allGenres: {},
  genresLoading: true,
  currentQuery: "",
};

function reducer(
  state: UseSearchResultsState,
  action: SearchAction,
): UseSearchResultsState {
  switch (action.type) {
    case "SET_PAGE":
      return { ...state, currentPage: action.page };
    case "SET_SELECTED_GENRES":
      return { ...state, selectedGenreIds: action.ids };
    case "FETCH_START":
      return { ...state, isLoading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        items: action.items,
        totalPages: action.totalPages,
      };
    case "FETCH_ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.error,
        items: [],
        totalPages: 1,
      };
    case "RESET_FOR_NEW_QUERY":
      return {
        ...state,
        currentQuery: action.query,
        currentPage: 1,
        items: [],
        totalPages: 1,
        error: null,
      };
    case "GENRES_FETCH_START":
      return { ...state, genresLoading: true };
    case "SET_GENRES":
      return { ...state, allGenres: action.map, genresLoading: false };
    default:
      return state;
  }
}

export const useSearchResults = (query: string): UseSearchResultsReturn => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    items,
    currentPage,
    totalPages,
    isLoading,
    error,
    selectedGenreIds,
    allGenres,
    genresLoading,
    currentQuery,
  } = state;

  const filteredItems = useMemo(() => {
    if (selectedGenreIds.length === 0) return items;
    return items.filter((item) =>
      item.genre_ids?.some((genreId) =>
        selectedGenreIds.includes(genreId.toString()),
      ),
    );
  }, [items, selectedGenreIds]);

  const genreOptions = useMemo(
    () =>
      Object.entries(allGenres)
        .map(([id, name]) => ({
          label: name,
          value: id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [allGenres],
  );

  // fetch genres on mount
  useEffect(() => {
    let isActive = true;
    const fetchAllGenres = async () => {
      dispatch({ type: "GENRES_FETCH_START" });
      try {
        const [movieGenresRes, tvGenresRes] = await Promise.all([
          fetch("/api/genres?type=movie"),
          fetch("/api/genres?type=tv"),
        ]);

        if (!movieGenresRes.ok || !tvGenresRes.ok) {
          throw new Error("Failed to fetch genres");
        }

        const [movieGenresData, tvGenresData] = await Promise.all([
          movieGenresRes.json() as Promise<{ genres?: GenreType[] }>,
          tvGenresRes.json() as Promise<{ genres?: GenreType[] }>,
        ]);

        if (!isActive) return;

        const combinedGenres: { [key: number]: string } = {};

        // combine movie and tv genres
        [movieGenresData.genres, tvGenresData.genres].forEach((genres) => {
          if (Array.isArray(genres)) {
            genres.forEach((genre) => {
              if (genre?.id && genre?.name) {
                combinedGenres[genre.id] = genre.name;
              }
            });
          }
        });

        if (!isActive) return;
        dispatch({ type: "SET_GENRES", map: combinedGenres });
      } catch (error) {
        console.error("Error fetching genres:", error);
        if (!isActive) return;
        dispatch({ type: "SET_GENRES", map: {} });
      }
    };
    void fetchAllGenres();
    return () => {
      isActive = false;
    };
  }, []);

  const performFetch = useCallback(async () => {
    if (!query || !query.trim()) {
      dispatch({ type: "FETCH_SUCCESS", items: [], totalPages: 1 });
      return;
    }

    dispatch({ type: "FETCH_START" });
    try {
      const url = new URL("/api/search", window.location.origin);
      url.searchParams.append("query", query.trim());
      url.searchParams.append("page", currentPage.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(
          errorData.error ||
            `Failed to fetch search results: ${response.statusText}`,
        );
      }

      const searchResults = (await response.json()) as SearchResult;

      // the API now returns separated media and people
      dispatch({
        type: "FETCH_SUCCESS",
        items: searchResults.media || [],
        totalPages: searchResults.totalPages || 1,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An unknown error occurred while fetching results.";
      dispatch({ type: "FETCH_ERROR", error: message });
    }
  }, [query, currentPage]);

  // reset when query changes
  useEffect(() => {
    if (query.trim() !== currentQuery) {
      dispatch({ type: "RESET_FOR_NEW_QUERY", query: query.trim() });
    }
  }, [query, currentQuery]);

  // fetch when query or page changes
  useEffect(() => {
    void performFetch();
  }, [performFetch]);

  const refetch = useCallback(() => {
    void performFetch();
  }, [performFetch]);

  return {
    items,
    currentPage,
    totalPages,
    isLoading,
    error,
    selectedGenreIds,
    allGenres,
    genresLoading,
    currentQuery,
    filteredItems,
    genreOptions,
    setCurrentPage: (page: number) => dispatch({ type: "SET_PAGE", page }),
    setSelectedGenreIds: (ids: string[]) =>
      dispatch({ type: "SET_SELECTED_GENRES", ids }),
    refetch,
  };
};

export type UseSearchResults = typeof useSearchResults;

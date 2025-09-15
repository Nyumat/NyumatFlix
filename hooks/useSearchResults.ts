"use client";

import type {
  Genre as GenreType,
  Movie,
  TmdbResponse,
  TvShow,
} from "@/utils/typings";
import { useCallback, useEffect, useMemo, useReducer } from "react";

export interface UseSearchResultsState {
  items: Array<Movie | TvShow>;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  selectedGenreIds: string[];
  allGenres: { [key: number]: string };
  genresLoading: boolean;
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
  | { type: "FETCH_SUCCESS"; items: Array<Movie | TvShow>; totalPages: number }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "GENRES_FETCH_START" }
  | { type: "SET_GENRES"; map: { [key: number]: string } };

const initialState: UseSearchResultsState = {
  items: [],
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  error: null,
  selectedGenreIds: [],
  allGenres: {},
  genresLoading: true,
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
  } = state;

  // Derived data
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
      Object.entries(allGenres).map(([id, name]) => ({
        label: name,
        value: id,
      })),
    [allGenres],
  );

  // Genres fetch
  useEffect(() => {
    let isActive = true;
    const fetchAllGenres = async () => {
      dispatch({ type: "GENRES_FETCH_START" });
      try {
        const movieGenresRes = await fetch("/api/genres?type=movie");
        const tvGenresRes = await fetch("/api/genres?type=tv");

        if (!movieGenresRes.ok || !tvGenresRes.ok) {
          throw new Error("Failed to fetch genres");
        }

        const movieGenresData = (await movieGenresRes.json()) as {
          genres?: GenreType[];
        };
        const tvGenresData = (await tvGenresRes.json()) as {
          genres?: GenreType[];
        };

        if (!isActive) return;

        const combinedGenres: { [key: number]: string } = {};

        if (Array.isArray(movieGenresData.genres)) {
          movieGenresData.genres.forEach((genre) => {
            if (genre && typeof genre.id === "number") {
              combinedGenres[genre.id] = genre.name;
            }
          });
        }

        if (Array.isArray(tvGenresData.genres)) {
          tvGenresData.genres.forEach((genre) => {
            if (
              genre &&
              typeof genre.id === "number" &&
              !combinedGenres[genre.id]
            ) {
              combinedGenres[genre.id] = genre.name;
            }
          });
        }

        if (!isActive) return;
        dispatch({ type: "SET_GENRES", map: combinedGenres });
      } catch {
        if (!isActive) return;
        dispatch({ type: "SET_GENRES", map: {} });
      }
    };
    fetchAllGenres();
    return () => {
      isActive = false;
    };
  }, []);

  const performFetch = useCallback(async () => {
    if (!query || !query.trim()) {
      dispatch({ type: "FETCH_SUCCESS", items: [], totalPages: 1 });
      dispatch({ type: "SET_PAGE", page: 1 });
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
      const searchResults = (await response.json()) as TmdbResponse<
        Movie | TvShow
      >;

      dispatch({
        type: "FETCH_SUCCESS",
        items: searchResults.results || [],
        totalPages: searchResults.total_pages || 1,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An unknown error occurred while fetching results.";
      dispatch({ type: "FETCH_ERROR", error: message });
    }
  }, [query, currentPage]);

  // Fetch search results on query/page change
  useEffect(() => {
    void performFetch();
  }, [performFetch]);

  const refetch = useCallback(() => {
    void performFetch();
  }, [performFetch]);

  return {
    // state
    items,
    currentPage,
    totalPages,
    isLoading,
    error,
    selectedGenreIds,
    allGenres,
    genresLoading,
    // computed
    filteredItems,
    genreOptions,
    // actions
    setCurrentPage: (page: number) => dispatch({ type: "SET_PAGE", page }),
    setSelectedGenreIds: (ids: string[]) =>
      dispatch({ type: "SET_SELECTED_GENRES", ids }),
    refetch,
  };
};

export type UseSearchResults = typeof useSearchResults;

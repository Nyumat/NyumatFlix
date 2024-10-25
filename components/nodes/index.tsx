"use server";

import { getMovies, getTVShows } from "@/app/actions";
import {
  MovieCategory,
  TVShowCategory,
  UnifiedCategory,
} from "@/utils/typings";
import { ContentGrid } from "../content-grid";

export const getTvShowListNodes = async (
  offset: number,
  type: UnifiedCategory,
) => {
  try {
    const response = await getTVShows(type as TVShowCategory, offset);

    if (!response?.results) {
      return null;
    }

    const nextOffset = offset < (response.total_pages || 0) ? offset + 1 : null;

    return [
      <ContentGrid items={response.results} key={offset} type="tv" />,
      nextOffset,
    ] as const;
  } catch (error) {
    console.error("Error loading more tvShows:", error);
    return null;
  }
};

export const getMovieListNodes = async (
  offset: number,
  type: UnifiedCategory,
) => {
  try {
    const response = await getMovies(type as MovieCategory, offset);

    if (!response?.results) {
      return null;
    }

    const nextOffset = offset < (response.total_pages || 0) ? offset + 1 : null;

    return [
      <ContentGrid items={response.results} key={offset} type="movie" />,
      nextOffset,
    ] as const;
  } catch (error) {
    console.error("Error loading more movies:", error);
    return null;
  }
};

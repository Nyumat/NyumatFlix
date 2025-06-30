/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";

// Define Zod schemas for all types
export const LogoSchema = z.object({
  file_path: z.string(),
  iso_639_1: z.string(),
  aspect_ratio: z.number(),
  height: z.number(),
  width: z.number(),
  vote_average: z.number(),
  vote_count: z.number(),
});

export const GenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const TitleSchema = z.object({
  title: z.string(),
  query: z.string(),
});

export const ActorSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    profile_path: z.string().optional().nullable(),
    character: z.string(),
    popularity: z.number(),
  })
  .catchall(z.any());

export const EpisodeSchema = z.object({
  id: z.number(),
  name: z.string(),
  overview: z.string(),
  episode_number: z.number(),
  air_date: z.string(),
  still_path: z.string().nullable(),
  runtime: z.number().nullable(),
});

export const SeasonSchema = z.object({
  id: z.number(),
  name: z.string(),
  season_number: z.number(),
  episode_count: z.number(),
  air_date: z.string().nullable(),
  overview: z.string(),
  poster_path: z.string().nullable(),
});

export const NetworkSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo_path: z.string().nullable(),
  origin_country: z.string(),
});

export const ProductionCountrySchema = z.object({
  iso_3166_1: z.string(),
  name: z.string(),
});

export const ContentRatingSchema = z.object({
  iso_3166_1: z.string(),
  rating: z.string(),
});

export const CreatorSchema = z.object({
  id: z.number(),
  name: z.string(),
  profile_path: z.string().nullable(),
});

export const VideoSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  site: z.string(),
  type: z.string(),
  iso_639_1: z.string(),
  iso_3166_1: z.string(),
  official: z.boolean(),
});

// Movie schema with optional media_type field
export const MovieSchema = z
  .object({
    title: z.string(),
    backdrop_path: z.string().optional().nullable(),
    media_type: z.string().optional(),
    release_date: z.string().optional(),
    first_air_date: z.string().optional(),
    genre_ids: z.array(z.number()),
    id: z.number(),
    name: z.string().optional(),
    origin_country: z.array(z.string()).optional(),
    original_language: z.string(),
    original_name: z.string().optional(),
    overview: z.string(),
    popularity: z.number(),
    poster_path: z.string().optional().nullable(),
    vote_average: z.number(),
    vote_count: z.number(),
    adult: z.boolean(),
    video: z.boolean(),
    original_title: z.string(),
    logo: LogoSchema.optional(),
    videos: z.array(z.any()).optional(),
    results: z.array(z.lazy(() => MovieSchema)).optional(),
  })
  .catchall(z.any());

// TV Show schema with optional media_type field
export const TvShowSchema = z
  .object({
    backdrop_path: z.string().optional().nullable(),
    first_air_date: z.string().optional(),
    genre_ids: z.array(z.number()),
    id: z.number(),
    release_date: z.string().optional(),
    name: z.string(),
    origin_country: z.array(z.string()).optional(),
    overview: z.string(),
    popularity: z.number(),
    poster_path: z.string().optional().nullable(),
    vote_average: z.number(),
    vote_count: z.number(),
    original_language: z.string(),
    original_name: z.string(),
    media_type: z.string().optional(),
    logo: LogoSchema.optional(),
    videos: z.array(z.any()).optional(),
  })
  .catchall(z.any());

export const MediaItemSchema = z.union([MovieSchema, TvShowSchema]);

export const SeasonDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  overview: z.string(),
  season_number: z.number(),
  episodes: z.array(EpisodeSchema),
});

export const TvShowDetailsSchema = TvShowSchema.extend({
  number_of_seasons: z.number(),
  number_of_episodes: z.number(),
  status: z.string(),
  seasons: z.array(SeasonSchema),
  networks: z.array(NetworkSchema),
  production_countries: z.array(ProductionCountrySchema),
  created_by: z.array(CreatorSchema),
  content_ratings: z.object({
    results: z.array(ContentRatingSchema),
  }),
  videos: z.object({
    results: z.array(VideoSchema),
  }),
  credits: z.object({
    cast: z.array(ActorSchema),
    crew: z.array(ActorSchema),
  }),
  recommendations: z.object({
    results: z.array(TvShowSchema),
  }),
});

export const LayoutPropsSchema = z.object({
  children: z.any(),
  isPathRoot: z.boolean(),
});

export const TmdbResponseSchema = z
  .object({
    page: z.number().optional(),
    results: z.array(z.any()).optional(),
    total_pages: z.number().optional(),
    total_results: z.number().optional(),
  })
  .catchall(z.any());

export const CreditsResponseSchema = z.object({
  id: z.number(),
  cast: z.array(ActorSchema),
  crew: z.array(ActorSchema),
});

// These schemas were already defined in the original
export const TVShowCategoryEnum = z.enum([
  "popular",
  "top-rated",
  "on-the-air",
  "airing-today",
]);

export const MovieCategoryEnum = z.enum([
  "popular",
  "top-rated",
  "now-playing",
  "upcoming",
  "studio-a24",
  "studio-disney",
  "studio-pixar",
  "studio-warner-bros",
  "studio-universal",
  "studio-dreamworks",
  "director-nolan",
  "director-tarantino",
  "director-spielberg",
  "director-scorsese",
  "director-fincher",
]);

export const UpcomingMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  release_date: z.string().optional(),
  poster_path: z.string().optional().nullable(),
  backdrop_path: z.string().optional().nullable(),
  overview: z.string().optional(),
  vote_average: z.number().optional(),
  popularity: z.number().optional(),
  original_language: z.string().optional(),
  original_title: z.string().optional(),
  genre_ids: z.array(z.number()).optional(),
  adult: z.boolean().optional(),
  video: z.boolean().optional(),
});

export const UpcomingMoviesResponseSchema = z.object({
  page: z.number().optional(),
  results: z.array(UpcomingMovieSchema).optional(),
  total_pages: z.number().optional(),
  total_results: z.number().optional(),
});

export const ReleaseDateSchema = z.object({
  type: z.number(),
  certification: z.string().optional(),
  note: z.string().optional().nullable(),
  release_date: z.string().optional(),
});

export const ReleaseInfoSchema = z.object({
  iso_3166_1: z.string(),
  release_dates: z.array(ReleaseDateSchema),
});

export const ReleaseDatesResponseSchema = z.object({
  id: z.number().optional(),
  results: z.array(ReleaseInfoSchema),
});

// Define Schema for TvResult
export const TvResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  poster_path: z.string().optional(),
  backdrop_path: z.string().optional(),
  overview: z.string(),
  vote_average: z.number(),
  vote_count: z.number(),
  popularity: z.number(),
  first_air_date: z.string().optional(),
  media_type: z.literal("tv").optional(),
});

// Infer types from schemas
export type Logo = z.infer<typeof LogoSchema>;
export type Genre = z.infer<typeof GenreSchema>;
export type Title = z.infer<typeof TitleSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Movie = z.infer<typeof MovieSchema>;
export type TvShow = z.infer<typeof TvShowSchema>;
export type MediaItem = z.infer<typeof MediaItemSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type Season = z.infer<typeof SeasonSchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type ProductionCountry = z.infer<typeof ProductionCountrySchema>;
export type ContentRating = z.infer<typeof ContentRatingSchema>;
export type Creator = z.infer<typeof CreatorSchema>;
export type Video = z.infer<typeof VideoSchema>;
export type SeasonDetails = z.infer<typeof SeasonDetailsSchema>;
export type TvShowDetails = z.infer<typeof TvShowDetailsSchema>;
export type TmdbResponse<T = any> = z.infer<typeof TmdbResponseSchema> & {
  results?: T[];
};
export type CreditsReponse = z.infer<typeof CreditsResponseSchema>;
export type LayoutProps = z.infer<typeof LayoutPropsSchema>;
export type TVShowCategory = z.infer<typeof TVShowCategoryEnum>;
export type MovieCategory = z.infer<typeof MovieCategoryEnum>;
export type UnifiedCategory = TVShowCategory | MovieCategory;
export type UpcomingMovie = z.infer<typeof UpcomingMovieSchema>;
export type UpcomingMoviesResponse = z.infer<
  typeof UpcomingMoviesResponseSchema
>;
export type ReleaseDate = z.infer<typeof ReleaseDateSchema>;
export type ReleaseInfo = z.infer<typeof ReleaseInfoSchema>;
export type ReleaseDatesResponse = z.infer<typeof ReleaseDatesResponseSchema>;

// Enhanced helper functions for ts-pattern compatibility
export function isMovie(item: MediaItem): item is Movie {
  return "title" in item;
}

export function isTVShow(item: MediaItem): item is TvShow {
  return "name" in item && !("title" in item);
}

// Helper function to safely get title from different media item types
export function getTitle(item: MediaItem): string {
  if ("title" in item && item.title) {
    return item.title;
  }
  if ("name" in item && item.name) {
    return item.name;
  }
  return ""; // Fallback to empty string
}

// Helper function to safely get air date from different media item types
export function getAirDate(item: MediaItem): string | undefined {
  if ("first_air_date" in item && item.first_air_date) {
    return item.first_air_date;
  }
  if ("release_date" in item && item.release_date) {
    return item.release_date;
  }
  return undefined;
}

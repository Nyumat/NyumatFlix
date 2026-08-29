import type { CanonicalCardLogo } from "@/lib/domain/typings";
import type { Movie, TvShow } from "@/tmdb/models";
import { formatYear } from "./formatters";

export type CatalogMovieCard = {
  id: number;
  media_type: "movie";
  title: string;
  poster_path: string;
  backdrop_path?: string;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  logo?: CanonicalCardLogo;
};

export type CatalogTvCard = {
  id: number;
  media_type: "tv";
  name: string;
  title: string;
  poster_path: string;
  backdrop_path?: string;
  first_air_date: string;
  vote_average: number;
  vote_count?: number;
  logo?: CanonicalCardLogo;
};

export type CatalogMediaCard = CatalogMovieCard | CatalogTvCard;

export type HomeCollectionPartCard = {
  id: number;
  media_type: "movie";
  title: string;
  poster_path: string;
  backdrop_path?: string;
  release_date: string;
};

export type HomeCollectionCard = {
  id: number;
  name: string;
  overview?: string;
  backdrop_path?: string;
  poster_path?: string;
  parts: HomeCollectionPartCard[];
};

export const toCatalogMovieCard = (
  movie: Movie & { media_type?: "movie"; logo?: CanonicalCardLogo },
): CatalogMovieCard => ({
  id: movie.id,
  media_type: "movie",
  title: movie.title,
  poster_path: movie.poster_path,
  backdrop_path: movie.backdrop_path,
  release_date: movie.release_date,
  vote_average: movie.vote_average,
  vote_count: movie.vote_count,
  logo: movie.logo,
});

export const toCatalogTvCard = (
  show: TvShow & { media_type?: "tv"; logo?: CanonicalCardLogo },
): CatalogTvCard => ({
  id: show.id,
  media_type: "tv",
  name: show.name,
  title: show.name,
  poster_path: show.poster_path,
  backdrop_path: show.backdrop_path,
  first_air_date: show.first_air_date,
  vote_average: show.vote_average,
  vote_count: show.vote_count,
  logo: show.logo,
});

export const toCatalogMediaCards = (
  items: Array<
    (Movie | TvShow) & { media_type: "movie" | "tv"; logo?: CanonicalCardLogo }
  >,
): CatalogMediaCard[] =>
  items.map((item) =>
    item.media_type === "tv"
      ? toCatalogTvCard(item as TvShow & { media_type: "tv" })
      : toCatalogMovieCard(item as Movie & { media_type: "movie" }),
  );

export const toHomeCollectionPartCard = (
  movie: Movie,
): HomeCollectionPartCard => ({
  id: movie.id,
  media_type: "movie",
  title: movie.title,
  poster_path: movie.poster_path,
  backdrop_path: movie.backdrop_path,
  release_date: movie.release_date,
});

export const toHomeCollectionCard = (collection: {
  id: number;
  name: string;
  overview?: string;
  backdrop_path?: string;
  poster_path?: string;
  parts: Movie[];
}): HomeCollectionCard => ({
  id: collection.id,
  name: collection.name,
  overview: collection.overview,
  backdrop_path: collection.backdrop_path,
  poster_path: collection.poster_path,
  parts: collection.parts.map(toHomeCollectionPartCard),
});

export const catalogMovieToMediaItem = (
  card: CatalogMovieCard,
): Movie & { media_type: "movie"; logo?: CanonicalCardLogo } => ({
  id: card.id,
  media_type: "movie",
  title: card.title,
  poster_path: card.poster_path,
  backdrop_path: card.backdrop_path,
  release_date: card.release_date,
  vote_average: card.vote_average,
  vote_count: card.vote_count ?? 0,
  adult: false,
  overview: "",
  genre_ids: [],
  original_title: card.title,
  original_language: "",
  popularity: 0,
  video: false,
  logo: card.logo,
});

export const catalogTvToMediaItem = (
  card: CatalogTvCard,
): TvShow & { media_type: "tv"; logo?: CanonicalCardLogo } => ({
  id: card.id,
  media_type: "tv",
  name: card.name,
  poster_path: card.poster_path,
  backdrop_path: card.backdrop_path,
  first_air_date: card.first_air_date,
  vote_average: card.vote_average,
  vote_count: card.vote_count ?? 0,
  overview: "",
  genre_ids: [],
  original_language: "",
  original_name: card.name,
  origin_country: [],
  popularity: 0,
  logo: card.logo,
});

export const catalogCardToMediaItem = (
  card: CatalogMediaCard,
): (Movie | TvShow) & {
  media_type: "movie" | "tv";
  logo?: CanonicalCardLogo;
} =>
  card.media_type === "tv"
    ? catalogTvToMediaItem(card)
    : catalogMovieToMediaItem(card);

export const homeCollectionPartToMediaItem = (
  part: HomeCollectionPartCard,
): Movie & { media_type: "movie" } => ({
  ...part,
  adult: false,
  overview: "",
  genre_ids: [],
  original_title: part.title,
  original_language: "",
  popularity: 0,
  video: false,
  vote_average: 0,
  vote_count: 0,
});

export const getCatalogCardYear = (
  card: CatalogMediaCard | HomeCollectionPartCard,
) => {
  const date =
    "first_air_date" in card ? card.first_air_date : card.release_date;
  return formatYear(date);
};

export const toHeroMovieRefs = (
  movies: Array<{ id: number }>,
): Array<Pick<Movie, "id">> => movies.map((movie) => ({ id: movie.id }));

export const toHeroTvRefs = (
  shows: Array<{ id: number }>,
): Array<Pick<TvShow, "id">> => shows.map((show) => ({ id: show.id }));

export const slimMediaItemsForRsc = <
  T extends { id: number; media_type: "movie" | "tv" },
>(
  items: T[],
): T[] =>
  toCatalogMediaCards(
    items as unknown as Array<
      (Movie | TvShow) & {
        media_type: "movie" | "tv";
        logo?: CanonicalCardLogo;
      }
    >,
  ).map((card) => catalogCardToMediaItem(card) as unknown as T);

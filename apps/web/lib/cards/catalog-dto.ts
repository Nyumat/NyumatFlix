import type { CanonicalCardLogo } from "@/lib/domain/typings";
import type { Movie, TvShow } from "@/tmdb/models";
import { formatYear } from "./formatters";

export type CatalogMovieCard = {
  id: number;
  media_type: "movie";
  title: string;
  overview: string;
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
  overview: string;
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
  overview: movie.overview,
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
  overview: show.overview,
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
  overview: card.overview,
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
  overview: card.overview,
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

export type BrowseMediaType = "movie" | "tv";

type MappableBrowseItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
};

export const mapReleasedItemsToCatalogCards = (
  items: MappableBrowseItem[],
  mediaType: BrowseMediaType,
): CatalogMediaCard[] =>
  items.map((item) => {
    if (mediaType === "movie") {
      const title = item.title ?? item.name ?? "";
      return {
        id: item.id,
        media_type: "movie",
        title,
        overview: item.overview ?? "",
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path ?? undefined,
        release_date: item.release_date ?? "",
        vote_average: item.vote_average ?? 0,
        vote_count: item.vote_count,
      } satisfies CatalogMovieCard;
    }

    const name = item.name ?? item.title ?? "";
    return {
      id: item.id,
      media_type: "tv",
      name,
      title: name,
      overview: item.overview ?? "",
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path ?? undefined,
      first_air_date: item.first_air_date ?? "",
      vote_average: item.vote_average ?? 0,
      vote_count: item.vote_count,
    } satisfies CatalogTvCard;
  });

export const catalogCardsToMediaItems = (
  cards: CatalogMediaCard[],
): Array<(Movie | TvShow) & { media_type: "movie" | "tv" }> =>
  cards.map(catalogCardToMediaItem);

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

type SlimmableMediaItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  logo?: CanonicalCardLogo;
};

const getSlimMediaType = (item: SlimmableMediaItem): "movie" | "tv" => {
  if (item.media_type === "tv") return "tv";
  if (item.media_type === "movie") return "movie";
  return "name" in item && !("title" in item) ? "tv" : "movie";
};

export const slimMediaItemsForRsc = <T extends SlimmableMediaItem>(
  items: T[],
): T[] =>
  items.map((item) => {
    const mediaType = getSlimMediaType(item);
    const title = item.title ?? item.name ?? "";
    const card =
      mediaType === "tv"
        ? ({
            id: item.id,
            media_type: "tv",
            name: item.name ?? title,
            title,
            overview: item.overview ?? "",
            poster_path: item.poster_path ?? "",
            backdrop_path: item.backdrop_path ?? undefined,
            first_air_date: item.first_air_date ?? item.release_date ?? "",
            vote_average: item.vote_average ?? 0,
            vote_count: item.vote_count,
            logo: item.logo,
          } satisfies CatalogTvCard)
        : ({
            id: item.id,
            media_type: "movie",
            title,
            overview: item.overview ?? "",
            poster_path: item.poster_path ?? "",
            backdrop_path: item.backdrop_path ?? undefined,
            release_date: item.release_date ?? item.first_air_date ?? "",
            vote_average: item.vote_average ?? 0,
            vote_count: item.vote_count,
            logo: item.logo,
          } satisfies CatalogMovieCard);
    return catalogCardToMediaItem(card) as unknown as T;
  });

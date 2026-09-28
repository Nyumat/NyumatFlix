import type {
  CanonicalCardLogo,
  CanonicalMediaCard,
} from "@/lib/domain/typings";
import type { Movie, TvShow } from "@/tmdb/models";
import { formatYear } from "./formatters";

type CatalogCardPreviewFields = {
  /** IMDb id used for the hover trailer stream. */
  imdb_id?: string;
  /** YouTube trailer id (AniList-sourced) for the hover preview fallback. */
  youtube_trailer_key?: string;
  /** True when `id` is an AniList id, not a TMDB id. */
  isAniListFallback?: boolean;
};

export type CatalogMovieCard = CatalogCardPreviewFields & {
  id: number;
  media_type: "movie";
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path?: string;
  localized_backdrop?: boolean;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  logo?: CanonicalCardLogo;
  /** Canonical detail href (e.g. `/anime/anilist-21`). Slimmed cards only carry it when server-enriched. */
  href?: string;
};

export type CatalogTvCard = CatalogCardPreviewFields & {
  id: number;
  media_type: "tv";
  name: string;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path?: string;
  localized_backdrop?: boolean;
  first_air_date: string;
  vote_average: number;
  vote_count?: number;
  logo?: CanonicalCardLogo;
  /** Canonical detail href (e.g. `/anime/anilist-21`). Slimmed cards only carry it when server-enriched. */
  href?: string;
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
  movie: Movie & {
    media_type?: "movie";
    logo?: CanonicalCardLogo;
    href?: string;
  },
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
  ...(typeof movie.href === "string" && movie.href.length > 0
    ? { href: movie.href }
    : {}),
});

export const toCatalogTvCard = (
  show: TvShow & {
    media_type?: "tv";
    logo?: CanonicalCardLogo;
    href?: string;
  },
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
  ...(typeof show.href === "string" && show.href.length > 0
    ? { href: show.href }
    : {}),
});

export const catalogCardDefaultHref = (card: CatalogMediaCard): string => {
  if (typeof card.href === "string" && card.href.startsWith("/")) {
    return card.href;
  }

  return card.media_type === "movie"
    ? `/movies/${card.id}`
    : `/tvshows/${card.id}`;
};

export const toCanonicalHubCard = (
  card: CatalogMediaCard,
): CanonicalMediaCard => {
  const href = catalogCardDefaultHref(card);
  const { logo: _logo, ...rest } = card;

  if (card.media_type === "tv") {
    return {
      ...rest,
      href,
      media_type: "tv",
      title: card.title,
      name: card.name,
    } as CanonicalMediaCard;
  }

  return {
    ...rest,
    href,
    media_type: "movie",
    title: card.title,
  } as CanonicalMediaCard;
};

export const isCatalogMediaCard = (item: {
  media_type?: string;
  genre_ids?: number[];
}): item is CatalogMediaCard =>
  (item.media_type === "movie" || item.media_type === "tv") &&
  !Array.isArray(item.genre_ids);

export const toCatalogMediaCards = (
  items: Array<
    (Movie | TvShow) & {
      media_type: "movie" | "tv";
      logo?: CanonicalCardLogo;
      href?: string;
    }
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
): Movie & {
  media_type: "movie";
  logo?: CanonicalCardLogo;
  href?: string;
} => ({
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
  ...(card.localized_backdrop ? { localized_backdrop: true } : {}),
  ...(typeof card.imdb_id === "string" ? { imdb_id: card.imdb_id } : {}),
  ...(typeof card.youtube_trailer_key === "string"
    ? { youtube_trailer_key: card.youtube_trailer_key }
    : {}),
  ...(typeof card.isAniListFallback === "boolean"
    ? { isAniListFallback: card.isAniListFallback }
    : {}),
  ...(typeof card.href === "string" && card.href.length > 0
    ? { href: card.href }
    : {}),
});

export const catalogTvToMediaItem = (
  card: CatalogTvCard,
): TvShow & { media_type: "tv"; logo?: CanonicalCardLogo; href?: string } => ({
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
  ...(card.localized_backdrop ? { localized_backdrop: true } : {}),
  ...(typeof card.imdb_id === "string" ? { imdb_id: card.imdb_id } : {}),
  ...(typeof card.youtube_trailer_key === "string"
    ? { youtube_trailer_key: card.youtube_trailer_key }
    : {}),
  ...(typeof card.isAniListFallback === "boolean"
    ? { isAniListFallback: card.isAniListFallback }
    : {}),
  ...(typeof card.href === "string" && card.href.length > 0
    ? { href: card.href }
    : {}),
});

export const catalogCardToMediaItem = (
  card: CatalogMediaCard,
): (Movie | TvShow) & {
  media_type: "movie" | "tv";
  logo?: CanonicalCardLogo;
  href?: string;
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

export type SlimmableMediaItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  localized_backdrop?: boolean;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  logo?: CanonicalCardLogo;
  href?: string;
  imdb_id?: string;
  youtube_trailer_key?: string;
  isAniListFallback?: boolean;
};

const readSlimHref = (item: SlimmableMediaItem): string | undefined => {
  const href = (item as { href?: unknown }).href;
  return typeof href === "string" && href.startsWith("/") ? href : undefined;
};

/** Preview fields the hover-trailer pipeline needs to survive RSC slimming. */
const readSlimPreviewFields = (
  item: SlimmableMediaItem,
): CatalogCardPreviewFields => {
  const source = item as {
    imdb_id?: unknown;
    youtube_trailer_key?: unknown;
    isAniListFallback?: unknown;
  };
  return {
    ...(typeof source.imdb_id === "string" && source.imdb_id.startsWith("tt")
      ? { imdb_id: source.imdb_id }
      : {}),
    ...(typeof source.youtube_trailer_key === "string" &&
    source.youtube_trailer_key.length > 0
      ? { youtube_trailer_key: source.youtube_trailer_key }
      : {}),
    ...(typeof source.isAniListFallback === "boolean"
      ? { isAniListFallback: source.isAniListFallback }
      : {}),
  };
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
    const href = readSlimHref(item);
    const previewFields = readSlimPreviewFields(item);
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
            localized_backdrop: item.localized_backdrop,
            first_air_date: item.first_air_date ?? item.release_date ?? "",
            vote_average: item.vote_average ?? 0,
            vote_count: item.vote_count,
            logo: item.logo,
            ...previewFields,
            ...(href ? { href } : {}),
          } satisfies CatalogTvCard)
        : ({
            id: item.id,
            media_type: "movie",
            title,
            overview: item.overview ?? "",
            poster_path: item.poster_path ?? "",
            backdrop_path: item.backdrop_path ?? undefined,
            localized_backdrop: item.localized_backdrop,
            release_date: item.release_date ?? item.first_air_date ?? "",
            vote_average: item.vote_average ?? 0,
            vote_count: item.vote_count,
            logo: item.logo,
            ...previewFields,
            ...(href ? { href } : {}),
          } satisfies CatalogMovieCard);
    return catalogCardToMediaItem(card) as unknown as T;
  });

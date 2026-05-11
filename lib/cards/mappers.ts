import type {
  CanonicalCard,
  CanonicalMediaCard,
  CanonicalMovieCard,
  CanonicalPersonCard,
  CanonicalTvCard,
  MediaItem,
} from "@/utils/typings";
import { formatYear } from "./formatters";

export type MappableMediaItem = Partial<MediaItem> & {
  id: number;
  media_type?: "movie" | "tv" | "person" | string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  profile_path?: string | null;
  known_for_department?: string;
  known_for?: unknown[];
  deathday?: string | null;
};

const toGenreObjects = (item: MappableMediaItem) => {
  if (Array.isArray(item.genres)) {
    return item.genres.map((genre) => ({
      id: genre.id,
      name: genre.name,
    }));
  }

  const categories = Array.isArray(
    (item as MappableMediaItem & { categories?: unknown }).categories,
  )
    ? ((item as MappableMediaItem & { categories?: string[] }).categories ?? [])
    : [];

  return item.genre_ids?.map((id, index) => ({
    id,
    name: categories[index],
  }));
};

const toCountryCodes = (item: MappableMediaItem): string[] | undefined => {
  if (Array.isArray(item.origin_country) && item.origin_country.length > 0) {
    return item.origin_country;
  }
  if (
    Array.isArray(item.production_countries) &&
    item.production_countries.length > 0
  ) {
    return item.production_countries.map((country) => country.iso_3166_1);
  }
  return undefined;
};

export function mapMovieToCanonicalCardValue(
  movie: MappableMediaItem,
): CanonicalMovieCard {
  const date = movie.release_date || movie.first_air_date;
  return {
    ...movie,
    id: movie.id,
    media_type: "movie",
    title: movie.title || movie.name || "",
    name: movie.name,
    href: `/movies/${movie.id}`,
    poster_path: movie.poster_path ?? null,
    backdrop_path: movie.backdrop_path ?? null,
    overview: movie.overview,
    release_date: movie.release_date,
    date,
    year: formatYear(date),
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
    popularity: movie.popularity,
    logo: movie.logo,
    content_rating: movie.content_rating,
    genre_ids: movie.genre_ids,
    genres: toGenreObjects(movie),
    runtime: typeof movie.runtime === "number" ? movie.runtime : undefined,
    country_codes: toCountryCodes(movie),
  };
}

export function mapTvShowToCanonicalCardValue(
  show: MappableMediaItem,
): CanonicalTvCard {
  const date = show.first_air_date || show.release_date;
  const title = show.name || show.title || "";
  return {
    ...show,
    id: show.id,
    media_type: "tv",
    title,
    name: title,
    href: `/tvshows/${show.id}`,
    poster_path: show.poster_path ?? null,
    backdrop_path: show.backdrop_path ?? null,
    overview: show.overview,
    first_air_date: show.first_air_date,
    date,
    year: formatYear(date),
    vote_average: show.vote_average,
    vote_count: show.vote_count,
    popularity: show.popularity,
    logo: show.logo,
    content_rating: show.content_rating,
    genre_ids: show.genre_ids,
    genres: toGenreObjects(show),
    runtime: typeof show.runtime === "number" ? show.runtime : undefined,
    country_codes: toCountryCodes(show),
  };
}

export function mapPersonToCanonicalCardValue(
  person: MappableMediaItem,
): CanonicalPersonCard {
  const name = person.name || person.title || "";
  const knownFor = person.known_for
    ?.map((item) => {
      if (!item || typeof item !== "object" || !("id" in item)) return null;
      const media = item as MappableMediaItem;
      if (media.media_type === "tv" || (!media.title && media.name)) {
        const card = mapTvShowToCanonicalCardValue(media);
        return {
          id: card.id,
          media_type: card.media_type,
          title: card.title,
          poster_path: card.poster_path,
          href: card.href,
        };
      }
      const card = mapMovieToCanonicalCardValue(media);
      return {
        id: card.id,
        media_type: card.media_type,
        title: card.title,
        poster_path: card.poster_path,
        href: card.href,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    id: person.id,
    media_type: "person",
    name,
    title: name,
    href: `/person/${person.id}`,
    profile_path: person.profile_path,
    poster_path: person.profile_path,
    popularity: person.popularity,
    known_for_department: person.known_for_department,
    known_for: knownFor,
    deathday: person.deathday,
  };
}

export function mapMediaToCanonicalCardValue(
  item: MappableMediaItem,
  fallbackType?: "movie" | "tv",
): CanonicalMediaCard {
  const mediaType =
    item.media_type === "tv" || item.media_type === "movie"
      ? item.media_type
      : fallbackType;

  if (mediaType === "tv" || (!mediaType && !item.title && item.name)) {
    return mapTvShowToCanonicalCardValue(item);
  }
  return mapMovieToCanonicalCardValue(item);
}

export function mapMediaListToCanonicalCardsValue(
  items: MappableMediaItem[],
  fallbackType?: "movie" | "tv",
): CanonicalMediaCard[] {
  return items.map((item) => mapMediaToCanonicalCardValue(item, fallbackType));
}

export function mapItemsToCanonicalCardsValue(
  items: MappableMediaItem[],
  fallbackType?: "movie" | "tv",
): CanonicalCard[] {
  return items.map((item) =>
    item.media_type === "person"
      ? mapPersonToCanonicalCardValue(item)
      : mapMediaToCanonicalCardValue(item, fallbackType),
  );
}

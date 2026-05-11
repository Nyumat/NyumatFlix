import type { CanonicalCard, CanonicalMediaCard, Genre } from "@/utils/typings";
import { formatRating, formatRuntime, formatYear } from "./formatters";
import { isCanonicalPersonCard } from "./guards";

type LegacyMediaLike = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  content_rating?: string | null;
  genre_ids?: number[];
  genres?: Genre[];
  origin_country?: string[];
  production_countries?: Array<{ iso_3166_1: string; name?: string }>;
};

export function getDisplayTitle(item: CanonicalCard | LegacyMediaLike): string {
  return item.title || item.name || "";
}

export function getDisplayDate(
  item: CanonicalCard | LegacyMediaLike,
): string | undefined {
  return (
    ("date" in item ? item.date : undefined) ||
    ("release_date" in item ? item.release_date : undefined) ||
    ("first_air_date" in item ? item.first_air_date : undefined)
  );
}

export function getDisplayYear(
  item: CanonicalCard | LegacyMediaLike,
): string | undefined {
  return (
    ("year" in item ? item.year : undefined) || formatYear(getDisplayDate(item))
  );
}

export function getHref(item: CanonicalCard | LegacyMediaLike): string {
  if ("href" in item && item.href) return item.href;
  if (item.media_type === "person") return `/person/${item.id}`;
  if (item.media_type === "tv" || (!item.title && item.name)) {
    return `/tvshows/${item.id}`;
  }
  return `/movies/${item.id}`;
}

export function getPosterPath(
  item: CanonicalCard | LegacyMediaLike,
): string | null | undefined {
  return isCanonicalPersonCard(item as CanonicalCard)
    ? item.profile_path
    : item.poster_path;
}

export function getBackdropPath(
  item: CanonicalCard | LegacyMediaLike,
): string | null | undefined {
  return item.backdrop_path;
}

export function getRatingDisplay(
  item: CanonicalCard | LegacyMediaLike,
): string | undefined {
  return formatRating(item.vote_average);
}

export function getRuntimeText(
  item: CanonicalCard | LegacyMediaLike,
): string | undefined {
  return formatRuntime(item.runtime);
}

export function getContentRatingDisplay(
  item: CanonicalCard | LegacyMediaLike,
): string | undefined {
  return item.content_rating || undefined;
}

export function getCountryCodes(
  item: CanonicalCard | LegacyMediaLike,
): string[] {
  if ("country_codes" in item && item.country_codes?.length) {
    return item.country_codes;
  }
  if (item.media_type === "tv" && item.origin_country?.length) {
    return item.origin_country;
  }
  if ("production_countries" in item && item.production_countries?.length) {
    return item.production_countries.map((country) => country.iso_3166_1);
  }
  return "origin_country" in item ? (item.origin_country ?? []) : [];
}

export function getGenreIds(item: CanonicalCard | LegacyMediaLike): number[] {
  if (item.genre_ids?.length) return item.genre_ids;
  if (item.genres?.length) return item.genres.map((genre) => genre.id);
  return [];
}

export function getGenres(
  item: CanonicalCard | LegacyMediaLike,
): Array<{ id: number; name?: string }> {
  if (item.genres?.length) return item.genres;
  return getGenreIds(item).map((id) => ({ id }));
}

export function getStableCardKey(
  item: CanonicalCard | LegacyMediaLike,
): string {
  return `${item.media_type ?? "media"}-${item.id}`;
}

export function getMediaLabel(
  item: CanonicalMediaCard | LegacyMediaLike,
): string {
  return item.media_type === "tv" ? "TV Show" : "Movie";
}

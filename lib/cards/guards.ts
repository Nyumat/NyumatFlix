import type {
  CanonicalCard,
  CanonicalMediaCard,
  CanonicalMovieCard,
  CanonicalPersonCard,
  CanonicalTvCard,
} from "@/utils/typings";

export function isCanonicalMovieCard(
  item: CanonicalCard,
): item is CanonicalMovieCard {
  return item.media_type === "movie";
}

export function isCanonicalTvCard(
  item: CanonicalCard,
): item is CanonicalTvCard {
  return item.media_type === "tv";
}

export function isCanonicalPersonCard(
  item: CanonicalCard,
): item is CanonicalPersonCard {
  return item.media_type === "person";
}

export function isPlayableCanonicalCard(
  item: CanonicalCard,
): item is CanonicalMediaCard {
  return item.media_type === "movie" || item.media_type === "tv";
}

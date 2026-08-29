import type { MediaItem } from "@/lib/domain/typings";

export type DetectedMediaType = "movie" | "tv";

type DetectMediaTypeInput = {
  media: MediaItem;
  mediaType?: DetectedMediaType;
  pathname?: string;
};

export function detectMediaType({
  media,
  mediaType,
  pathname,
}: DetectMediaTypeInput): DetectedMediaType {
  if (mediaType) {
    return mediaType;
  }

  const isTvShow =
    media.media_type === "tv" ||
    media.name !== undefined ||
    media.first_air_date !== undefined ||
    media.number_of_seasons !== undefined ||
    media.number_of_episodes !== undefined;

  if (isTvShow) {
    return "tv";
  }

  if (pathname?.includes("/tvshows/")) {
    return "tv";
  }

  if (pathname?.includes("/movies/")) {
    return "movie";
  }

  return "movie";
}

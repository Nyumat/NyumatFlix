import { getEffectiveDiscoverSort } from "@/lib/discover-query-state";

const MEDIA_SUFFIX: Record<"movie" | "tv", string> = {
  movie: "Movies",
  tv: "TV Shows",
};

export const withDiscoverMediaSuffix = (
  title: string,
  mediaType: "movie" | "tv",
): string => `${title} · ${MEDIA_SUFFIX[mediaType]}`;

export const getDiscoverSortTitle = (
  sortBy: string | undefined,
  mediaType: "movie" | "tv",
): string => {
  const dateField =
    mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const key = getEffectiveDiscoverSort(sortBy);

  const labels: Record<string, string> = {
    "popularity.desc": "Highest Popularity",
    "popularity.asc": "Lowest Popularity",
    [`${dateField}.desc`]: "Most Recent",
    [`${dateField}.asc`]: "Least Recent",
    "vote_average.desc": "Highest Rating",
    "vote_average.asc": "Lowest Rating",
    "vote_count.desc": "Most Voted",
    "vote_count.asc": "Least Voted",
  };

  const base = labels[key] ?? "Most Popular";
  return withDiscoverMediaSuffix(base, mediaType);
};

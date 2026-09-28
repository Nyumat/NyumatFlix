import type { MediaItem } from "@/lib/domain/typings";

/** Top popularity in a `popularity.desc` feed (requires backdrop art). */
export const pickMostPopularHubFeatured = (items: MediaItem[]) => {
  const withBackdrop = items.filter((item) => Boolean(item.backdrop_path));
  if (withBackdrop.length === 0) return undefined;

  return withBackdrop.reduce((best, item) =>
    (item.popularity ?? 0) > (best.popularity ?? 0) ? item : best,
  );
};

/** Highest-rated title with enough votes; ignores TMDB popularity inflation. */
export const pickCriticallyAcclaimedHubFeatured = (items: MediaItem[]) => {
  const withBackdrop = items.filter((item) => Boolean(item.backdrop_path));
  if (withBackdrop.length === 0) return undefined;

  return withBackdrop.reduce((best, item) => {
    const bestRating = best.vote_average ?? 0;
    const itemRating = item.vote_average ?? 0;
    if (itemRating > bestRating) return item;
    if (itemRating < bestRating) return best;

    const bestVotes = best.vote_count ?? 0;
    const itemVotes = item.vote_count ?? 0;
    return itemVotes > bestVotes ? item : best;
  });
};

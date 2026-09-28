import { COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID } from "@/lib/analytics/community-watching-exclusions";

/** TMDB ids that must not appear in home/movies/tv genre showcase rails (see /anime for adult). */
const CATALOG_SHOWCASE_EXCLUDED_TMDB_TV_IDS = new Set<number>([
  COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID,
]);

export const isFamilySafeCatalogShowcaseItem = (item: {
  id: number;
  adult?: boolean;
  media_type?: string;
}): boolean => {
  if (item.adult === true) {
    return false;
  }

  if (
    item.media_type === "tv" &&
    CATALOG_SHOWCASE_EXCLUDED_TMDB_TV_IDS.has(item.id)
  ) {
    return false;
  }

  return true;
};

export const filterFamilySafeCatalogShowcaseItems = <
  T extends { id: number; adult?: boolean; media_type?: string },
>(
  items: T[],
): T[] => items.filter(isFamilySafeCatalogShowcaseItem);

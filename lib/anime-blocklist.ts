import type { MediaItem } from "@/lib/domain/typings";

/** AniList or TMDB ids to omit from /anime surfaces. */
export const ANIME_BLOCKLIST_IDS = [95897] as const;

const blockedIds = new Set<number>(ANIME_BLOCKLIST_IDS);

export const isAnimeBlocked = (item: MediaItem): boolean => {
  if (blockedIds.has(item.id)) return true;

  const sourceAnilistId =
    "sourceAnilistId" in item && typeof item.sourceAnilistId === "number"
      ? item.sourceAnilistId
      : null;

  return sourceAnilistId !== null && blockedIds.has(sourceAnilistId);
};

export const isAniListIdBlocked = (id: number): boolean => blockedIds.has(id);

export const filterAnimeBlocked = (items: MediaItem[]): MediaItem[] =>
  items.filter((item) => !isAnimeBlocked(item));

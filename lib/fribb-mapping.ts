import { unstable_cache } from "next/cache";

export type FribbMappingItem = {
  anilist_id?: number;
  themoviedb_id?: {
    tv?: number;
    movie?: number;
  };
};

const FRIBB_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json";

export const getFribbMapping = unstable_cache(
  async () => {
    try {
      const res = await fetch(FRIBB_URL, {
        next: { revalidate: 60 * 60 * 24 }, // Cache for 24 hours
      });
      if (!res.ok) return null;

      const data: FribbMappingItem[] = await res.json();

      // Store as Record for JSON serialization in Next.js cache
      const mapping: Record<number, { id: number; type: "movie" | "tv" }> = {};

      for (const item of data) {
        if (!item.anilist_id || !item.themoviedb_id) continue;

        if (item.themoviedb_id.tv) {
          mapping[item.anilist_id] = { id: item.themoviedb_id.tv, type: "tv" };
        } else if (item.themoviedb_id.movie) {
          mapping[item.anilist_id] = {
            id: item.themoviedb_id.movie,
            type: "movie",
          };
        }
      }

      return mapping;
    } catch (e) {
      console.error("Failed to fetch Fribb mapping:", e);
      return null;
    }
  },
  ["fribb-anime-mapping"],
  { revalidate: 60 * 60 * 24 },
);

export const getTmdbIdFromFribb = async (anilistId: number) => {
  const mapping = await getFribbMapping();
  return mapping?.[anilistId] ?? null;
};

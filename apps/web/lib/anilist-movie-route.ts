import "server-only";

import { getCachedAnilistTvMedia } from "@/lib/anilist-tv-detail";
import { fetchIdsMoeMappingByAniListId } from "@/lib/ids-moe";
import { getTmdbIdFromFribb } from "@/lib/fribb-mapping";

export const resolveAnilistMovieTmdbRoute = async (
  anilistId: number,
): Promise<number | null> => {
  const media = await getCachedAnilistTvMedia(anilistId);
  if (media?.format !== "MOVIE") {
    return null;
  }

  const fribbMapping = await getTmdbIdFromFribb(anilistId, "MOVIE");
  if (fribbMapping?.type === "movie") {
    return fribbMapping.id;
  }

  const idsMoeMapping = await fetchIdsMoeMappingByAniListId(anilistId);
  if (
    typeof idsMoeMapping?.themoviedb === "number" &&
    idsMoeMapping.themoviedb > 0 &&
    (idsMoeMapping.themoviedb_type === "movie" ||
      idsMoeMapping.themoviedb_type == null)
  ) {
    return idsMoeMapping.themoviedb;
  }

  return null;
};

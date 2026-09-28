import "server-only";

import { getCachedAnilistTvMedia } from "@/lib/anilist-tv-detail";
import { fetchIdsMoeMappingByAniListId } from "@/lib/ids-moe";
import { getTmdbIdFromFribb } from "@/lib/fribb-mapping";

/** Local Fribb movie mapping. Used on the detail redirect hot path. */
export const resolveAnilistMovieTmdbRouteFromFribb = async (
  anilistId: number,
): Promise<number | null> => {
  const fribbMapping = await getTmdbIdFromFribb(anilistId, "MOVIE");
  return fribbMapping?.type === "movie" ? fribbMapping.id : null;
};

export const resolveAnilistMovieTmdbRoute = async (
  anilistId: number,
): Promise<number | null> => {
  const media = await getCachedAnilistTvMedia(anilistId);
  if (media?.format !== "MOVIE") {
    return null;
  }

  const fribbMovieId = await resolveAnilistMovieTmdbRouteFromFribb(anilistId);
  if (fribbMovieId) {
    return fribbMovieId;
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

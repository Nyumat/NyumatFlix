import "server-only";

import type {
  AniListTvMedia,
  ResolvedAniListTvShow,
} from "@/lib/anilist-tv-detail";
import { isTmdbStyleBackdropPath } from "@/lib/hero-backdrop-aspect";
import {
  getKitsuCoverImageForAnilist,
  getKitsuFirstEpisodeThumbnailForAnilist,
} from "@/lib/anime/kitsu-episode-thumbnails";
import type { TvShowDetails } from "@/lib/domain/typings";

export const youtubeTrailerMaxresUrl = (videoKey: string): string =>
  `https://i.ytimg.com/vi/${videoKey.trim()}/maxresdefault.jpg`;

export const youtubeMaxresFromAnilistMedia = (
  ...media: readonly AniListTvMedia[]
): string | null => {
  for (const entry of media) {
    const site = entry.trailer?.site?.trim().toLowerCase();
    const key = entry.trailer?.id?.trim();
    if (!key) continue;
    if (site && site !== "youtube") continue;
    return youtubeTrailerMaxresUrl(key);
  }

  return null;
};

export const pickFirstEpisodeStillFromDetails = (
  details: TvShowDetails,
): string | null => {
  const season =
    details.seasons?.find((entry) => entry.season_number === 1) ??
    details.seasons?.[0];
  const episode =
    season?.episodes?.find((entry) => entry.episode_number === 1) ??
    season?.episodes?.[0];
  const stillPath = episode?.still_path?.trim();

  if (!stillPath || stillPath === details.poster_path) {
    return null;
  }

  if (stillPath.startsWith("/") || stillPath.startsWith("http")) {
    return stillPath;
  }

  return null;
};

export const resolveAnilistHeroBackdropFallbacks = async (
  resolved: ResolvedAniListTvShow,
  details: TvShowDetails,
): Promise<string | null> => {
  const trailerBackdrop = youtubeMaxresFromAnilistMedia(
    resolved.entry,
    resolved.root,
  );
  if (trailerBackdrop) {
    return trailerBackdrop;
  }

  const episodeStill = pickFirstEpisodeStillFromDetails(details);
  if (episodeStill) {
    return episodeStill;
  }

  const anilistId = resolved.franchise.rootAnilistId ?? resolved.entry.id;

  const kitsuEpisodeStill =
    await getKitsuFirstEpisodeThumbnailForAnilist(anilistId);
  if (kitsuEpisodeStill) {
    return kitsuEpisodeStill;
  }

  const kitsuCover = await getKitsuCoverImageForAnilist(anilistId);
  if (kitsuCover) {
    return kitsuCover;
  }

  return null;
};

export const shouldResolveAnilistHeroBackdropFallbacks = (
  backdropPath: string | null | undefined,
): boolean => !isTmdbStyleBackdropPath(backdropPath);

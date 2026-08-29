import type { MediaItem } from "@/lib/domain/typings";
import { tmdbImage, type BackdropSize, type PosterSize } from "@/tmdb/utils";

export type HeroBackgroundImageKind = "backdrop" | "poster" | "still";

export type ResolvedHeroBackgroundImage = {
  path: string;
  kind: HeroBackgroundImageKind;
};

export const hasDistinctBackdrop = (
  backdropPath?: string | null,
  posterPath?: string | null,
): boolean =>
  Boolean(backdropPath?.trim()) &&
  Boolean(posterPath?.trim()) &&
  backdropPath !== posterPath;

export const resolveHeroBackgroundImage = (
  media: MediaItem,
  options: {
    preferPosterWhenNoBackdrop?: boolean;
    episodeStillPath?: string | null;
  } = {},
): ResolvedHeroBackgroundImage | null => {
  const posterPath = media.poster_path ?? null;
  const backdropPath = media.backdrop_path ?? null;
  const stillPath = options.episodeStillPath ?? null;
  const distinctBackdrop = hasDistinctBackdrop(backdropPath, posterPath);

  if (distinctBackdrop && backdropPath) {
    return { path: backdropPath, kind: "backdrop" };
  }

  if (options.preferPosterWhenNoBackdrop && posterPath) {
    return { path: posterPath, kind: "poster" };
  }

  if (backdropPath) {
    return { path: backdropPath, kind: "backdrop" };
  }

  if (posterPath) {
    return { path: posterPath, kind: "poster" };
  }

  if (stillPath) {
    return { path: stillPath, kind: "still" };
  }

  return null;
};

export const heroBackgroundImageUrl = (
  image: ResolvedHeroBackgroundImage,
  size: BackdropSize | PosterSize = "original",
): string => {
  if (image.kind === "poster") {
    return tmdbImage.poster(image.path, size as PosterSize);
  }

  return tmdbImage.backdrop(image.path, size as BackdropSize);
};

export const isPosterHeroBackground = (
  image: ResolvedHeroBackgroundImage | null,
): boolean => image?.kind === "poster";

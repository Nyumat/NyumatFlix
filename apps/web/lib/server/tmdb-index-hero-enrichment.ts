import "server-only";

import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import { pickHeroBackdropPath } from "@/lib/catalog-hub-backdrop";
import { tmdb, type WithImages } from "@/tmdb/api";
import type { Image, MovieDetails, TvShowDetails } from "@/tmdb/models";

export type TmdbIndexHeroMediaType = "movie" | "tv";

const selectLogo = (logos: Image[] | undefined) =>
  logos?.find((logo) => logo.iso_639_1 === "en") ?? logos?.[0];

const mapMovieHubFeatureItem = (
  detail: MovieDetails & WithImages,
): IndexFeatureHeroItem =>
  ({
    ...detail,
    media_type: "movie" as const,
    genre_ids: detail.genres.map((genre) => genre.id),
    backdrop_path: pickHeroBackdropPath(detail),
    logo: selectLogo(detail.images?.logos),
  }) as IndexFeatureHeroItem;

const mapTvHubFeatureItem = (
  detail: TvShowDetails & WithImages,
): IndexFeatureHeroItem =>
  ({
    ...detail,
    media_type: "tv" as const,
    genre_ids: detail.genres.map((genre) => genre.id),
    backdrop_path: pickHeroBackdropPath(detail),
    logo: selectLogo(detail.images?.logos),
  }) as IndexFeatureHeroItem;

export const enrichTmdbIndexHeroItem = async (
  featured: IndexFeatureHeroItem,
  mediaType: TmdbIndexHeroMediaType,
): Promise<IndexFeatureHeroItem> => {
  try {
    if (mediaType === "movie") {
      const detail = await tmdb.movie.detail<WithImages>({
        id: featured.id,
        append: "images",
      });
      return mapMovieHubFeatureItem(detail);
    }

    const detail = await tmdb.tv.detail<WithImages>({
      id: featured.id,
      append: "images",
    });
    return mapTvHubFeatureItem(detail);
  } catch {
    return featured;
  }
};

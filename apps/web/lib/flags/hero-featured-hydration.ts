import "server-only";

import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import { fetchAniListGraphql } from "@/lib/anilist-graphql";
import type { AniListMedia } from "@/lib/anilist-shared";
import { resolveAnimeFeaturedMediaItem } from "@/lib/anilist-tmdb";
import type {
  HeroBackdropOverrideEntry,
  HeroBackdropOverridesConfig,
} from "@/lib/flags/hero-backdrop-overrides";
import { applyHeroBackdropOverride } from "@/lib/flags/hero-backdrop-overrides-server";
import {
  enrichTmdbIndexHeroItem,
  type TmdbIndexHeroMediaType,
} from "@/lib/server/tmdb-index-hero-enrichment";

const ANILIST_HERO_PIN_QUERY = `
  query HeroPinMedia($id: Int, $idMal: Int) {
    Media(id: $id, idMal: $idMal, type: ANIME) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      type
      format
      status
      description(asHtml: false)
      season
      seasonYear
      episodes
      coverImage {
        large
        extraLarge
        color
      }
      bannerImage
      genres
      averageScore
      popularity
      isAdult
      startDate {
        year
        month
        day
      }
      siteUrl
      trailer {
        id
        site
      }
    }
  }
`;

type AniListHeroPinPayload = {
  Media?: AniListMedia | null;
};

const heroBackdropMatchForEntry = (
  entry: HeroBackdropOverrideEntry,
): {
  mediaType: HeroBackdropOverrideEntry["mediaType"];
  tmdbId: number | null;
  anilistId: number | null;
  malId: number | null;
} => ({
  mediaType: entry.mediaType,
  tmdbId: entry.tmdbId,
  anilistId: entry.anilistId,
  malId: entry.malId,
});

const fetchAniListMediaForPin = async (
  entry: HeroBackdropOverrideEntry,
): Promise<AniListMedia | null> => {
  const variables: { id?: number; idMal?: number } = {};
  if (entry.anilistId) {
    variables.id = entry.anilistId;
  } else if (entry.malId) {
    variables.idMal = entry.malId;
  } else {
    return null;
  }

  try {
    const payload = await fetchAniListGraphql<AniListHeroPinPayload>({
      query: ANILIST_HERO_PIN_QUERY,
      variables,
    });
    return payload.data?.Media ?? null;
  } catch {
    return null;
  }
};

const hydrateAnimeFeaturedEntry = async (
  entry: HeroBackdropOverrideEntry,
  overrides: HeroBackdropOverridesConfig,
): Promise<IndexFeatureHeroItem | null> => {
  const anilistMedia = await fetchAniListMediaForPin(entry);
  if (anilistMedia) {
    const resolved = await resolveAnimeFeaturedMediaItem(anilistMedia);
    return applyHeroBackdropOverride(
      resolved as IndexFeatureHeroItem,
      overrides,
      heroBackdropMatchForEntry(entry),
    );
  }

  if (!entry.tmdbId) {
    return null;
  }

  const tmdbMediaType: TmdbIndexHeroMediaType =
    entry.mediaType === "anime" ? "tv" : entry.mediaType;
  const tmdbItem = await enrichTmdbIndexHeroItem(
    { id: entry.tmdbId, media_type: tmdbMediaType } as IndexFeatureHeroItem,
    tmdbMediaType,
  );
  return applyHeroBackdropOverride(tmdbItem, overrides, {
    mediaType: "anime",
    tmdbId: entry.tmdbId,
    anilistId: entry.anilistId,
    malId: entry.malId,
  });
};

const hydrateTmdbFeaturedEntry = async (
  entry: HeroBackdropOverrideEntry,
  overrides: HeroBackdropOverridesConfig,
  mediaType: TmdbIndexHeroMediaType,
): Promise<IndexFeatureHeroItem | null> => {
  if (!entry.tmdbId) {
    return null;
  }

  const item = await enrichTmdbIndexHeroItem(
    { id: entry.tmdbId, media_type: mediaType } as IndexFeatureHeroItem,
    mediaType,
  );
  return applyHeroBackdropOverride(item, overrides, {
    mediaType,
    tmdbId: entry.tmdbId,
  });
};

export const hydrateFeaturedHubEntry = async (
  entry: HeroBackdropOverrideEntry,
  overrides: HeroBackdropOverridesConfig,
): Promise<IndexFeatureHeroItem | null> => {
  if (entry.mediaType === "anime") {
    return hydrateAnimeFeaturedEntry(entry, overrides);
  }

  return hydrateTmdbFeaturedEntry(entry, overrides, entry.mediaType);
};

export const hydrateFeaturedHubEntries = async (
  entries: HeroBackdropOverrideEntry[],
  overrides: HeroBackdropOverridesConfig,
): Promise<IndexFeatureHeroItem[]> => {
  const hydrated = await Promise.all(
    entries.map((entry) => hydrateFeaturedHubEntry(entry, overrides)),
  );
  return hydrated.filter((item): item is IndexFeatureHeroItem => Boolean(item));
};

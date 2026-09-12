import "server-only";

import { unstable_cache } from "next/cache";
import {
  ANILIST_ENDPOINT,
  requiresAdultAniListContent,
  type AniListPage,
  type AniListSearchParams,
} from "@/lib/anilist-shared";
import { resolveAnimeCatalogFallbackEffect } from "@/lib/server/anime-catalog-flow";
import {
  fetchResponseEffect,
  readJsonEffect,
  runCatalogEffect,
  type CatalogProviderError,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";

// Pure helpers, constants, and types stay client-safe in `./anilist-shared`.
// This module adds server-only fetching on top and re-exports the shared API
// so existing server imports keep working.
export {
  ANILIST_ENDPOINT,
  ANILIST_FORMAT_OPTIONS,
  ANILIST_GENRES,
  ANILIST_SEASON_OPTIONS,
  ANILIST_SORT_OPTIONS,
  ANILIST_STATUS_OPTIONS,
  ANIME_BROWSE_PATH,
  buildAniListUrl,
  cleanAniListDescription,
  getAniListPoster,
  getAniListTitle,
  getAniListYear,
  hasActiveAniListFilters,
  isAniListResultsLayout,
  mapAniListMediaToMediaItem,
  mapAniListPageToMediaItems,
  parseAniListSearchParams,
  requiresAdultAniListContent,
  type AniListMedia,
  type AniListMedium,
  type AniListPage,
  type AniListPageInfo,
  type AniListSearchParams,
  type AniListSort,
} from "@/lib/anilist-shared";

const ANILIST_FETCH_TIMEOUT_MS = 8000;

const ANILIST_PAGE_QUERY = `
  query AniListCatalog(
    $page: Int,
    $perPage: Int,
    $type: MediaType,
    $sort: [MediaSort],
    $countryOfOrigin: CountryCode,
    $genres: [String],
    $formats: [MediaFormat],
    $status: MediaStatus,
    $season: MediaSeason,
    $seasonYear: Int,
    $search: String,
    $isAdult: Boolean
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
        perPage
      }
      media(
        type: $type,
        sort: $sort,
        countryOfOrigin: $countryOfOrigin,
        genre_in: $genres,
        format_in: $formats,
        status: $status,
        season: $season,
        seasonYear: $seasonYear,
        search: $search,
        isAdult: $isAdult
      ) {
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
        chapters
        volumes
        countryOfOrigin
        coverImage {
          large
          extraLarge
          color
        }
        bannerImage
        genres
        averageScore
        popularity
        trending
        startDate {
          year
          month
          day
        }
        siteUrl
      }
    }
  }
`;

type AniListResponse = {
  data?: {
    Page?: AniListPage;
  };
  errors?: Array<{ message: string }>;
};

const compact = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) =>
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0),
    ),
  );

const ANILIST_REVALIDATE_SECONDS = 3600;

const fetchAniListPageEffect = ({
  page = 1,
  perPage = 24,
  params,
}: {
  page?: number;
  perPage?: number;
  params: AniListSearchParams;
}): Effect.Effect<AniListPage, CatalogProviderError> =>
  Effect.gen(function* () {
    const variables = compact({
      page,
      perPage,
      type: "ANIME",
      sort: [params.sort],
      genres: params.genres,
      formats: params.format ? [params.format] : undefined,
      status: params.status,
      season: params.season,
      seasonYear: params.year,
      search: params.query,
      isAdult: requiresAdultAniListContent(params.genres),
    });

    const responseResult = yield* Effect.either(
      fetchResponseEffect({
        provider: "anilist",
        input: ANILIST_ENDPOINT,
        timeoutMs: ANILIST_FETCH_TIMEOUT_MS,
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ query: ANILIST_PAGE_QUERY, variables }),
          next: { revalidate: ANILIST_REVALIDATE_SECONDS },
        },
      }),
    );
    if (responseResult._tag === "Left") {
      return yield* resolveAnimeCatalogFallbackEffect({
        page,
        perPage,
        params,
        reason: responseResult.left.message,
      });
    }
    const response = responseResult.right;

    if (!response.ok) {
      return yield* resolveAnimeCatalogFallbackEffect({
        page,
        perPage,
        params,
        reason: `status ${response.status}`,
      });
    }

    const payloadResult = yield* Effect.either(
      readJsonEffect<AniListResponse>("anilist", response),
    );
    if (payloadResult._tag === "Left") {
      return yield* resolveAnimeCatalogFallbackEffect({
        page,
        perPage,
        params,
        reason: payloadResult.left.message,
      });
    }
    const payload = payloadResult.right;
    if (payload.errors?.length) {
      return yield* resolveAnimeCatalogFallbackEffect({
        page,
        perPage,
        params,
        reason: payload.errors.map((error) => error.message).join("; "),
      });
    }

    return (
      payload.data?.Page ?? {
        pageInfo: {
          currentPage: page,
          lastPage: page,
          hasNextPage: false,
          total: 0,
          perPage,
        },
        media: [],
      }
    );
  });

const fetchAniListPageUncached = (options: {
  page?: number;
  perPage?: number;
  params: AniListSearchParams;
}): Promise<AniListPage> => runCatalogEffect(fetchAniListPageEffect(options));

const getCachedAniListPage = unstable_cache(
  fetchAniListPageUncached,
  ["anilist-page"],
  { revalidate: ANILIST_REVALIDATE_SECONDS },
);

export const fetchAniListPage = getCachedAniListPage;

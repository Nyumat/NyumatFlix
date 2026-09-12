import "server-only";

import type { AniListMedia, AniListPage } from "@/lib/anilist-shared";
import { ANILIST_ENDPOINT } from "@/lib/anilist-shared";
import { enrichAniListSearchCatalogItems } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";
import { resolveAnimeSearchFallbackEffect } from "@/lib/server/anime-catalog-flow";
import {
  CatalogProviderError,
  fetchResponseEffect,
  readJsonEffect,
  runCatalogEffect,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";

const ANILIST_SEARCH_TIMEOUT_MS = 8000;

const ANILIST_SEARCH_QUERY = `
  query GlobalAnimeSearch(
    $search: String,
    $page: Int,
    $perPage: Int,
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
        search: $search,
        type: ANIME,
        sort: SEARCH_MATCH,
        isAdult: $isAdult
      ) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description(asHtml: false)
        seasonYear
        coverImage {
          large
          extraLarge
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
      }
    }
  }
`;

type AniListSearchResponse = {
  data?: { Page?: AniListPage };
  errors?: Array<{ message: string }>;
};

export type AniListSearchResult = {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
};

const emptyAniListSearch = (
  page: number,
  perPage: number,
): AniListSearchResult => ({
  items: [],
  page,
  totalPages: 1,
  totalResults: 0,
});

const fetchAniListSearchMediaEffect = (
  query: string,
  options: { page?: number; perPage?: number } = {},
): Effect.Effect<AniListSearchResult, CatalogProviderError> =>
  Effect.gen(function* () {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return emptyAniListSearch(options.page ?? 1, options.perPage ?? 20);
    }

    const page = options.page ?? 1;
    const perPage = options.perPage ?? 20;

    const fallback = (reason: string) =>
      resolveAnimeSearchFallbackEffect({
        page,
        perPage,
        params: {
          medium: "ANIME",
          sort: "TRENDING_DESC",
          query: trimmed,
          genres: [],
        },
        reason,
      });

    const responseResult = yield* Effect.either(
      fetchResponseEffect({
        provider: "anilist",
        input: ANILIST_ENDPOINT,
        timeoutMs: ANILIST_SEARCH_TIMEOUT_MS,
        init: {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            query: ANILIST_SEARCH_QUERY,
            variables: {
              search: trimmed,
              page,
              perPage,
              isAdult: true,
            },
          }),
          cache: "no-store",
        },
      }),
    );
    if (responseResult._tag === "Left") {
      console.error(
        "AniList search request failed:",
        responseResult.left.message,
      );
      return yield* fallback(responseResult.left.message);
    }
    const response = responseResult.right;

    if (!response.ok) {
      console.error(`AniList search failed: ${response.status}`);
      return yield* fallback(`status ${response.status}`);
    }

    const payloadResult = yield* Effect.either(
      readJsonEffect<AniListSearchResponse>("anilist", response),
    );
    if (payloadResult._tag === "Left") {
      console.error(
        "AniList search request failed:",
        payloadResult.left.message,
      );
      return yield* fallback(payloadResult.left.message);
    }
    const payload = payloadResult.right;
    if (payload.errors?.length) {
      console.error("AniList search errors:", payload.errors);
      return yield* fallback(
        payload.errors.map((error) => error.message).join("; "),
      );
    }

    const pageData = payload.data?.Page;
    const media = (pageData?.media ?? []).filter(
      (item): item is AniListMedia => item.type === "ANIME",
    );

    const enrichedResult = yield* Effect.either(
      Effect.tryPromise({
        try: () => enrichAniListSearchCatalogItems(media, media.length),
        catch: (cause) =>
          new CatalogProviderError({
            provider: "anilist",
            kind: "transport",
            message: "AniList search enrichment failed",
            cause,
          }),
      }),
    );
    if (enrichedResult._tag === "Left") {
      console.error(
        "AniList search request failed:",
        enrichedResult.left.message,
      );
      return yield* fallback(enrichedResult.left.message);
    }

    const withPoster = enrichedResult.right.filter((item) =>
      Boolean(item.poster_path),
    );

    return {
      items: withPoster,
      page: pageData?.pageInfo?.currentPage ?? page,
      totalPages: pageData?.pageInfo?.lastPage ?? 1,
      totalResults: pageData?.pageInfo?.total ?? withPoster.length,
    };
  });

export const fetchAniListSearchMedia = (
  query: string,
  options: { page?: number; perPage?: number } = {},
): Promise<AniListSearchResult> =>
  runCatalogEffect(fetchAniListSearchMediaEffect(query, options));

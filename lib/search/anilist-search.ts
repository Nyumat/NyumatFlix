import "server-only";

import type { AniListMedia, AniListPage } from "@/lib/anilist";
import { ANILIST_ENDPOINT } from "@/lib/anilist";
import { enrichAniListSearchCatalogItems } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";

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

export const fetchAniListSearchMedia = async (
  query: string,
  options: { page?: number; perPage?: number } = {},
): Promise<AniListSearchResult> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return emptyAniListSearch(options.page ?? 1, options.perPage ?? 20);
  }

  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
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
      signal: AbortSignal.timeout(ANILIST_SEARCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`AniList search failed: ${response.status}`);
      return emptyAniListSearch(page, perPage);
    }

    const payload = (await response.json()) as AniListSearchResponse;
    if (payload.errors?.length) {
      console.error("AniList search errors:", payload.errors);
      return emptyAniListSearch(page, perPage);
    }

    const pageData = payload.data?.Page;
    const media = (pageData?.media ?? []).filter(
      (item): item is AniListMedia => item.type === "ANIME",
    );

    const enriched = await enrichAniListSearchCatalogItems(media, media.length);

    const withPoster = enriched.filter((item) => Boolean(item.poster_path));

    return {
      items: withPoster,
      page: pageData?.pageInfo?.currentPage ?? page,
      totalPages: pageData?.pageInfo?.lastPage ?? 1,
      totalResults: pageData?.pageInfo?.total ?? withPoster.length,
    };
  } catch (error) {
    console.error("AniList search request failed:", error);
    return emptyAniListSearch(page, perPage);
  }
};

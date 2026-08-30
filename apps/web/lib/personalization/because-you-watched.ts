import { takeUniqueByIdInOrder } from "@/lib/catalog-page-dedupe";
import {
  fetchMovieRecommendationsPageClient,
  fetchTvRecommendationsPageClient,
} from "@/lib/media-detail-tab-client";
import type { RecentlyWatchedStub } from "@/lib/playback/recently-watched";
import { fetchTvShowDetailClient } from "@/lib/tv-show-detail-client";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";

export const BECAUSE_YOU_WATCHED_LIMIT = 20;

export type BecauseYouWatchedResult =
  | {
      seedTitle: string;
      mediaType: "movie";
      items: MovieWithMediaType[];
    }
  | {
      seedTitle: string;
      mediaType: "tv";
      items: TvShowWithMediaType[];
    };

type MovieDetailResponse = {
  id?: number;
  title?: string;
};

const isMatchingMovieDetail = (
  stub: RecentlyWatchedStub,
  detail: MovieDetailResponse,
): boolean => detail.id === stub.contentId;

async function fetchSeedTitle(
  stub: RecentlyWatchedStub,
): Promise<{ title: string; catalog: "anime" | null } | null> {
  if (stub.mediaType === "movie") {
    const response = await fetch(`/api/movies/${stub.contentId}`);
    if (!response.ok) {
      return stub.title ? { title: stub.title, catalog: null } : null;
    }

    const detail = (await response.json()) as MovieDetailResponse;
    if (!isMatchingMovieDetail(stub, detail)) {
      return null;
    }

    const title = detail.title ?? stub.title ?? null;
    return title ? { title, catalog: null } : null;
  }

  const fetched = await fetchTvShowDetailClient(stub.contentId, {
    expectedTitle: stub.title,
  });
  if (!fetched) {
    return stub.title ? { title: stub.title, catalog: null } : null;
  }

  const title = fetched.detail.name ?? stub.title ?? null;
  return title ? { title, catalog: fetched.catalog } : null;
}

export async function fetchBecauseYouWatchedRow(
  stubs: RecentlyWatchedStub[],
  excludeIds: ReadonlySet<number>,
): Promise<BecauseYouWatchedResult | null> {
  const seen = new Set(excludeIds);

  for (const stub of stubs) {
    const seed = await fetchSeedTitle(stub);
    if (!seed) {
      continue;
    }
    const { title: seedTitle, catalog } = seed;

    if (stub.mediaType === "movie") {
      const page = await fetchMovieRecommendationsPageClient(
        String(stub.contentId),
        "1",
      );
      const items = takeUniqueByIdInOrder(
        (page.results ?? []).map(
          (movie) =>
            ({
              ...movie,
              media_type: "movie",
            }) satisfies MovieWithMediaType,
        ),
        seen,
        BECAUSE_YOU_WATCHED_LIMIT,
      );

      if (items.length === 0) {
        continue;
      }

      return {
        seedTitle,
        mediaType: "movie",
        items,
      };
    }

    const page = await fetchTvRecommendationsPageClient(
      String(stub.contentId),
      "1",
      catalog,
    );
    const items = takeUniqueByIdInOrder(
      (page.results ?? []).map(
        (show) =>
          ({
            ...show,
            media_type: "tv",
          }) satisfies TvShowWithMediaType,
      ),
      seen,
      BECAUSE_YOU_WATCHED_LIMIT,
    );

    if (items.length === 0) {
      continue;
    }

    return {
      seedTitle,
      mediaType: "tv",
      items,
    };
  }

  return null;
}

import { takeUniqueByIdInOrder } from "@/lib/catalog-page-dedupe";
import {
  fetchMovieRecommendationsPageClient,
  fetchTvRecommendationsPageClient,
} from "@/lib/media-detail-tab-client";
import type { RecentlyWatchedStub } from "@/lib/playback/recently-watched";
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

type MediaDetailResponse = {
  id?: number;
  title?: string;
  name?: string;
};

const isMatchingTmdbDetail = (
  stub: RecentlyWatchedStub,
  detail: MediaDetailResponse,
): boolean => detail.id === stub.contentId;

async function fetchSeedTitle(
  stub: RecentlyWatchedStub,
): Promise<string | null> {
  const path =
    stub.mediaType === "movie"
      ? `/api/movies/${stub.contentId}`
      : `/api/tv/${stub.contentId}`;

  const response = await fetch(path);
  if (!response.ok) {
    return stub.title ?? null;
  }

  const detail = (await response.json()) as MediaDetailResponse;
  if (!isMatchingTmdbDetail(stub, detail)) {
    return null;
  }

  return stub.mediaType === "movie"
    ? (detail.title ?? stub.title ?? null)
    : (detail.name ?? stub.title ?? null);
}

export async function fetchBecauseYouWatchedRow(
  stubs: RecentlyWatchedStub[],
  excludeIds: ReadonlySet<number>,
): Promise<BecauseYouWatchedResult | null> {
  const seen = new Set(excludeIds);

  for (const stub of stubs) {
    const seedTitle = await fetchSeedTitle(stub);
    if (!seedTitle) {
      continue;
    }

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

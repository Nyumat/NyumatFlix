import {
  DETAIL_CONTENT_CONTAINER_CLASS,
  DetailPageLoading,
} from "@/components/layout/page-loading/detail-page-loading";
import { MediaDetailLayout } from "@/components/media/media-server";
import { hydrateMovieDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { getDetailRouteSearchParams } from "@/lib/detail-search-params";
import { resolveTmdbMediaToAnilistId } from "@/lib/anime/cross-id-resolver";
import { isAnime } from "@/utils/anilist-helpers";
import { isUpcomingMovie } from "@/utils/movie-helpers";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 3600;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

const parsePositiveInt = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

async function MovieDetailLayoutContent({ children, params }: Props) {
  const { id } = await params;
  const [movie, requestSearchParams] = await Promise.all([
    getCachedMovieDetail(id),
    getDetailRouteSearchParams(),
  ]);

  if (!movie || !("title" in movie)) {
    notFound();
  }
  if ("adult" in movie && movie.adult) {
    notFound();
  }

  const queryAnilistId = parsePositiveInt(requestSearchParams.get("anilistId"));
  const numericMovieId = Number.parseInt(id, 10);
  // Cold-path prop only (TMDB->anime UI hints). Never blocks paint: the
  // O(1) cached resolver runs alongside hydration data, no live search.
  const shouldAutoResolveAnime = queryAnilistId === null && isAnime(movie);
  const anilistIdPromise =
    shouldAutoResolveAnime && Number.isInteger(numericMovieId)
      ? resolveTmdbMediaToAnilistId(numericMovieId, "movie").catch(() => null)
      : Promise.resolve(null);
  const isUpcoming = isUpcomingMovie(movie);

  const queryClient = new QueryClient();
  const [anilistId] = await Promise.all([
    anilistIdPromise.then((mapped) => queryAnilistId ?? mapped),
    hydrateMovieDetailQueries(queryClient, id, movie),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MediaDetailLayout
        media={[movie]}
        mediaType="movie"
        isUpcoming={isUpcoming}
        anilistId={anilistId}
        contentContainerClassName={DETAIL_CONTENT_CONTAINER_CLASS}
      >
        <div className="mt-4">{children}</div>
      </MediaDetailLayout>
    </HydrationBoundary>
  );
}

export default function MovieDetailLayout({ children, params }: Props) {
  return (
    <Suspense fallback={<DetailPageLoading mediaType="movie" />}>
      <MovieDetailLayoutContent params={params}>
        {children}
      </MovieDetailLayoutContent>
    </Suspense>
  );
}

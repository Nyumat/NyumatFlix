import {
  DETAIL_CONTENT_CONTAINER_CLASS,
  DetailPageLoading,
} from "@/components/layout/page-loading/detail-page-loading";
import { MediaDetailLayout } from "@/components/media/media-server";
import { DirectPlaybackWarmup } from "@/components/media/direct-playback-warmup";
import { hydrateMovieDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { getDetailRouteSearchParams } from "@/lib/detail-search-params";
import { getAnilistIdFromFribb } from "@/lib/fribb-mapping";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
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
  const movie = await getCachedMovieDetail(id);

  if (!movie || !("title" in movie)) {
    notFound();
  }
  if ("adult" in movie && movie.adult) {
    notFound();
  }

  const requestSearchParams = await getDetailRouteSearchParams();
  const queryAnilistId = parsePositiveInt(requestSearchParams.get("anilistId"));
  const mappedAnilistId = await getAnilistIdFromFribb(
    Number.parseInt(id, 10),
    "movie",
  );
  const anilistId =
    queryAnilistId ?? mappedAnilistId ?? (await getAnilistIdForMedia(movie));
  const isUpcoming = isUpcomingMovie(movie);

  const queryClient = new QueryClient();
  await hydrateMovieDetailQueries(queryClient, id, movie);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DirectPlaybackWarmup />
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

import {
  DETAIL_CONTENT_CONTAINER_CLASS,
  DetailPageLoading,
} from "@/components/layout/page-loading/detail-page-loading";
import { MediaDetailLayout } from "@/components/media/media-server";
import { hydrateMovieDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedMovieAboveFoldDetail } from "@/lib/media-above-fold-server";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { isUpcomingMovie } from "@/utils/movie-helpers";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { MediaItem } from "@/lib/domain/typings";

export const revalidate = 3600;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

async function MovieDetailLayoutContent({ children, params }: Props) {
  const { id } = await params;
  const details = await getCachedMovieAboveFoldDetail(id);
  if (!details || !("title" in details)) {
    notFound();
  }
  if ("adult" in details && details.adult) {
    notFound();
  }

  const detailMedia = details as MediaItem;
  const anilistId = await getAnilistIdForMedia(detailMedia);
  const isUpcoming = isUpcomingMovie(detailMedia);

  const queryClient = new QueryClient();
  await hydrateMovieDetailQueries(queryClient, id, details);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MediaDetailLayout
        media={[detailMedia]}
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

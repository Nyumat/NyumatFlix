import { MediaDetailRouteTabs } from "@/components/media/media-detail-route-tabs";
import { MediaDetailLayout } from "@/components/media/media-server";
import { hydrateMovieDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
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

export default async function MovieDetailLayout({ children, params }: Props) {
  const { id } = await params;
  const details = await getCachedMovieDetail(id);
  if (!details || !("title" in details)) {
    notFound();
  }
  if ("adult" in details && details.adult) {
    notFound();
  }

  const anilistId = await getAnilistIdForMedia(details);
  const isUpcoming = isUpcomingMovie(details);

  const queryClient = new QueryClient();
  await hydrateMovieDetailQueries(queryClient, id, details);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <MediaDetailLayout
          media={[details]}
          mediaType="movie"
          isUpcoming={isUpcoming}
          anilistId={anilistId}
          contentContainerClassName="mx-auto px-4 relative z-10 max-w-7xl !pt-4 sm:!pt-6 lg:!pt-8"
          sectionNav={<MediaDetailRouteTabs mediaType="movie" id={id} />}
        >
          <div className="mt-4">{children}</div>
        </MediaDetailLayout>
      </Suspense>
    </HydrationBoundary>
  );
}

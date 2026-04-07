import { fetchAllSeasonDetails } from "@/components/tvshow/tvshow-api";
import { TvShowDetailShell } from "@/components/tvshow/tvshow-detail-shell";
import { hydrateTvShowDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 3600;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TVShowDetailLayout({ children, params }: Props) {
  const { id } = await params;

  let details;
  try {
    details = await getCachedTvShowDetail(id);
  } catch {
    notFound();
  }

  if (!details) {
    notFound();
  }

  const [anilistId, allSeasonDetails] = await Promise.all([
    getAnilistIdForMedia(details),
    fetchAllSeasonDetails(id, details.seasons),
  ]);

  const queryClient = new QueryClient();
  await hydrateTvShowDetailQueries(queryClient, id, details, allSeasonDetails);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <TvShowDetailShell
          details={details}
          tvId={id}
          anilistId={anilistId}
          allSeasonDetails={allSeasonDetails}
        >
          {children}
        </TvShowDetailShell>
      </Suspense>
    </HydrationBoundary>
  );
}

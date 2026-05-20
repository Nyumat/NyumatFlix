import { TvShowDetailShell } from "@/components/tvshow/tvshow-detail-shell";
import { hydrateTvShowDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedTvAboveFoldDetail } from "@/lib/media-above-fold-server";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { TvShowDetails } from "@/utils/typings";

export const revalidate = 3600;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TVShowDetailLayout({ children, params }: Props) {
  const { id } = await params;

  let details;
  try {
    details = await getCachedTvAboveFoldDetail(id);
  } catch {
    notFound();
  }

  if (!details) {
    notFound();
  }

  const detailMedia = details as TvShowDetails;
  const anilistId = await getAnilistIdForMedia(detailMedia);

  const queryClient = new QueryClient();
  await hydrateTvShowDetailQueries(queryClient, id, details);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <TvShowDetailShell
          details={detailMedia}
          tvId={id}
          anilistId={anilistId}
        >
          {children}
        </TvShowDetailShell>
      </Suspense>
    </HydrationBoundary>
  );
}

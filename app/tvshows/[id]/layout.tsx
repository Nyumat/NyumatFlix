import { DetailPageLoading } from "@/components/layout/page-loading/detail-page-loading";
import { TvShowDetailShell } from "@/components/tvshow/tvshow-detail-shell";
import { resolveCanonicalAnilistRoute } from "@/lib/anilist-tv-detail";
import {
  isAnilistTvRouteId,
  normalizeAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import { hydrateTvShowDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedTvAboveFoldDetail } from "@/lib/media-above-fold-server";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { TvShowDetails } from "@/lib/domain/typings";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TVShowDetailLayout({ children, params }: Props) {
  const { id } = await params;

  if (isAnilistTvRouteId(id)) {
    const normalized = normalizeAnilistTvRouteSlug(id);
    const canonical = await resolveCanonicalAnilistRoute(id);

    if (canonical && normalized !== canonical.slug) {
      const searchParams = new URLSearchParams();
      if (canonical.season > 1) {
        searchParams.set("season", String(canonical.season));
      }
      const query = searchParams.toString();
      redirect(
        query
          ? `/tvshows/${canonical.slug}?${query}`
          : `/tvshows/${canonical.slug}`,
      );
    }

    if (id !== normalized) {
      redirect(`/tvshows/${normalized}`);
    }
  }

  return (
    <Suspense fallback={<DetailPageLoading mediaType="tv" />}>
      <TvShowDetailLayoutContent params={params}>
        {children}
      </TvShowDetailLayoutContent>
    </Suspense>
  );
}

async function TvShowDetailLayoutContent({ children, params }: Props) {
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
  const anilistId = isAnilistTvRouteId(id)
    ? detailMedia.id
    : await getAnilistIdForMedia(detailMedia);

  const queryClient = new QueryClient();
  await hydrateTvShowDetailQueries(queryClient, id, details);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TvShowDetailShell details={detailMedia} tvId={id} anilistId={anilistId}>
        {children}
      </TvShowDetailShell>
    </HydrationBoundary>
  );
}

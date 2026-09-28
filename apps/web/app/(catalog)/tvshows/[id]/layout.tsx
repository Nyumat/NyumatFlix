import { DetailPageLoading } from "@/components/layout/page-loading/detail-page-loading";
import { isAnilistTvRouteId } from "@/lib/anilist-route-id";
import { TvShowDetailLayoutContent } from "@/lib/server/tv-detail-layout-content";
import { notFound } from "next/navigation";
import { getSnapshotStaticTvIds } from "@/lib/server/hub-snapshots";
import { Suspense } from "react";

export function generateStaticParams() {
  return getSnapshotStaticTvIds().map((id) => ({
    id: String(id),
  }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TVShowDetailLayout(props: Props) {
  const { children, params } = props;
  const { id } = await params;

  if (isAnilistTvRouteId(id)) {
    notFound();
  }

  return (
    <Suspense fallback={<DetailPageLoading mediaType="tv" />}>
      <TvShowDetailLayoutContent params={params}>
        {children}
      </TvShowDetailLayoutContent>
    </Suspense>
  );
}

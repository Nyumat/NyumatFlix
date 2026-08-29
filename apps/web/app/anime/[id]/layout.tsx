import { DetailPageLoading } from "@/components/layout/page-loading/detail-page-loading";
import { resolveAnilistTvDetailRedirects } from "@/lib/server/anime-tv-detail-route";
import { resolveMalAnimeDetailRedirects } from "@/lib/server/mal-anime-detail-route";
import { resolveTmdbAnimeDetailRedirects } from "@/lib/server/tmdb-anime-detail-route";
import { TvShowDetailLayoutContent } from "@/lib/server/tv-detail-layout-content";
import { Suspense } from "react";

export const revalidate = 3600;

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function AnimeDetailLayout({ children, params }: Props) {
  const { id } = await params;

  await resolveMalAnimeDetailRedirects(id);
  await resolveTmdbAnimeDetailRedirects(id);
  await resolveAnilistTvDetailRedirects(id);

  return (
    <Suspense fallback={<DetailPageLoading mediaType="tv" />}>
      <TvShowDetailLayoutContent params={params} routeNamespace="anime">
        {children}
      </TvShowDetailLayoutContent>
    </Suspense>
  );
}

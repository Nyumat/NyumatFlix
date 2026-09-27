import { DetailPageLoading } from "@/components/layout/page-loading/detail-page-loading";
import { resolveAnilistTvDetailRedirects } from "@/lib/server/anime-tv-detail-route";
import { resolveKitsuAnimeDetailRedirects } from "@/lib/server/kitsu-anime-detail-route";
import { resolveMalAnimeDetailRedirects } from "@/lib/server/mal-anime-detail-route";
import { resolveTmdbAnimeDetailRedirects } from "@/lib/server/tmdb-anime-detail-route";
import { TvShowDetailLayoutContent } from "@/lib/server/tv-detail-layout-content";
import { Suspense } from "react";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

async function AnimeDetailGate({
  id,
  params,
  children,
}: {
  id: string;
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  await resolveMalAnimeDetailRedirects(id);
  await resolveTmdbAnimeDetailRedirects(id);
  await resolveKitsuAnimeDetailRedirects(id);
  await resolveAnilistTvDetailRedirects(id);

  return (
    <TvShowDetailLayoutContent params={params} routeNamespace="anime">
      {children}
    </TvShowDetailLayoutContent>
  );
}

export default async function AnimeDetailLayout(props: Props) {
  const { children, params } = props;
  const { id } = await params;

  return (
    <Suspense fallback={<DetailPageLoading mediaType="tv" />}>
      <AnimeDetailGate id={id} params={params}>
        {children}
      </AnimeDetailGate>
    </Suspense>
  );
}

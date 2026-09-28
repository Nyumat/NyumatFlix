import {
  DetailRouteSearchParamsBoundary,
  type DetailRouteSearchParams,
} from "@/components/detail/detail-route-search-params-boundary";
import {
  DETAIL_CONTENT_CONTAINER_CLASS,
  DetailPageLoading,
} from "@/components/layout/page-loading/detail-page-loading";
import { MediaDetailLayout } from "@/components/media/media-server";
import { hydrateMovieDetailQueries } from "@/lib/prefetch-media-detail-queries";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import {
  applyHeroBackdropOverride,
  getHeroBackdropOverrides,
} from "@/lib/flags/hero-backdrop-overrides-server";
import type { HeroBackdropOverridesConfig } from "@/lib/flags/hero-backdrop-overrides";
import { resolveTmdbMediaToAnilistId } from "@/lib/anime/cross-id-resolver";
import { applyCatalogHourCacheLife } from "@/lib/server/route-cache-life";
import type { MediaItem } from "@/lib/domain/typings";
import { isAnime } from "@/utils/anilist-helpers";
import { isUpcomingMovie } from "@/utils/movie-helpers";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { getSnapshotStaticMovieIds } from "@/lib/server/hub-snapshots";
import { Suspense, type ReactNode } from "react";

export function generateStaticParams() {
  return getSnapshotStaticMovieIds().map((id) => ({
    id: String(id),
  }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

type MovieDetailSearchParamsLayerProps = {
  children: ReactNode;
  movie: MediaItem;
  heroMovieBase: MediaItem;
  overrides: HeroBackdropOverridesConfig;
  numericMovieId: number;
  isUpcoming: boolean;
  search: DetailRouteSearchParams;
};

const MovieDetailSearchParamsLayer = async ({
  children,
  movie,
  heroMovieBase,
  overrides,
  numericMovieId,
  isUpcoming,
  search,
}: MovieDetailSearchParamsLayerProps) => {
  const queryAnilistId = search.anilistId;
  const shouldAutoResolveAnime = queryAnilistId === null && isAnime(movie);
  const anilistId =
    queryAnilistId ??
    (shouldAutoResolveAnime && Number.isInteger(numericMovieId)
      ? await resolveTmdbMediaToAnilistId(numericMovieId, "movie").catch(
          () => null,
        )
      : null);

  const heroMovie =
    queryAnilistId !== null
      ? applyHeroBackdropOverride(movie, overrides, {
          mediaType: "movie",
          tmdbId: Number.isInteger(numericMovieId) ? numericMovieId : null,
          anilistId: queryAnilistId,
        })
      : heroMovieBase;

  return (
    <MediaDetailLayout
      media={[heroMovie]}
      mediaType="movie"
      isUpcoming={isUpcoming}
      anilistId={anilistId}
      contentContainerClassName={DETAIL_CONTENT_CONTAINER_CLASS}
    >
      <div className="mt-4">{children}</div>
    </MediaDetailLayout>
  );
};

type CachedMovieDetailLayoutData = {
  movie: MediaItem;
  heroMovieBase: MediaItem;
  overrides: HeroBackdropOverridesConfig;
  numericMovieId: number;
  isUpcoming: boolean;
  dehydratedState: ReturnType<typeof dehydrate>;
};

async function loadCachedMovieDetailLayout(
  id: string,
): Promise<CachedMovieDetailLayoutData> {
  "use cache";
  applyCatalogHourCacheLife();

  const movie = await getCachedMovieDetail(id);

  if (!movie || !("title" in movie)) {
    notFound();
  }
  if ("adult" in movie && movie.adult) {
    notFound();
  }

  const numericMovieId = Number.parseInt(id, 10);
  const isUpcoming = isUpcomingMovie(movie);
  const overrides = await getHeroBackdropOverrides();
  const heroMovieBase = applyHeroBackdropOverride(movie, overrides, {
    mediaType: "movie",
    tmdbId: Number.isInteger(numericMovieId) ? numericMovieId : null,
    anilistId: null,
  });

  const queryClient = new QueryClient();
  await hydrateMovieDetailQueries(queryClient, id, movie);

  return {
    movie,
    heroMovieBase,
    overrides,
    numericMovieId,
    isUpcoming,
    dehydratedState: dehydrate(queryClient),
  };
}

async function MovieDetailLayoutContent({
  children,
  id,
  search,
}: {
  children: ReactNode;
  id: string;
  search: DetailRouteSearchParams;
}) {
  const cached = await loadCachedMovieDetailLayout(id);

  return (
    <HydrationBoundary state={cached.dehydratedState}>
      <MovieDetailSearchParamsLayer
        movie={cached.movie}
        heroMovieBase={cached.heroMovieBase}
        overrides={cached.overrides}
        numericMovieId={cached.numericMovieId}
        isUpcoming={cached.isUpcoming}
        search={search}
      >
        {children}
      </MovieDetailSearchParamsLayer>
    </HydrationBoundary>
  );
}

async function MovieDetailLayoutGate({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;

  return (
    <DetailRouteSearchParamsBoundary>
      {(search) => (
        <MovieDetailLayoutContent id={id} search={search}>
          {children}
        </MovieDetailLayoutContent>
      )}
    </DetailRouteSearchParamsBoundary>
  );
}

export default function MovieDetailLayout(props: Props) {
  return (
    <Suspense fallback={<DetailPageLoading mediaType="movie" />}>
      <MovieDetailLayoutGate params={props.params}>
        {props.children}
      </MovieDetailLayoutGate>
    </Suspense>
  );
}

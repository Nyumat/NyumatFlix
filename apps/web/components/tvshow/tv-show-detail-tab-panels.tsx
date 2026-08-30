"use client";

import { HeroTvEpisodePanel } from "@/components/hero/hero-tv-episode-panel";
import { ExpandableCastGrid } from "@/components/media/expandable-cast-grid";
import { TvCard } from "@/components/tv/tv-card";
import { TvShowSeasonsPage } from "@/components/tvshow/tvshow-seasons-page";
import { useTvDetailBootstrap } from "@/components/tvshow/tv-detail-bootstrap-context";
import {
  fetchTvAllSeasonsClient,
  fetchTvCreditsClient,
  fetchTvDetailsClient,
  fetchTvRecommendationsPageClient,
} from "@/lib/media-detail-tab-client";
import { queryStaleTime } from "@/lib/cache-policy";
import { isAnilistBackedTvRouteId } from "@/lib/tv-detail-catalog";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { TvShowDetails } from "@/lib/domain/typings";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useInView } from "react-intersection-observer";

type TvShowDetailTabPanelsProps = {
  tvId: string;
};

type DetailSectionProps = {
  title: string;
  id?: string;
  children: ReactNode;
  headingClassName?: string;
};

const DetailSection = ({
  title,
  id,
  children,
  headingClassName,
}: DetailSectionProps) => (
  <section id={id} className="scroll-mt-24">
    <h2
      className={cn(
        "mb-5 flex items-center gap-3 text-2xl font-semibold text-foreground sm:text-3xl",
        headingClassName,
      )}
    >
      <span className="h-8 w-1 rounded-full bg-primary" aria-hidden />
      {title}
    </h2>
    {children}
  </section>
);

const GridSectionSkeleton = () => (
  <div className="grid-list">
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="aspect-poster rounded-lg border border-border/60 bg-card/25"
      />
    ))}
  </div>
);

const SeriesGraphFallback = () => (
  <DetailSection title="Series Graph" headingClassName="mb-3">
    <div className="h-64 rounded-xl border border-white/10 bg-black/10" />
  </DetailSection>
);

const EpisodesSection = () => {
  const { tvId, catalog, details: bootstrapDetails } = useTvDetailBootstrap();
  const isAnilistRoute = isAnilistBackedTvRouteId(tvId, catalog);

  const { data: details = bootstrapDetails } = useQuery({
    queryKey: isAnilistRoute
      ? queryKeys.tvDetailsRoute(tvId)
      : queryKeys.tvDetails(Number.parseInt(tvId, 10)),
    queryFn: async () => {
      const nextDetails = await fetchTvDetailsClient(tvId, catalog);
      if (!nextDetails) throw new Error("TV show not found");
      return nextDetails;
    },
    initialData: bootstrapDetails,
    staleTime: queryStaleTime(60 * 60 * 1000),
  });

  return (
    <DetailSection id="seasons-episodes-panel" title="Seasons & Episodes">
      <HeroTvEpisodePanel tvId={tvId} details={details as TvShowDetails} />
    </DetailSection>
  );
};

const SeriesGraphSection = () => {
  const { tvId, catalog } = useTvDetailBootstrap();
  const isAnilistRoute = isAnilistBackedTvRouteId(tvId, catalog);
  const { data: allSeasonDetails } = useQuery({
    queryKey: queryKeys.tvAllSeasons(tvId),
    queryFn: () => fetchTvAllSeasonsClient(tvId, catalog),
    staleTime: queryStaleTime(60 * 60 * 1000),
    enabled: !isAnilistRoute,
  });

  if (isAnilistRoute) {
    return null;
  }

  if (!allSeasonDetails) {
    return <SeriesGraphFallback />;
  }

  return <TvShowSeasonsPage allSeasonDetails={allSeasonDetails} />;
};

const LazySeriesGraphSection = () => {
  const isHydrated = useIsHydrated();
  const { ref, inView } = useInView({
    rootMargin: "600px 0px",
    triggerOnce: true,
  });

  return (
    <div ref={ref}>
      {!isHydrated || !inView ? (
        <SeriesGraphFallback />
      ) : (
        <SeriesGraphSection />
      )}
    </div>
  );
};

const CastSection = () => {
  const { tvId, catalog, details: bootstrapDetails } = useTvDetailBootstrap();
  const { data: credits } = useQuery({
    queryKey: queryKeys.tvTabCredits(tvId),
    queryFn: () => fetchTvCreditsClient(tvId, catalog),
    initialData: bootstrapDetails.credits,
    staleTime: queryStaleTime(60 * 60 * 1000),
  });

  return (
    <DetailSection title="Cast">
      {credits?.cast?.length ? (
        <ExpandableCastGrid cast={credits.cast} />
      ) : credits ? (
        <div className="empty-box">No cast information available</div>
      ) : (
        <GridSectionSkeleton />
      )}
    </DetailSection>
  );
};

const RecommendationsSection = () => {
  const { tvId, catalog, details: bootstrapDetails } = useTvDetailBootstrap();
  const { data: recommendationsData } = useQuery({
    queryKey: queryKeys.tvTabRecommendations(tvId, "1"),
    queryFn: () => fetchTvRecommendationsPageClient(tvId, "1", catalog),
    initialData: bootstrapDetails.recommendations,
    staleTime: queryStaleTime(60 * 60 * 1000),
  });

  return (
    <DetailSection title="You Might Like">
      {recommendationsData?.results?.length ? (
        <div className="grid-list">
          {recommendationsData.results.map((show) => (
            <TvCard
              key={show.id}
              {...show}
              variant="linkOnly"
              catalog={catalog}
            />
          ))}
        </div>
      ) : recommendationsData ? (
        <div className="empty-box">No recommendations available</div>
      ) : (
        <GridSectionSkeleton />
      )}
    </DetailSection>
  );
};

export const TvShowDetailTabPanels = ({
  tvId: _tvId,
}: TvShowDetailTabPanelsProps) => {
  return (
    <div className="space-y-8">
      <EpisodesSection />
      <CastSection />
      <RecommendationsSection />
      <LazySeriesGraphSection />
    </div>
  );
};

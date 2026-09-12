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
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useInView } from "react-intersection-observer";

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

type LazyTabSectionProps = {
  title: string;
  id?: string;
  fallback: ReactNode;
  children: ReactNode;
  headingClassName?: string;
};

const LazyTabSection = ({
  title,
  id,
  fallback,
  children,
  headingClassName,
}: LazyTabSectionProps) => {
  const isHydrated = useIsHydrated();
  const { ref, inView } = useInView({
    rootMargin: "600px 0px",
    triggerOnce: true,
  });

  return (
    <div ref={ref}>
      {!isHydrated || !inView ? (
        fallback
      ) : (
        <DetailSection
          title={title}
          id={id}
          headingClassName={headingClassName}
        >
          {children}
        </DetailSection>
      )}
    </div>
  );
};

const EpisodesSection = () => {
  const {
    tvId,
    catalog,
    details: bootstrapDetails,
    initialSeasonDetails,
  } = useTvDetailBootstrap();
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
    refetchOnMount: false,
  });

  return (
    <HeroTvEpisodePanel
      tvId={tvId}
      details={details}
      allSeasonDetails={initialSeasonDetails}
    />
  );
};

const SeriesGraphSection = () => {
  const { tvId, catalog } = useTvDetailBootstrap();
  const { data: allSeasonDetails } = useQuery({
    queryKey: queryKeys.tvAllSeasons(tvId),
    queryFn: () => fetchTvAllSeasonsClient(tvId, catalog),
    staleTime: queryStaleTime(60 * 60 * 1000),
    refetchOnMount: false,
  });

  if (!allSeasonDetails || Object.keys(allSeasonDetails).length === 0) {
    return <GridSectionSkeleton />;
  }

  return <TvShowSeasonsPage allSeasonDetails={allSeasonDetails} />;
};

const LazySeriesGraphSection = () => (
  <LazyTabSection
    title="Series Graph"
    headingClassName="mb-3"
    fallback={<SeriesGraphFallback />}
  >
    <SeriesGraphSection />
  </LazyTabSection>
);

const CastSection = () => {
  const { tvId, catalog } = useTvDetailBootstrap();
  const { data: credits, isPending } = useQuery({
    queryKey: queryKeys.tvTabCredits(tvId),
    queryFn: () => fetchTvCreditsClient(tvId, catalog),
    staleTime: queryStaleTime(60 * 60 * 1000),
    refetchOnMount: false,
  });

  if (isPending) {
    return <GridSectionSkeleton />;
  }

  if (credits?.cast?.length) {
    return <ExpandableCastGrid cast={credits.cast} />;
  }

  return <div className="empty-box">No cast information available</div>;
};

const LazyCastSection = () => (
  <LazyTabSection
    title="Cast"
    fallback={
      <DetailSection title="Cast">
        <GridSectionSkeleton />
      </DetailSection>
    }
  >
    <CastSection />
  </LazyTabSection>
);

const RecommendationsSection = () => {
  const { tvId, catalog } = useTvDetailBootstrap();
  const { data: recommendationsData, isPending } = useQuery({
    queryKey: queryKeys.tvTabRecommendations(tvId, "1"),
    queryFn: () => fetchTvRecommendationsPageClient(tvId, "1", catalog),
    staleTime: queryStaleTime(60 * 60 * 1000),
    refetchOnMount: false,
  });

  if (isPending) {
    return <GridSectionSkeleton />;
  }

  if (recommendationsData?.results?.length) {
    return (
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
    );
  }

  return <div className="empty-box">No recommendations available</div>;
};

const LazyRecommendationsSection = () => (
  <LazyTabSection
    title="You Might Like"
    fallback={
      <DetailSection title="You Might Like">
        <GridSectionSkeleton />
      </DetailSection>
    }
  >
    <RecommendationsSection />
  </LazyTabSection>
);

export const TvShowDetailTabPanels = () => {
  return (
    <div className="space-y-8">
      <DetailSection id="seasons-episodes-panel" title="Seasons & Episodes">
        <EpisodesSection />
      </DetailSection>
      <LazyCastSection />
      <LazyRecommendationsSection />
      <LazySeriesGraphSection />
    </div>
  );
};

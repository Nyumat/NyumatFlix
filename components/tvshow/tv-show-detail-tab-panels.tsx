"use client";

import { HeroTvEpisodePanel } from "@/components/hero/hero-tv-episode-panel";
import { ExpandableCastGrid } from "@/components/media/expandable-cast-grid";
import { TvCard } from "@/components/tv/tv-card";
import { TvShowSeasonsPage } from "@/components/tvshow/tvshow-seasons-page";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import {
  fetchTvAllSeasonsClient,
  fetchTvCreditsClient,
  fetchTvDetailsClient,
  fetchTvRecommendationsPageClient,
} from "@/lib/media-detail-tab-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { TvShowDetails } from "@/utils/typings";
import { useQuery } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
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

const EpisodesFallback = () => (
  <DetailSection id="seasons-episodes-panel" title="Seasons & Episodes">
    <div className="flex h-[min(680px,72vh)] w-full flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-12 w-full rounded-lg bg-card/50 sm:w-56" />
        <div className="h-12 min-w-0 flex-1 rounded-lg bg-card/50" />
        <div className="h-12 w-12 shrink-0 rounded-lg bg-card/50" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-border/70 bg-card/25"
          />
        ))}
      </div>
    </div>
  </DetailSection>
);

const SeriesGraphFallback = () => (
  <DetailSection title="Series Graph" headingClassName="mb-3">
    <div className="h-64 rounded-xl border border-white/10 bg-black/10" />
  </DetailSection>
);

const GridSectionFallback = ({ title }: { title: string }) => (
  <DetailSection title={title}>
    <div className="grid-list">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="aspect-poster rounded-lg border border-border/60 bg-card/25"
        />
      ))}
    </div>
  </DetailSection>
);

const EpisodesSection = ({ tvId }: TvShowDetailTabPanelsProps) => {
  const numId = Number.parseInt(tvId, 10);
  const isHydrated = useIsHydrated();

  const { data: details } = useQuery({
    queryKey: queryKeys.tvDetails(numId),
    queryFn: async () => {
      const d = await fetchTvDetailsClient(tvId);
      if (!d) throw new Error("TV show not found");
      return d;
    },
    enabled: isHydrated,
  });

  if (!isHydrated || !details) return <EpisodesFallback />;

  return (
    <DetailSection id="seasons-episodes-panel" title="Seasons & Episodes">
      <HeroTvEpisodePanel tvId={tvId} details={details as TvShowDetails} />
    </DetailSection>
  );
};

const SeriesGraphSection = ({ tvId }: TvShowDetailTabPanelsProps) => {
  const isHydrated = useIsHydrated();
  const { data: allSeasonDetails } = useQuery({
    queryKey: queryKeys.tvAllSeasons(tvId),
    queryFn: () => fetchTvAllSeasonsClient(tvId),
    enabled: isHydrated,
  });

  if (!isHydrated || !allSeasonDetails) return <SeriesGraphFallback />;

  return <TvShowSeasonsPage allSeasonDetails={allSeasonDetails} />;
};

const LazySeriesGraphSection = ({ tvId }: TvShowDetailTabPanelsProps) => {
  const { ref, inView } = useInView({
    rootMargin: "600px 0px",
    triggerOnce: true,
  });

  return (
    <div ref={ref}>
      {inView ? (
        <Suspense fallback={<SeriesGraphFallback />}>
          <SeriesGraphSection tvId={tvId} />
        </Suspense>
      ) : (
        <SeriesGraphFallback />
      )}
    </div>
  );
};

const CastSection = ({ tvId }: TvShowDetailTabPanelsProps) => {
  const isHydrated = useIsHydrated();
  const { data: credits } = useQuery({
    queryKey: queryKeys.tvTabCredits(tvId),
    queryFn: () => fetchTvCreditsClient(tvId),
    enabled: isHydrated,
  });

  if (!isHydrated || !credits) return <GridSectionFallback title="Cast" />;

  return (
    <DetailSection title="Cast">
      {credits.cast?.length ? (
        <ExpandableCastGrid cast={credits.cast} />
      ) : (
        <div className="empty-box">No cast information available</div>
      )}
    </DetailSection>
  );
};

const RecommendationsSection = ({ tvId }: TvShowDetailTabPanelsProps) => {
  const isHydrated = useIsHydrated();
  const { data: recommendationsData } = useQuery({
    queryKey: queryKeys.tvTabRecommendations(tvId, "1"),
    queryFn: () => fetchTvRecommendationsPageClient(tvId, "1"),
    enabled: isHydrated,
  });

  if (!isHydrated || !recommendationsData) {
    return <GridSectionFallback title="You Might Like" />;
  }

  return (
    <DetailSection title="You Might Like">
      {recommendationsData.results?.length ? (
        <section className="grid-list">
          {recommendationsData.results.map((show) => (
            <TvCard key={show.id} {...show} variant="linkOnly" />
          ))}
        </section>
      ) : (
        <div className="empty-box">No recommendations available</div>
      )}
    </DetailSection>
  );
};

export const TvShowDetailTabPanels = ({ tvId }: TvShowDetailTabPanelsProps) => {
  return (
    <div className="space-y-8">
      <Suspense fallback={<EpisodesFallback />}>
        <EpisodesSection tvId={tvId} />
      </Suspense>

      <Suspense fallback={<GridSectionFallback title="Cast" />}>
        <CastSection tvId={tvId} />
      </Suspense>

      <Suspense fallback={<GridSectionFallback title="You Might Like" />}>
        <RecommendationsSection tvId={tvId} />
      </Suspense>

      <LazySeriesGraphSection tvId={tvId} />
    </div>
  );
};

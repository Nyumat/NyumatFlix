"use client";

import { ExpandableCastGrid } from "@/components/media/expandable-cast-grid";
import { MovieCard } from "@/components/movie/movie-card";
import { MovieOverviewTab } from "@/components/movie/movie-overview-tab";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import {
  fetchMovieCreditsClient,
  fetchMovieDetailsClient,
  fetchMovieRecommendationsPageClient,
} from "@/lib/media-detail-tab-client";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { MovieDetails } from "@/tmdb/models";
import { useQuery } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";

type MovieDetailTabPanelsProps = {
  movieId: string;
};

type DetailSectionProps = {
  title: string;
  children: ReactNode;
};

const DetailSection = ({ title, children }: DetailSectionProps) => (
  <section className="scroll-mt-24">
    <h2
      className={cn(
        "mb-5 flex items-center gap-3 text-2xl font-semibold text-foreground sm:text-3xl",
      )}
    >
      <span className="h-8 w-1 rounded-full bg-primary" aria-hidden />
      {title}
    </h2>
    {children}
  </section>
);

const OverviewFallback = () => (
  <DetailSection title="Overview">
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-card/50" />
        <div className="h-4 w-11/12 rounded bg-card/50" />
        <div className="h-4 w-3/4 rounded bg-card/50" />
      </div>
      <div className="h-64 rounded-xl border border-white/15 bg-black/25" />
    </div>
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

const OverviewSection = ({ movieId }: MovieDetailTabPanelsProps) => {
  const numId = Number.parseInt(movieId, 10);
  const isHydrated = useIsHydrated();

  const { data: raw } = useQuery({
    queryKey: queryKeys.movieDetails(numId),
    queryFn: async () => {
      const movie = await fetchMovieDetailsClient(movieId);
      if (!movie || !("title" in movie)) throw new Error("Movie not found");
      return movie;
    },
    enabled: isHydrated,
  });

  if (!isHydrated || !raw) return <OverviewFallback />;

  return (
    <DetailSection title="Overview">
      <MovieOverviewTab
        details={raw as unknown as MovieDetails}
        showOverviewHeading={false}
      />
    </DetailSection>
  );
};

const CastSection = ({ movieId }: MovieDetailTabPanelsProps) => {
  const isHydrated = useIsHydrated();
  const { data: credits } = useQuery({
    queryKey: queryKeys.movieTabCredits(movieId),
    queryFn: () => fetchMovieCreditsClient(movieId),
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

const RecommendationsSection = ({ movieId }: MovieDetailTabPanelsProps) => {
  const isHydrated = useIsHydrated();
  const { data: recommendationsData } = useQuery({
    queryKey: queryKeys.movieTabRecommendations(movieId, "1"),
    queryFn: () => fetchMovieRecommendationsPageClient(movieId, "1"),
    enabled: isHydrated,
  });

  if (!isHydrated || !recommendationsData) {
    return <GridSectionFallback title="You Might Like" />;
  }

  return (
    <DetailSection title="You Might Like">
      {recommendationsData.results?.length ? (
        <section className="grid-list">
          {recommendationsData.results.map((movie) => (
            <MovieCard key={movie.id} {...movie} variant="linkOnly" />
          ))}
        </section>
      ) : (
        <div className="empty-box">No recommendations available</div>
      )}
    </DetailSection>
  );
};

export const MovieDetailTabPanels = ({
  movieId,
}: MovieDetailTabPanelsProps) => {
  return (
    <div className="space-y-8">
      <Suspense fallback={<OverviewFallback />}>
        <OverviewSection movieId={movieId} />
      </Suspense>

      <Suspense fallback={<GridSectionFallback title="Cast" />}>
        <CastSection movieId={movieId} />
      </Suspense>

      <Suspense fallback={<GridSectionFallback title="You Might Like" />}>
        <RecommendationsSection movieId={movieId} />
      </Suspense>
    </div>
  );
};

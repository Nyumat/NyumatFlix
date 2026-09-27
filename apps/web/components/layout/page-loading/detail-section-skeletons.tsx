import type { ReactNode } from "react";

import { CatalogGridSkeleton } from "@/components/catalog/catalog-card-skeletons";
import { mediaCastGridClass } from "@/components/media/media-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DetailSectionShellProps = {
  title: string;
  id?: string;
  headingClassName?: string;
  children: ReactNode;
};

/**
 * Mirrors the detail page section heading used by the movie/tv tab panels so
 * the loading state and the hydrated content share `scroll-mt`, heading scale,
 * and the primary accent bar.
 */
export function DetailSectionShell({
  title,
  id,
  headingClassName,
  children,
}: DetailSectionShellProps) {
  return (
    <section id={id} className="scroll-mt-24" aria-hidden>
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
}

/** Mirrors `MovieOverviewTab`: overview copy + a grid of bordered fact rows. */
export function OverviewSectionSkeleton() {
  return (
    <DetailSectionShell title="Overview">
      <section className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-full max-w-5xl" />
          <Skeleton className="h-5 w-5/6 max-w-5xl" />
          <Skeleton className="h-5 w-2/3 max-w-5xl" />
        </div>
        <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-start gap-3 border-t border-border/70 py-4"
            >
              <Skeleton className="mt-0.5 size-5 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </DetailSectionShell>
  );
}

/** Bare cast grid — mirrors `MediaCastCard` inside `ExpandableCastGrid`. */
export function CastGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className={mediaCastGridClass} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="min-w-0">
          <Skeleton className="aspect-poster w-full rounded-xl" />
          <div className="mt-1.5 space-y-1.5">
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="h-3 w-3/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CastSectionSkeleton() {
  return (
    <DetailSectionShell title="Cast">
      <CastGridSkeleton />
    </DetailSectionShell>
  );
}

/**
 * Bare recommendations grid. Reuses the catalog card skeleton so detail
 * recommendations match every other card grid in the app.
 */
export function RecommendationsGridSkeleton({ count = 8 }: { count?: number }) {
  return <CatalogGridSkeleton count={count} />;
}

export function RecommendationsSectionSkeleton({
  count = 8,
}: {
  count?: number;
}) {
  return (
    <DetailSectionShell title="You Might Like">
      <RecommendationsGridSkeleton count={count} />
    </DetailSectionShell>
  );
}

/** Mirrors the `HeroTvEpisodePanel` header and episode row list. */
export function EpisodesSectionSkeleton() {
  return (
    <DetailSectionShell id="seasons-episodes-panel" title="Seasons & Episodes">
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-12 w-full rounded-lg sm:w-56" />
          <Skeleton className="h-12 min-w-0 flex-1 rounded-lg" />
          <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
        </div>
        <div className="space-y-3 pb-1 pt-0.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-28 rounded-xl border border-border/70"
            />
          ))}
        </div>
      </div>
    </DetailSectionShell>
  );
}

/** Bare series-graph block. */
export function SeriesGraphSkeleton() {
  return <Skeleton className="h-64 rounded-xl" />;
}

export function SeriesGraphSectionSkeleton() {
  return (
    <DetailSectionShell title="Series Graph" headingClassName="mb-3">
      <SeriesGraphSkeleton />
    </DetailSectionShell>
  );
}

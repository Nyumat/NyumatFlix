import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StableBackground } from "@/components/layout/stable-background";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const DETAIL_CONTENT_CONTAINER_CLASS =
  "mx-auto px-4 relative z-10 max-w-7xl pt-4! sm:pt-6! lg:pt-8!";

type DetailPlaceholderProps = {
  className?: string;
};

const DetailPlaceholder = ({ className }: DetailPlaceholderProps) => (
  <div
    className={cn(
      "rounded-md bg-black ring-1 ring-inset ring-white/[0.06]",
      className,
    )}
    aria-hidden
  />
);

const DetailSection = ({
  title,
  id,
  children,
  headingClassName,
}: {
  title: string;
  id?: string;
  children: ReactNode;
  headingClassName?: string;
}) => (
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

const MovieOverviewLoading = () => (
  <DetailSection title="Overview">
    <div className="space-y-6">
      <div className="space-y-3">
        <DetailPlaceholder className="h-4 w-full" />
        <DetailPlaceholder className="h-4 w-11/12" />
        <DetailPlaceholder className="h-4 w-3/4" />
      </div>
      <DetailPlaceholder className="h-64 rounded-xl" />
    </div>
  </DetailSection>
);

const GridSectionLoading = ({ title }: { title: string }) => (
  <DetailSection title={title}>
    <div className="grid-list">
      {Array.from({ length: 8 }).map((_, index) => (
        <DetailPlaceholder
          key={index}
          className="aspect-poster rounded-lg ring-white/[0.08]"
        />
      ))}
    </div>
  </DetailSection>
);

const TvEpisodesLoading = () => (
  <DetailSection id="seasons-episodes-panel" title="Seasons & Episodes">
    <div className="flex h-[min(680px,72vh)] w-full flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DetailPlaceholder className="h-12 w-full sm:w-56" />
        <DetailPlaceholder className="h-12 min-w-0 flex-1" />
        <DetailPlaceholder className="h-12 w-12 shrink-0 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <DetailPlaceholder key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  </DetailSection>
);

function DetailHeroSkeleton() {
  return (
    <div
      className="relative h-[100svh] min-h-[34rem] overflow-hidden bg-black"
      aria-hidden
    >
      <div className="absolute inset-0 z-20 pointer-events-none flex items-end pb-0 px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto w-full md:max-w-7xl lg:max-w-8xl">
          <div className="flex w-full flex-col gap-8 py-12 sm:py-16 lg:gap-8 xl:gap-10 lg:flex-row lg:items-start">
            <div className="min-w-0 w-full max-w-3xl flex-1 flex flex-col pointer-events-auto">
              <DetailPlaceholder className="mb-3 h-14 w-1/4 max-w-xs sm:mb-4 sm:h-16" />

              <div className="flex items-center flex-wrap gap-3 pt-2">
                <DetailPlaceholder className="h-10 min-w-[5.5rem] rounded-full px-4" />
                <DetailPlaceholder className="size-10 rounded-full" />
                <DetailPlaceholder className="h-10 min-w-[5.75rem] rounded-full px-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 bg-linear-to-b from-transparent via-black/75 to-black sm:h-64 lg:h-80" />
    </div>
  );
}

export function MovieDetailTabPanelsLoading() {
  return (
    <div className="space-y-8">
      <MovieOverviewLoading />
      <GridSectionLoading title="Cast" />
      <GridSectionLoading title="You Might Like" />
    </div>
  );
}

export function TvDetailTabPanelsLoading() {
  return (
    <div className="space-y-8">
      <TvEpisodesLoading />
      <GridSectionLoading title="Cast" />
      <GridSectionLoading title="You Might Like" />
    </div>
  );
}

/** @deprecated use MovieDetailTabPanelsLoading or TvDetailTabPanelsLoading */
export function DetailTabPanelsLoading() {
  return <MovieDetailTabPanelsLoading />;
}

type DetailPageLoadingProps = {
  mediaType?: "tv" | "movie";
};

export function DetailPageLoading({
  mediaType = "tv",
}: DetailPageLoadingProps) {
  const TabPanelsLoading =
    mediaType === "tv" ? TvDetailTabPanelsLoading : MovieDetailTabPanelsLoading;

  return (
    <PageContainer className="pb-16">
      <DetailHeroSkeleton />

      <div className="relative">
        <StableBackground />
        <div className="relative">
          <ContentContainer
            topSpacing={false}
            className={DETAIL_CONTENT_CONTAINER_CLASS}
          >
            <div className="mt-4">
              <TabPanelsLoading />
            </div>
          </ContentContainer>
        </div>
      </div>
    </PageContainer>
  );
}

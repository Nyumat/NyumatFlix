import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StableBackground } from "@/components/layout/stable-background";
import { HeroContentSkeleton } from "@/components/hero/hero-content-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { HERO_STATIC_OVERLAY } from "@/lib/hero-overlay-gradient";
import {
  CastSectionSkeleton,
  EpisodesSectionSkeleton,
  OverviewSectionSkeleton,
  RecommendationsSectionSkeleton,
  SeriesGraphSectionSkeleton,
} from "./detail-section-skeletons";

export const DETAIL_CONTENT_CONTAINER_CLASS =
  "mx-auto px-4 relative z-10 max-w-7xl pt-4! sm:pt-6! lg:pt-8!";

/**
 * Mirrors `MediaDetailHero` at rest with just a logo block and one action
 * bar — enough shape to read as the hero without faking every pill.
 */
function DetailHeroSkeleton() {
  return (
    <div
      className="relative h-[100svh] min-h-[34rem] overflow-hidden bg-black"
      aria-hidden
    >
      <div className="absolute inset-0 bg-white/[0.06]">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage: HERO_STATIC_OVERLAY }}
      />

      <div className="absolute inset-0 z-20 flex items-end px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="mx-auto w-full md:max-w-7xl lg:max-w-8xl">
          <HeroContentSkeleton variant="detail" className="max-w-3xl" />
        </div>
      </div>
    </div>
  );
}

export function MovieDetailTabPanelsLoading() {
  return (
    <div className="space-y-8">
      <OverviewSectionSkeleton />
      <CastSectionSkeleton />
      <RecommendationsSectionSkeleton />
    </div>
  );
}

export function TvDetailTabPanelsLoading() {
  return (
    <div className="space-y-8">
      <EpisodesSectionSkeleton />
      <CastSectionSkeleton />
      <RecommendationsSectionSkeleton />
      <SeriesGraphSectionSkeleton />
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

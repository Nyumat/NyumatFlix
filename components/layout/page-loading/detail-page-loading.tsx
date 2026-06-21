import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StableBackground } from "@/components/layout/stable-background";
import { Skeleton } from "@/components/ui/skeleton";

const SectionHeading = () => (
  <div className="mb-5 flex items-center gap-3">
    <span className="h-8 w-1 rounded-full bg-primary/60" aria-hidden />
    <Skeleton className="h-8 w-40 rounded-lg" />
  </div>
);

const OverviewSkeleton = () => (
  <section className="scroll-mt-24" aria-hidden>
    <SectionHeading />
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-11/12 rounded-md" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
      <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2 border-t border-border/70 py-4">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

const GridSectionSkeleton = () => (
  <section className="scroll-mt-24" aria-hidden>
    <SectionHeading />
    <div className="grid-list">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton
          key={index}
          className="aspect-poster rounded-lg border border-border/60"
        />
      ))}
    </div>
  </section>
);

function DetailHeroSkeleton() {
  return (
    <div
      className="relative h-[100svh] min-h-[34rem] overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-neutral-950">
        <div className="absolute inset-0 bg-linear-to-b from-neutral-800/30 via-neutral-950 to-black" />
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none flex items-end pb-0 px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto w-full md:max-w-7xl lg:max-w-8xl">
          <div className="flex w-full flex-col gap-8 py-12 sm:py-16 lg:gap-8 xl:gap-10 lg:flex-row lg:items-start">
            <div className="min-w-0 w-full flex-1 flex flex-col max-w-3xl pointer-events-auto">
              <Skeleton className="mb-3 h-12 w-52 max-w-[45%] rounded-md sm:mb-4 sm:h-14 sm:w-64" />

              <div className="flex items-center flex-wrap gap-3 pt-2">
                <Skeleton className="h-10 w-[5.5rem] rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-[5.75rem] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 bg-linear-to-b from-transparent via-background/75 to-background sm:h-64 lg:h-80" />
    </div>
  );
}

export function DetailTabPanelsLoading() {
  return (
    <div className="space-y-8">
      <OverviewSkeleton />
      <GridSectionSkeleton />
      <GridSectionSkeleton />
    </div>
  );
}

export function DetailPageLoading() {
  return (
    <PageContainer className="pb-16">
      <DetailHeroSkeleton />

      <div className="relative">
        <StableBackground />
        <div className="relative">
          <ContentContainer
            topSpacing={false}
            className="mx-auto px-4 relative z-10 max-w-7xl pt-4! sm:pt-6! lg:pt-8!"
          >
            <div className="mt-4">
              <DetailTabPanelsLoading />
            </div>
          </ContentContainer>
        </div>
      </div>
    </PageContainer>
  );
}

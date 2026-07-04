import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StableBackground } from "@/components/layout/stable-background";
import { Skeleton } from "@/components/ui/skeleton";

export function PersonPageLoading() {
  return (
    <PageContainer className="mb-4 pb-4">
      <div className="relative min-h-screen">
        <StableBackground />
        <div className="relative z-10">
          <ContentContainer
            className="relative z-10 mx-auto mt-6 max-w-7xl px-4"
            topSpacing={false}
          >
            <div
              className="mb-8 grid scroll-mt-24 grid-cols-1 gap-6 lg:grid-cols-3"
              aria-hidden
            >
              <div className="flex justify-center lg:col-span-1 lg:justify-start">
                <Skeleton className="mt-4 aspect-2/3 w-[280px] rounded-lg sm:w-[320px] lg:w-full" />
              </div>

              <div className="lg:col-span-2">
                <div className="space-y-6 rounded-lg border border-white/20 bg-black/60 p-6 shadow-xl backdrop-blur-md">
                  <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-48 rounded-md" />
                    <Skeleton className="h-4 w-56 rounded-md" />
                    <Skeleton className="h-4 w-40 rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-11/12 rounded-md" />
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="scroll-mt-24 rounded-lg border border-white/20 bg-black/60 p-6 shadow-xl backdrop-blur-md"
              aria-hidden
            >
              <div className="mb-6 space-y-4">
                <Skeleton className="h-8 w-40 rounded-lg" />
                <Skeleton className="h-4 w-72 max-w-full rounded-md" />
              </div>
              <div className="grid-list">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="aspect-poster rounded-lg border border-border/60"
                  />
                ))}
              </div>
            </div>
          </ContentContainer>
        </div>
      </div>
    </PageContainer>
  );
}

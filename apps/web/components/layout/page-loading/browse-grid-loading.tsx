import { Skeleton } from "@/components/ui/skeleton";
import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { PageContainer } from "@/components/layout/page-container";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";

export function BrowseGridLoading() {
  return (
    <PageContainer className="pb-16">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="mx-auto w-full max-w-7xl space-y-8 px-2 pb-12 sm:px-4">
          <div className="flex flex-col gap-4 pb-2 pt-20 md:pt-28" aria-hidden>
            <div className="text-center">
              <Skeleton className="mx-auto mb-4 h-10 w-64 rounded-lg sm:mb-6 sm:h-12 md:h-16" />
              <Skeleton className="mx-auto h-5 w-full max-w-2xl rounded-md" />
            </div>
          </div>
          <CatalogGridFallback />
        </div>
      </ContentContainer>
    </PageContainer>
  );
}

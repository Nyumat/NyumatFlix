import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";

export function CollectionPageLoading() {
  return (
    <PageContainer className="pb-16">
      <ContentContainer className="relative z-10" topSpacing={false}>
        <div className="index-container space-y-6 pb-12">
          <div className="flex animate-pulse flex-col gap-4 pb-8 pt-8 md:pt-12">
            <div className="h-9 w-24 rounded-full bg-card/50" />
            <div className="space-y-3">
              <div className="h-10 w-2/3 max-w-md rounded-lg bg-card/50 sm:h-12" />
              <div className="h-4 w-full max-w-3xl rounded bg-card/40" />
              <div className="h-4 w-4/5 max-w-2xl rounded bg-card/40" />
            </div>
          </div>
          <section className="grid-list animate-pulse" aria-hidden>
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="aspect-poster rounded-lg border border-border/60 bg-card/25"
              />
            ))}
          </section>
        </div>
      </ContentContainer>
    </PageContainer>
  );
}

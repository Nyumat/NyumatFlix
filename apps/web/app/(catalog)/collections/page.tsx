import { CollectionsInfiniteList } from "@/components/collections/collections-infinite-list";
import { IndexPage } from "@/components/catalog/index-page";
import { PageContainer } from "@/components/layout/page-container";
import { getHomeCollections } from "@/lib/server/home-collections-data";
import { applyCatalogHourCacheLife } from "@/lib/server/route-cache-life";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collections | NyumatFlix",
  description: "Browse curated movie collections on NyumatFlix.",
};

export const instant = true;

/**
 * Collections surface contract: preserve the home showcase grammar while
 * giving the complete curated collection series its own browsable route.
 */
export default async function CollectionsPage() {
  "use cache";
  applyCatalogHourCacheLife();

  const collections = await getHomeCollections();

  return (
    <PageContainer className="bg-transparent">
      <IndexPage
        contentTopSpacing={false}
        sectionClassName="pt-0"
        header={
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Collections
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Explore complete movie series and cinematic universes.
            </p>
          </div>
        }
      >
        {collections.length ? (
          <CollectionsInfiniteList collections={collections} />
        ) : (
          <p className="rounded-2xl border border-border/60 bg-card/30 p-8 text-center text-muted-foreground">
            Collections are unavailable right now.
          </p>
        )}
      </IndexPage>
    </PageContainer>
  );
}

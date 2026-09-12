import { AnimeHubSectionsFallback } from "@/components/anilist/anime-suspense-fallbacks";
import { CatalogPageShellChromeSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { PageLoadingShell } from "./page-loading-shell";

export function CatalogPageShellLoading() {
  return (
    <PageLoadingShell withPageContainer={false}>
      <section className="min-h-screen w-full pb-16 pt-8 md:pt-12">
        <div className="index-container space-y-8 md:space-y-10 lg:space-y-12">
          <CatalogPageShellChromeSkeleton showAction toolbar="anilist" />
          <AnimeHubSectionsFallback />
        </div>
      </section>
    </PageLoadingShell>
  );
}

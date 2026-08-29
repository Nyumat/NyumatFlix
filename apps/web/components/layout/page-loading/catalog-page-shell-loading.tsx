import { AnimeHubSectionsFallback } from "@/components/anilist/anime-suspense-fallbacks";
import { CatalogPageShellChromeSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { PageLoadingShell } from "./page-loading-shell";

export function CatalogPageShellLoading() {
  return (
    <PageLoadingShell withPageContainer={false}>
      <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
        <div className="container space-y-10">
          <CatalogPageShellChromeSkeleton showAction toolbar="anilist" />
          <AnimeHubSectionsFallback />
        </div>
      </section>
    </PageLoadingShell>
  );
}

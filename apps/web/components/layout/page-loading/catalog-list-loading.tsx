import { Skeleton } from "@/components/ui/skeleton";
import { CatalogListHeaderSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { PageLoadingShell } from "./page-loading-shell";

type CatalogListLoadingProps = {
  centered?: boolean;
};

export function CatalogListLoading({
  centered = false,
}: CatalogListLoadingProps = {}) {
  return (
    <PageLoadingShell withPageContainer={false}>
      <div className="container max-w-7xl space-y-8 px-2 pb-12 pt-14 sm:px-4 md:pt-16">
        <CatalogListHeaderSkeleton centered={centered} />
        <div className="grid-list" aria-hidden>
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton
              key={index}
              className="aspect-poster rounded-lg border border-border/60"
            />
          ))}
        </div>
      </div>
    </PageLoadingShell>
  );
}

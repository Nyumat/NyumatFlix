import { CatalogGridSkeleton } from "@/components/catalog/catalog-card-skeletons";
import { CatalogListHeaderSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import type { CatalogCardStyle } from "@/lib/user/user-settings-types";
import { PageLoadingShell } from "./page-loading-shell";

type CatalogListLoadingProps = {
  centered?: boolean;
  gridClassName?: string;
  cardStyle?: CatalogCardStyle;
};

export function CatalogListLoading({
  centered = false,
  gridClassName,
  cardStyle,
}: CatalogListLoadingProps = {}) {
  return (
    <PageLoadingShell withPageContainer={false}>
      <div className="index-container space-y-8 pb-12 pt-8 md:pt-12">
        <CatalogListHeaderSkeleton centered={centered} />
        <CatalogGridSkeleton
          count={12}
          className={gridClassName}
          style={cardStyle}
        />
      </div>
    </PageLoadingShell>
  );
}

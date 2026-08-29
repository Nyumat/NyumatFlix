import { AnimeInfiniteGrid } from "@/components/anilist/anime-infinite-grid";
import type { AniListSearchParams } from "@/lib/anilist";
import { enrichAniListSearchCatalogItems } from "@/lib/anilist-tmdb";
import { fetchStableAniListPage } from "@/lib/server/anilist-page";

type AnimeResultsGridProps = {
  params: AniListSearchParams;
  page: number;
};

export const AnimeResultsGrid = async ({
  params,
  page,
}: AnimeResultsGridProps) => {
  const data = await fetchStableAniListPage({
    page,
    perPage: 30,
    params,
  });
  const items = await enrichAniListSearchCatalogItems(data.media, 30);

  return items.length > 0 ? (
    <AnimeInfiniteGrid
      initialItems={items}
      initialPage={data.pageInfo.currentPage}
      initialHasNextPage={data.pageInfo.hasNextPage}
      params={params}
    />
  ) : (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <p className="font-medium">No anime found.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Try removing a filter or searching for a broader title.
      </p>
    </div>
  );
};

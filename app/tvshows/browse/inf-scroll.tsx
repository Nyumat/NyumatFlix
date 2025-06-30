import { buildItemsWithCategories, fetchTMDBData } from "@/app/actions";
import { ContentGrid } from "@/components/content/content-grid";
import { buildFilterParams } from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { LoadMore } from "./load-more";

interface ICProps {
  filterId: string;
}

export async function InfiniteContent({
  filterId,
}: ICProps): Promise<JSX.Element> {
  // Get the filter configuration
  // const filterConfig = getFilterConfig(filterId);
  const { endpoint, params } = buildFilterParams(filterId);

  // Fetch initial TV shows
  const initialResponse = await fetchTMDBData(endpoint, {
    ...params,
    page: "1",
  });

  if (!initialResponse?.results || initialResponse.results.length === 0) {
    return <div className="p-8 text-center text-white">No TV shows found</div>;
  }

  // Process the results with categories
  const processedShows = await buildItemsWithCategories<MediaItem>(
    initialResponse.results,
    "tv",
  );

  const initialOffset = 2;

  // Get the page title from the filter config or use a default
  // const pageTitle = filterConfig?.title || "TV Shows";

  const getTVShowListNodes = async (offset: number) => {
    "use server";
    try {
      const response = await fetchTMDBData(endpoint, {
        ...params,
        page: offset.toString(),
      });

      if (!response?.results || response.results.length === 0) {
        return null;
      }

      const processedShows = await buildItemsWithCategories<MediaItem>(
        response.results,
        "tv",
      );

      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;

      return [
        <ContentGrid items={processedShows} key={offset} type="tv" />,
        nextOffset,
      ] as const;
    } catch (error) {
      console.error("Error loading more TV shows:", error);
      return null;
    }
  };

  return (
    <>
      <LoadMore
        key={filterId}
        getTVShowListNodes={getTVShowListNodes}
        initialOffset={initialOffset}
      >
        <ContentGrid items={processedShows} type="tv" />
      </LoadMore>
    </>
  );
}

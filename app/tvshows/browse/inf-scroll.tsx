import { buildItemsWithCategories, fetchTMDBData } from "@/app/actions";
import { ContentGrid } from "@/components/content/content-grid";
import {
  buildFilterParams,
  createYearFilterParams,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { LoadMore } from "./load-more";

interface ICProps {
  filterId: string;
  genre?: string;
  year?: string;
}

export async function InfiniteContent({
  filterId,
  genre,
  year,
}: ICProps): Promise<JSX.Element> {
  // Determine the endpoint and params based on the parameters
  let endpoint = "";
  let params: Record<string, string> = {};

  // Handle year filtering first
  if (year) {
    const yearFilterConfig = createYearFilterParams(year, "tv");
    endpoint = yearFilterConfig.endpoint;
    params = yearFilterConfig.params;
  } else if (genre) {
    // If genre is provided and no filterId, use direct genre filtering
    endpoint = "/discover/tv";
    params = {
      with_genres: genre,
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
    };
  } else if (filterId) {
    // Use the filter configuration if filterId is provided
    const filterConfig = buildFilterParams(filterId);
    endpoint = filterConfig.endpoint;
    params = filterConfig.params;
  } else {
    // Default to popular TV shows if no parameters
    const filterConfig = buildFilterParams("tv-popular");
    endpoint = filterConfig.endpoint;
    params = filterConfig.params;
  }

  // Fetch initial TV shows
  const initialResponse = await fetchTMDBData(endpoint, {
    ...params,
    page: "1",
  });

  if (!initialResponse?.results || initialResponse.results.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No TV shows found matching your criteria.
      </div>
    );
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
        key={`${filterId}-${genre}-${year}`}
        getTVShowListNodes={getTVShowListNodes}
        initialOffset={initialOffset}
      >
        <ContentGrid items={processedShows} type="tv" />
      </LoadMore>
    </>
  );
}
